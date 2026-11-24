"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff, staffAudit, SUPPORT_STAFF } from "@/lib/platform";
import { AiError, aiConfigured, chat, type Tier } from "@/lib/ai/groq";
import { extractJson } from "@/lib/ai/run";
import { articles, type Article, type Block } from "@/lib/docs";
import { entries as changelogEntries } from "@/lib/changelog";
import { slugify } from "@/lib/utils";
import { run } from "./_util";

export type TriagePriority = "urgent" | "high" | "normal" | "low";
export type TriageCategory = "Bug" | "Billing" | "Setup" | "Access" | "Feature" | "Question";

export type SupportReplyDraft = {
  reply: string;
  category: TriageCategory;
  priority: TriagePriority;
  suggestedDocSlugs: string[];
};

export type TriageItem = {
  id: string;
  priority: TriagePriority;
  category: TriageCategory;
  summary: string;
};

export type ChangelogChannel = "all" | "linkedin" | "x" | "facebook" | "email";

export type ChangelogPostsDraft = {
  version: string;
  date: string;
  highlight: string;
  linkedin?: string;
  x?: string[];
  facebook?: string;
  email?: {
    subject: string;
    previewText: string;
    body: string;
  };
};

export type IndustryLandingDraft = {
  industry: string;
  metaTitle: string;
  metaDescription: string;
  headline: string;
  subheadline: string;
  painPoints: { title: string; detail: string }[];
  workflows: { title: string; detail: string; feature: string }[];
  faqs: { question: string; answer: string }[];
  markdown: string;
};

export type CaseStudyDraft = {
  testimonialId: string;
  title: string;
  challenge: string;
  solution: string;
  outcomes: string[];
  pullQuote: string;
  attribution: string;
  markdown: string;
};

const PRIORITY_ENUM = z.enum(["urgent", "high", "normal", "low"]);
const CATEGORY_ENUM = z.enum(["Bug", "Billing", "Setup", "Access", "Feature", "Question"]);

const VALID_DOC_SLUGS = new Set(articles.map((a) => a.slug));

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "have", "what", "how", "does",
  "are", "can", "you", "your", "our", "about", "into", "will", "there", "their", "they",
  "when", "where", "which", "who", "why", "not", "but", "was", "were", "been", "just",
]);

function scrubSecrets(text: string): string {
  return text
    .replace(/oo_live_[A-Za-z0-9_-]+/g, "[REDACTED_API_KEY]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/(password|passcode|secret|token)\s*[:=]\s*\S+/gi, "$1: [REDACTED]");
}

function blockToText(b: Block): string {
  switch (b.t) {
    case "p":
    case "h":
    case "note":
      return b.v;
    case "ol":
    case "ul":
      return b.v.join(" ");
    case "table":
      return [b.head.join(" | "), ...b.rows.map((r) => r.join(" | "))].join("; ");
  }
}

function matchHelpArticles(query: string, limit = 5): Article[] {
  const tokens = Array.from(
    new Set(
      query
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(" ")
        .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
    )
  );
  if (!tokens.length) return articles.slice(0, limit);

  const scored = articles.map((a) => {
    const title = a.title.toLowerCase();
    const slug = a.slug.toLowerCase();
    const summary = a.summary.toLowerCase();
    const body = a.body.map(blockToText).join(" ").toLowerCase();
    let score = 0;
    for (const t of tokens) {
      if (title.includes(t)) score += 6;
      if (slug.includes(t)) score += 5;
      if (summary.includes(t)) score += 3;
      if (body.includes(t)) score += 1;
    }
    return { a, score };
  });

  const hits = scored
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map((x) => x.a);

  return hits.length ? hits : articles.slice(0, 3);
}

async function askValidatedJson<T>(opts: {
  tier: Tier;
  system: string;
  user: string;
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  maxTokens?: number;
  temperature?: number;
}): Promise<T> {
  if (!aiConfigured()) throw new AiError("not_configured");
  let lastProblem = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const { text } = await chat({
      tier: opts.tier,
      json: true,
      maxTokens: opts.maxTokens ?? 2000,
      temperature: opts.temperature ?? 0.3,
      system: opts.system,
      user:
        attempt === 0
          ? opts.user
          : `${opts.user}\n\nYour previous reply could not be parsed (${lastProblem}). Return a valid JSON object matching the exact schema only.`,
    });
    try {
      const parsed = opts.schema.safeParse(extractJson(text));
      if (parsed.success) return parsed.data;
      lastProblem = parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
        .join("; ");
    } catch {
      lastProblem = "invalid JSON";
    }
  }
  throw new AiError("bad_output");
}

/* ---------------- 1. Support Inbox: Suggested Reply ---------------- */

const supportReplySchema = z.object({
  reply: z.string().trim().min(10).max(5000),
  category: CATEGORY_ENUM,
  priority: PRIORITY_ENUM,
  suggestedDocSlugs: z.array(z.string().trim()).optional().default([]),
});

export async function draftSupportReplyAction(requestId: string) {
  return run(async (): Promise<SupportReplyDraft> => {
    const staff = await requireStaff(SUPPORT_STAFF);
    const id = z.string().trim().min(1).max(100).parse(requestId);

    const req = await prisma.supportRequest.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!req) throw new Error("Support request not found.");

    const ref = req.id.slice(-8).toUpperCase();
    const workspace = req.workspaceId
      ? await prisma.workspace.findUnique({ where: { id: req.workspaceId }, select: { name: true } })
      : null;

    const historyText = req.messages
      .slice(-8)
      .map((m) => {
        const label = m.kind === "NOTE" ? `Internal staff note (${m.authorName})` : `Staff reply (${m.authorName})`;
        return `${label}: ${scrubSecrets(m.body).slice(0, 1000)}`;
      })
      .join("\n\n");

    const cleanMessage = scrubSecrets(req.message).slice(0, 2500);
    const matched = matchHelpArticles(`${req.topic} ${cleanMessage}`, 5);
    const docsContext = matched
      .map((a) => {
        const plain = a.body.map(blockToText).join("\n");
        const clipped = plain.length > 1300 ? `${plain.slice(0, 1300)}...` : plain;
        return `- Slug: ${a.slug} | Title: ${a.title} | URL: https://www.onboardops.org/support/${a.slug}\n  Summary: ${a.summary}\n  Details: ${clipped}`;
      })
      .join("\n\n");

    const allSlugs = articles.map((a) => `${a.slug} (${a.title})`).join(", ");

    const system = `You help OnboardOps support staff draft clear, empathetic, accurate email replies to customers.

RULES:
- Ground every product instruction strictly in the provided OnboardOps help articles. Never invent features, settings, or pricing tiers (OnboardOps is free during beta).
- Never give legal, HR, or compliance advice.
- Never ask the customer to send a password, backup code, or sensitive employee data.
- Never promise fixed SLAs or instant bug fixes; speak plainly and honestly.
- Write a ready-to-review plain-text email body addressed to the customer's first name and signed off simply as "Best,\nOnboardOps Support" (do not include a Subject line).
- Include helpful https://www.onboardops.org/support/<slug> links when relevant.
- Return ONLY a JSON object with shape:
{
  "reply": "plain text email body",
  "category": "Bug" | "Billing" | "Setup" | "Access" | "Feature" | "Question",
  "priority": "urgent" | "high" | "normal" | "low",
  "suggestedDocSlugs": ["slug-1", "slug-2"]
}
Only include slugs from the available docs list in suggestedDocSlugs (max 3).`;

    const user = [
      `REQUEST REF: ${ref}`,
      `CUSTOMER NAME: ${req.name}`,
      `TOPIC: ${req.topic}`,
      `SOURCE: ${req.source}`,
      `STATUS: ${req.status}`,
      `WORKSPACE: ${workspace?.name ?? "Not linked"}`,
      "",
      "CUSTOMER MESSAGE:",
      cleanMessage,
      historyText ? `\nPRIOR THREAD:\n${historyText}` : "",
      "",
      "MATCHED HELP DOCS:",
      docsContext,
      "",
      `ALL VALID DOC SLUGS: ${allSlugs}`,
    ]
      .filter(Boolean)
      .join("\n");

    const draft = await askValidatedJson({
      tier: "smart",
      system,
      user,
      schema: supportReplySchema,
      maxTokens: 1600,
      temperature: 0.3,
    });

    const suggestedDocSlugs = Array.from(
      new Set((draft.suggestedDocSlugs ?? []).filter((s) => VALID_DOC_SLUGS.has(s)))
    ).slice(0, 3);

    const result: SupportReplyDraft = {
      reply: draft.reply,
      category: draft.category,
      priority: draft.priority,
      suggestedDocSlugs,
    };

    await staffAudit(prisma, staff, {
      action: "AI_SUPPORT_DRAFT",
      targetType: "SupportRequest",
      targetId: req.id,
      workspaceId: req.workspaceId,
      summary: `Drafted AI support reply for request ${ref} (${result.priority} / ${result.category})`,
      metadata: {
        priority: result.priority,
        category: result.category,
        suggestedDocSlugs: result.suggestedDocSlugs,
      },
    });

    return result;
  });
}

/* ---------------- 2. Support Inbox: AI Triage ---------------- */

const triageResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().trim().min(1),
      priority: PRIORITY_ENUM,
      category: CATEGORY_ENUM,
      summary: z.string().trim().min(2).max(160),
    })
  ),
});

export async function triageSupportInboxAction() {
  return run(async (): Promise<{ items: Record<string, TriageItem>; count: number }> => {
    const staff = await requireStaff(SUPPORT_STAFF);

    const openRequests = await prisma.supportRequest.findMany({
      where: {
        status: { not: "SOLVED" },
        NOT: { topic: "Privacy request" },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        topic: true,
        source: true,
        status: true,
        message: true,
        createdAt: true,
      },
    });

    if (openRequests.length === 0) {
      return { items: {}, count: 0 };
    }

    const validIds = new Set(openRequests.map((r) => r.id));
    const payload = openRequests.map((r) => ({
      id: r.id,
      ref: r.id.slice(-8).toUpperCase(),
      topic: r.topic,
      source: r.source,
      status: r.status,
      message: scrubSecrets(r.message).slice(0, 420),
    }));

    const system = `You triage open customer support requests for OnboardOps support staff.
Classify EVERY request in the list with:
- priority:
  - "urgent": security vulnerability/report, potential data loss, lockout blocking a team, outage, or safety/legal urgency
  - "high": broken core feature (sign-in, courses/quizzes, infractions, emails, custom domain) or blocking workflow bug
  - "normal": setup help, how-to question, billing/pricing question, minor bug with workaround
  - "low": general feedback, nice-to-have feature idea, casual inquiry
- category: one of "Bug", "Billing", "Setup", "Access", "Feature", "Question"
- summary: concise 5–14 word plain-English summary of what the user needs (no personal data)

Return ONLY a JSON object:
{
  "items": [{ "id": "...", "priority": "urgent|high|normal|low", "category": "Bug|Billing|Setup|Access|Feature|Question", "summary": "..." }]
}`;

    const parsed = await askValidatedJson({
      tier: "fast",
      system,
      user: `OPEN REQUESTS (${payload.length}):\n${JSON.stringify(payload)}`,
      schema: triageResponseSchema,
      maxTokens: 2500,
      temperature: 0.1,
    });

    const map: Record<string, TriageItem> = {};
    for (const item of parsed.items) {
      if (!validIds.has(item.id)) continue;
      map[item.id] = {
        id: item.id,
        priority: item.priority,
        category: item.category,
        summary: item.summary,
      };
    }

    const count = Object.keys(map).length;
    await staffAudit(prisma, staff, {
      action: "AI_SUPPORT_TRIAGE",
      targetType: "SupportRequest",
      targetId: "inbox",
      summary: `AI-triaged ${count} open support request(s)`,
      metadata: { count },
    });

    return { items: map, count };
  });
}

/* ---------------- 3. Content Studio: Changelog -> Posts ---------------- */

const changelogInputSchema = z.object({
  version: z.string().trim().min(1, "Choose a release version").max(32),
  channel: z.enum(["all", "linkedin", "x", "facebook", "email"]).default("all"),
  extraNotes: z.string().trim().max(1000).optional(),
});

const changelogOutputSchema = z.object({
  linkedin: z.string().trim().min(20).max(3000).optional(),
  x: z.array(z.string().trim().min(10).max(280)).min(1).max(4).optional(),
  facebook: z.string().trim().min(20).max(2500).optional(),
  email: z
    .object({
      subject: z.string().trim().min(4).max(160),
      previewText: z.string().trim().min(4).max(200),
      body: z.string().trim().min(40).max(5000),
    })
    .optional(),
});

export async function draftChangelogPostsAction(input: unknown) {
  return run(async (): Promise<ChangelogPostsDraft> => {
    const staff = await requireStaff(SUPPORT_STAFF);
    const d = changelogInputSchema.parse(input);

    const rel = changelogEntries.find((e) => e.v === d.version);
    if (!rel) throw new Error(`Release v${d.version} was not found in the changelog.`);

    const requestedChannels =
      d.channel === "all" ? ["linkedin", "x", "facebook", "email"] : [d.channel];

    const shapeHint =
      d.channel === "all"
        ? `{ "linkedin": "string", "x": ["post 1 (<=280 chars)", "post 2 (<=280 chars)"], "facebook": "string", "email": { "subject": "string", "previewText": "string", "body": "string" } }`
        : d.channel === "x"
          ? `{ "x": ["post 1 (<=280 chars)", "post 2 (<=280 chars)"] }`
          : d.channel === "email"
            ? `{ "email": { "subject": "string", "previewText": "string", "body": "string" } }`
            : `{ "${d.channel}": "string" }`;

    const system = `You write crisp, practical product release announcements for OnboardOps (staff onboarding, training quizzes, discipline records, checklists and audit logs for shift-based teams; free during beta at https://www.onboardops.org).

RULES:
- Ground every claim STRICTLY in the changelog entry provided. Do NOT invent unshipped features, fake metrics, or customer quotes.
- Write in clear, grounded, practical English — zero hype clichés, no buzzword fluff.
- For LinkedIn: 2–4 short scannable paragraphs + concise bullet points + CTA to https://www.onboardops.org/changelog.
- For X/Twitter: 1 to 3 concise posts, EVERY post strictly under 280 characters.
- For Facebook: friendly, clear update for operations managers and small-business owners.
- For Email Newsletter: clear subject line, short previewText, and warm scannable body with bullets and link to https://www.onboardops.org/changelog.
- Only include the requested channel key(s): ${requestedChannels.join(", ")}.
- Return ONLY a valid JSON object matching: ${shapeHint}`;

    const user = [
      `RELEASE: v${rel.v} (${rel.date})`,
      rel.highlight ? `HIGHLIGHT: ${rel.highlight}` : "",
      rel.bullets?.length ? `SUMMARY BULLETS:\n- ${rel.bullets.join("\n- ")}` : "",
      `FULL CHANGELOG ITEMS:\n- ${rel.items.join("\n- ")}`,
      d.extraNotes ? `\nSTAFF ANGLE / EXTRA NOTES:\n${d.extraNotes}` : "",
      `\nREQUESTED CHANNEL(S): ${requestedChannels.join(", ")}`,
    ]
      .filter(Boolean)
      .join("\n");

    const schema = changelogOutputSchema.superRefine((val, ctx) => {
      for (const ch of requestedChannels) {
        if (ch === "linkedin" && !val.linkedin) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["linkedin"], message: "Missing linkedin draft" });
        if (ch === "x" && !val.x?.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["x"], message: "Missing x posts" });
        if (ch === "facebook" && !val.facebook) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["facebook"], message: "Missing facebook draft" });
        if (ch === "email" && !val.email) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["email"], message: "Missing email draft" });
      }
    });

    const out = await askValidatedJson({
      tier: "smart",
      system,
      user,
      schema,
      maxTokens: 2400,
      temperature: 0.4,
    });

    await staffAudit(prisma, staff, {
      action: "AI_CONTENT_CHANGELOG",
      targetType: "Changelog",
      targetId: rel.v,
      summary: `Drafted ${d.channel} changelog post(s) for v${rel.v}`,
      metadata: { version: rel.v, channel: d.channel },
    });

    return {
      version: rel.v,
      date: rel.date,
      highlight: rel.highlight ?? rel.items[0] ?? "",
      linkedin: out.linkedin,
      x: out.x,
      facebook: out.facebook,
      email: out.email,
    };
  });
}

/* ---------------- 4. Content Studio: Industry Landing Page ---------------- */

const landingInputSchema = z.object({
  industry: z.string().trim().min(2, "Enter an industry name").max(120),
  teamSize: z.string().trim().max(80).optional(),
  painPoints: z.string().trim().max(1000).optional(),
});

const landingOutputSchema = z.object({
  metaTitle: z.string().trim().min(10).max(90),
  metaDescription: z.string().trim().min(30).max(200),
  headline: z.string().trim().min(8).max(140),
  subheadline: z.string().trim().min(20).max(320),
  painPoints: z
    .array(z.object({ title: z.string().trim().min(3).max(90), detail: z.string().trim().min(15).max(320) }))
    .length(3),
  workflows: z
    .array(
      z.object({
        title: z.string().trim().min(3).max(90),
        feature: z.string().trim().min(2).max(60),
        detail: z.string().trim().min(15).max(360),
      })
    )
    .length(4),
  faqs: z
    .array(z.object({ question: z.string().trim().min(8).max(160), answer: z.string().trim().min(20).max(500) }))
    .length(3),
});

function formatLandingMarkdown(industry: string, d: z.infer<typeof landingOutputSchema>): string {
  const lines = [
    `---`,
    `title: "${d.metaTitle.replace(/"/g, '\\"')}"`,
    `description: "${d.metaDescription.replace(/"/g, '\\"')}"`,
    `industry: "${industry.replace(/"/g, '\\"')}"`,
    `---`,
    ``,
    `# ${d.headline}`,
    ``,
    d.subheadline,
    ``,
    `> Free during beta — no credit card required. [Create a workspace](/register) · [Watch the 2-minute tutorial](/tutorial)`,
    ``,
    `## Why ${industry} teams outgrow spreadsheets and paper binders`,
    ``,
    ...d.painPoints.flatMap((p) => [`### ${p.title}`, ``, p.detail, ``]),
    `## How OnboardOps fits ${industry} operations`,
    ``,
    ...d.workflows.flatMap((w) => [`### ${w.title} (${w.feature})`, ``, w.detail, ``]),
    `## Frequently asked questions`,
    ``,
    ...d.faqs.flatMap((f) => [`### ${f.question}`, ``, f.answer, ``]),
  ];
  return lines.join("\n").trim();
}

export async function draftIndustryLandingAction(input: unknown) {
  return run(async (): Promise<IndustryLandingDraft> => {
    const staff = await requireStaff(SUPPORT_STAFF);
    const d = landingInputSchema.parse(input);

    const system = `You write grounded, plain-English SaaS industry landing page copy for OnboardOps ("Write it once. Prove it forever.").

ACTUAL ONBOARDOPS CAPABILITIES (ONLY reference these real features):
- Staff Directory & Employee Dossiers with department/job-role auto-enrollment and CSV import
- Training Academy: Markdown lessons, YouTube/Vimeo video links, minimum read timers, server-graded quizzes, retake cooldowns, printable certificate codes (CERT-#####), compliance matrix, due-date reminders, and expiring certificate auto-re-enrollment
- Infraction & Discipline Ledger: verbal/written warnings, strike points, automatic remedial training & suspension thresholds, append-only case timelines, confidential manager notes hidden from employees/supervisors, employee typed-name acknowledgment, appeals, and printable PDF dossiers
- Policies & Handbooks: Markdown or PDF upload, versioned re-acknowledgment, signature tracking, printable sign-off sheets
- Shift Operations: Opening/mid/closing shift checklists with supervisor verification & photos, shift handoff notes, optional shift scheduling, time clock & payroll CSV export, equipment sign-out
- Incident Reports & Credentials: Near-miss/injury/hazard reporting (including anonymous option), credential/license expiry tracking (30-day alerts), employee documents with restricted I-9 access
- Security & Audit: Role-based server checks, AES-256-GCM encryption for sensitive notes and files with per-workspace keys, tamper-evident keyed SHA-256 hash-chained audit log, webhooks (Discord/Slack/Teams), free during beta (no credit card)

STRICT RULES:
- Never invent unbuilt features (e.g., payroll tax filing, background checks, biometric clocks) or claim SOC 2 / HIPAA / ISO certifications.
- Never fabricate customer statistics, percentages, or ROI numbers.
- Return ONLY a valid JSON object matching:
{
  "metaTitle": "SEO title (~50-60 chars)",
  "metaDescription": "SEO description (~130-155 chars)",
  "headline": "clear benefit-led H1",
  "subheadline": "1-2 crisp sentences tailored to the industry",
  "painPoints": [3 items: { "title": "...", "detail": "..." }],
  "workflows": [4 items: { "title": "...", "feature": "short OnboardOps module name", "detail": "..." }],
  "faqs": [3 items: { "question": "...", "answer": "..." }]
}`;

    const user = [
      `TARGET INDUSTRY: ${d.industry}`,
      d.teamSize ? `TYPICAL TEAM SIZE: ${d.teamSize}` : "",
      d.painPoints ? `SPECIFIC PAIN POINTS / NOTES:\n${d.painPoints}` : "",
      "",
      "Draft the complete industry landing page JSON.",
    ]
      .filter(Boolean)
      .join("\n");

    const out = await askValidatedJson({
      tier: "smart",
      system,
      user,
      schema: landingOutputSchema,
      maxTokens: 2400,
      temperature: 0.4,
    });

    const markdown = formatLandingMarkdown(d.industry, out);

    await staffAudit(prisma, staff, {
      action: "AI_CONTENT_LANDING",
      targetType: "ContentDraft",
      targetId: slugify(d.industry),
      summary: `Drafted industry landing page copy for ${d.industry}`,
      metadata: { industry: d.industry },
    });

    return {
      industry: d.industry,
      ...out,
      markdown,
    };
  });
}

/* ---------------- 5. Content Studio: Testimonial -> Case Study ---------------- */

const caseStudyInputSchema = z.object({
  testimonialId: z.string().trim().min(1, "Select a testimonial").max(100),
  extraContext: z.string().trim().max(1200).optional(),
});

const caseStudyOutputSchema = z.object({
  title: z.string().trim().min(8).max(140),
  challenge: z.string().trim().min(30).max(900),
  solution: z.string().trim().min(30).max(1000),
  outcomes: z.array(z.string().trim().min(8).max(240)).min(2).max(5),
  pullQuote: z.string().trim().min(10).max(700),
});

export async function draftCaseStudyAction(input: unknown) {
  return run(async (): Promise<CaseStudyDraft> => {
    const staff = await requireStaff(SUPPORT_STAFF);
    const d = caseStudyInputSchema.parse(input);

    const t = await prisma.testimonial.findUnique({
      where: { id: d.testimonialId },
      select: { id: true, quote: true, name: true, jobTitle: true, company: true, rating: true },
    });
    if (!t) throw new Error("Testimonial not found.");

    const attribution = [t.name, t.jobTitle, t.company].filter(Boolean).join(", ");

    const system = `You turn a verified customer testimonial into a concise, honest mini case study draft for OnboardOps marketing staff to review and edit.

STRICT RULES:
1. NEVER invent numbers, percentages, hours saved, cost savings, headcount, or timeframes that are NOT explicitly stated in the testimonial or staff context.
2. NEVER fabricate extra quotes. Keep "pullQuote" faithful to the customer's actual testimonial wording (either the full quote or a clean direct excerpt from it).
3. Keep the tone practical, modest, and credible — focus on real operational workflow improvements implied directly by what the customer said.
4. Where a detail isn't known, keep it concise and qualitative rather than guessing specifics.
5. Return ONLY a valid JSON object matching:
{
  "title": "concise case study title",
  "challenge": "1 short paragraph describing the operational challenge",
  "solution": "1 short paragraph describing how they use OnboardOps",
  "outcomes": ["2 to 4 qualitative outcome bullets grounded strictly in the quote/context"],
  "pullQuote": "exact quote or direct excerpt from the testimonial"
}`;

    const user = [
      `CUSTOMER NAME: ${t.name}`,
      t.jobTitle ? `JOB TITLE: ${t.jobTitle}` : "",
      t.company ? `COMPANY: ${t.company}` : "",
      t.rating ? `RATING: ${t.rating}/5` : "",
      `ORIGINAL QUOTE:\n"${t.quote}"`,
      d.extraContext ? `\nVERIFIED STAFF CONTEXT:\n${d.extraContext}` : "",
      "",
      "Draft the mini case study JSON strictly without inventing any fake metrics.",
    ]
      .filter(Boolean)
      .join("\n");

    const out = await askValidatedJson({
      tier: "smart",
      system,
      user,
      schema: caseStudyOutputSchema,
      maxTokens: 1800,
      temperature: 0.3,
    });

    const markdown = [
      `# ${out.title}`,
      ``,
      `**Customer:** ${attribution}`,
      t.rating ? `**Rating:** ${t.rating}/5` : "",
      ``,
      `## The challenge`,
      ``,
      out.challenge,
      ``,
      `## How they use OnboardOps`,
      ``,
      out.solution,
      ``,
      `## Key outcomes`,
      ``,
      ...out.outcomes.map((o) => `- ${o}`),
      ``,
      `> "${out.pullQuote.replace(/^["“]|["”]$/g, "")}"`,
      `> — ${attribution}`,
    ]
      .filter((line, idx, arr) => !(line === "" && arr[idx - 1] === ""))
      .join("\n")
      .trim();

    await staffAudit(prisma, staff, {
      action: "AI_CONTENT_CASE_STUDY",
      targetType: "Testimonial",
      targetId: t.id,
      summary: `Drafted mini case study from testimonial by ${t.name}${t.company ? ` (${t.company})` : ""}`,
      metadata: { testimonialId: t.id },
    });

    return {
      testimonialId: t.id,
      title: out.title,
      challenge: out.challenge,
      solution: out.solution,
      outcomes: out.outcomes,
      pullQuote: out.pullQuote.replace(/^["“]|["”]$/g, ""),
      attribution,
      markdown,
    };
  });
}
