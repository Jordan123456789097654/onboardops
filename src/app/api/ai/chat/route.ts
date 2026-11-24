import { NextResponse } from "next/server";
import { z } from "zod";
import { AiError, aiConfigured, chat } from "@/lib/ai/groq";
import { extractJson } from "@/lib/ai/run";
import { articles, type Article, type Block } from "@/lib/docs";
import { notYet, securityGroups } from "@/lib/security-facts";
import { prisma } from "@/lib/prisma";
import { getActiveMembership } from "@/lib/auth";
import { entries as changelog } from "@/lib/changelog";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const msgSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(1200),
});

const reqSchema = z
  .object({
    messages: z.array(msgSchema).min(1).max(10),
  })
  .superRefine((val, ctx) => {
    const last = val.messages[val.messages.length - 1];
    if (!last || last.role !== "user") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Last message must be from the visitor." });
      return;
    }
    if (last.content.length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Please enter at least 2 characters." });
    }
    if (last.content.length > 600) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Please keep your question under 600 characters." });
    }
  });

const resSchema = z.object({
  reply: z.string().trim().min(1).max(3000),
  escalate: z.boolean().optional().default(false),
  suggestedLinks: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(80),
        href: z.string().trim().min(1).max(200),
      })
    )
    .optional()
    .default([]),
});

const STOP = new Set([
  "the", "and", "for", "with", "that", "this", "from", "have", "what", "how", "does",
  "are", "can", "you", "your", "our", "about", "into", "will", "there", "their", "they",
  "when", "where", "which", "who", "why", "not", "but", "use", "using", "work", "works",
]);

const VALID_DOC_SLUGS = new Set(articles.map((a) => a.slug));
const KNOWN_PUBLIC_PATHS = new Set([
  "/",
  "/pricing",
  "/tutorial",
  "/security",
  "/security/summary",
  "/support",
  "/features",
  "/solutions",
  "/why",
  "/changelog",
  "/roadmap",
  "/faq",
  "/register",
  "/login",
  "/tools",
  "/playbooks",
  "/migrate",
  "/launch",
  "/verify",
  "/about",
  "/blog",
  "/partners",
  "/careers",
  "/legal/privacy",
  "/legal/terms",
  "/legal/beta-terms",
  "/legal/data-processing",
  "/legal/cookies",
]);

function isAllowedHref(href: string): boolean {
  if (href === "https://status.onboardops.org" || href.startsWith("https://status.onboardops.org/")) {
    return true;
  }
  if (!href.startsWith("/") || href.startsWith("//") || !/^\/[a-zA-Z0-9/_-]*$/.test(href)) {
    return false;
  }
  if (href.startsWith("/support/")) {
    return VALID_DOC_SLUGS.has(href.slice("/support/".length));
  }
  return KNOWN_PUBLIC_PATHS.has(href);
}

function tokenize(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(" ")
        .map((w) => w.trim())
        .filter((w) => w.length >= 2 && !STOP.has(w))
    )
  );
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

function articlePlainText(a: Article): string {
  return a.body.map(blockToText).join("\n");
}

function tokenMatch(haystack: string, tok: string): boolean {
  if (haystack.includes(tok)) return true;
  if (tok.length >= 5 && haystack.includes(tok.slice(0, tok.length - 1))) return true;
  return false;
}

function rankArticles(queryText: string, limit = 6): Article[] {
  const tokens = tokenize(queryText);
  if (!tokens.length) return articles.slice(0, 4);

  const scored = articles.map((a) => {
    const title = a.title.toLowerCase();
    const slug = a.slug.toLowerCase();
    const summary = a.summary.toLowerCase();
    const cat = a.cat.toLowerCase();
    const body = articlePlainText(a).toLowerCase();

    let score = 0;
    for (const t of tokens) {
      if (tokenMatch(title, t)) score += 6;
      if (tokenMatch(slug, t)) score += 5;
      if (tokenMatch(summary, t)) score += 3;
      if (tokenMatch(cat, t)) score += 2;
      if (tokenMatch(body, t)) score += 1;
    }
    return { a, score };
  });

  const matched = scored
    .filter((s) => s.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map((s) => s.a);

  if (matched.length > 0) return matched;
  return articles.filter((a) => a.cat === "Getting started").slice(0, 4);
}

function buildPublicKnowledge(queryText: string): string {
  const topArticles = rankArticles(queryText, 6);
  const docsSection = topArticles
    .map((a) => {
      const text = articlePlainText(a);
      const clipped = text.length > 1400 ? `${text.slice(0, 1400)}...` : text;
      return `### ${a.title} (/support/${a.slug})\nCategory: ${a.cat}\nSummary: ${a.summary}\n${clipped}`;
    })
    .join("\n\n");

  const securityBullets = securityGroups
    .map((g) => `${g.title}: ${g.items.map(([k, v]) => `${k} — ${v}`).join(" | ")}`)
    .join("\n");

  return [
    "=== PRICING & PUBLIC PAGES ===",
    "- Pricing (/pricing): OnboardOps is currently $0 (free) during the beta for early teams — no credit card required, no trial clock, and no staff limit. Includes unlimited employees, departments and job roles; training builder with Markdown lessons, video links and server-graded quizzes; printable certificates and employee dossiers; infraction ledger with confidential manager notes and employee acknowledgment; shift checklists with supervisor verification; append-only hash-chained audit log; Discord, Slack and Microsoft Teams webhooks; and email notifications. If paid plans are introduced later, they will be announced in the changelog (/changelog) first. No uptime SLA is guaranteed during beta (see /legal/beta-terms).",
    "- Video tutorial (/tutorial): A 2-minute setup video covering the setup wizard, inviting staff, building your first course, discipline rules, Discord/Teams alerts, features and roles, and custom domains.",
    "- Help center (/support): Step-by-step guides across setup, roles, training, discipline, compliance, checklists, integrations, account and support.",
    "- Security (/security): Public overview of encryption, access controls and audit verification, plus a printable security summary at /security/summary.",
    "- Talking to a person: the chat bubble opens a support ticket. A teammate replies in the chat and by email. Support hours are Monday–Friday 9am–5pm ET, with a response target of 2 business days during beta. Never ask for passwords or confidential employee records.",
    "- System status (https://status.onboardops.org): Live uptime and incident status page.",
    "- Sign up (/register): Create a workspace for free.",
    "",
    "=== SECURITY & ENCRYPTION FACTS (/security) ===",
    securityBullets,
    `Not yet in place: ${notYet.join("; ")}. No system can be guaranteed 100% secure.`,
    "",
    "=== RELEVANT HELP ARTICLES ===",
    docsSection,
  ].join("\n");
}

/** Recent changelog entries and the list of legal pages. The legal text itself is linked, not paraphrased. */
async function changelogAndLegal(): Promise<string> {
  const recent = changelog.slice(0, 5).map((e) => `- v${e.v} (${e.date}): ${e.highlight ?? ""}. ${(e.bullets ?? e.items).join("; ")}`).join("\n");
  return [
    "",
    "=== RECENT RELEASES (/changelog) ===",
    recent,
    "",
    "=== LEGAL PAGES (link to them; do not restate their wording) ===",
    "Privacy Policy (/legal/privacy), Terms of Service (/legal/terms), Beta Terms (/legal/beta-terms), Data Processing Addendum (/legal/data-processing), Cookies (/legal/cookies). For any legal question, say you can't give legal advice and link the right page.",
  ].join("\n");
}

/** Only the signed-in visitor's own account facts: their name, role, workspace and their own support requests. Never other people's data. */
async function accountFacts(): Promise<string> {
  try {
    const m = await getActiveMembership();
    if (!m) return "";
    const tickets = await prisma.supportRequest.findMany({
      where: { userId: m.userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, topic: true, status: true, createdAt: true },
    });
    return [
      "",
      "=== SIGNED-IN USER (their own account only) ===",
      `Name: ${m.user.name}`,
      `Workspace: ${m.workspace.name}`,
      `Role in this workspace: ${m.role}`,
      "Plan: free beta (no paid plans yet).",
      tickets.length
        ? "Their recent support requests: " + tickets.map((t) => `#${t.id.slice(-8).toUpperCase()} ${t.topic} (${t.status})`).join("; ")
        : "Their recent support requests: none.",
      "Answer only about this user's own account. You cannot see other people's records, employee data or case text, and must say so if asked.",
    ].join("\n");
  } catch {
    return "";
  }
}

const SYSTEM_PROMPT = `You are Maya, the OnboardOps support assistant. You are warm, upbeat, and genuinely excited to help people get the most out of OnboardOps. You feel like a knowledgeable friend who works at the company — not a corporate FAQ bot.

Your personality:
- Use casual, natural language. It's okay to say "Great question!", "Absolutely!", "Happy to help with that!" or start with a friendly acknowledgement.
- Keep it human. Short paragraphs, plain English, no jargon. Use bullet points when listing steps or options.
- If someone seems frustrated, acknowledge it warmly before answering. ("That can be a bit confusing — here's the deal:")
- Use "you" and "your" freely. Make the person feel like you're talking directly to them.
- When you don't know something, say so cheerfully and connect them to someone who can help.

STRICT RULES (never break these):
1. Answer ONLY using the public help docs, pricing summary, and security facts provided in the prompt. Never invent features, prices, or claims.
2. NEVER claim SOC 2, ISO 27001, HIPAA, or any certification not explicitly stated in the context.
3. NEVER give legal, HR, compliance, or employment-law advice. If asked, say something like "I'm not qualified to give legal advice on that — definitely worth chatting with a lawyer. But I can point you to our docs!"
4. You can read only the signed-in visitor's own account facts when provided. You cannot change accounts or see other people's data. For account changes or problems, set escalate to true and offer to connect them with the team.
5. Keep replies concise and easy to scan — a couple of sentences or short bullets is usually perfect. If the docs don't cover it, be honest, point to /support, and set escalate to true.
6. Reply with ONLY a valid JSON object:
{
  "reply": "friendly, helpful plain-text answer",
  "escalate": true or false,
  "suggestedLinks": [{ "label": "short link label", "href": "/path or https://status.onboardops.org" }]
}
Set escalate to true when: the visitor asks for a person, needs an account change, asks something you can't answer confidently, or has a complaint/problem that needs human attention. Say something warm like "I'll get a teammate on this for you!" when escalating.
Include at most 3 relevant links. Every href MUST be a path from the context (like "/pricing", "/support/<slug>") or "https://status.onboardops.org".`;

export async function POST(req: Request) {
  if (!aiConfigured()) {
    return NextResponse.json(
      { error: "The website assistant is not available right now. Browse /support for help." },
      { status: 503 }
    );
  }

  const rawBody = await req.json().catch(() => null);
  const parsed = reqSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Please send a valid question." },
      { status: 400 }
    );
  }

  const { messages } = parsed.data;
  const recentUserText = messages
    .filter((m) => m.role === "user")
    .slice(-2)
    .map((m) => m.content)
    .join(" ");

  const knowledge = buildPublicKnowledge(recentUserText) + (await changelogAndLegal()) + (await accountFacts());
  const transcript = messages
    .map((m) => `${m.role === "user" ? "Visitor" : "Assistant"}: ${m.content}`)
    .join("\n");

  const userPrompt = `${knowledge}\n\n=== CONVERSATION ===\n${transcript}\n\nRespond to the visitor's latest question using ONLY the public facts above. Reply with JSON only.`;

  try {
    const { text } = await chat({
      tier: "fast",
      json: true,
      maxTokens: 700,
      temperature: 0.2,
      system: SYSTEM_PROMPT,
      user: userPrompt,
    });

    const out = resSchema.safeParse(extractJson(text));
    if (!out.success) {
      return NextResponse.json(
        { error: "I couldn't put together a clean answer for that. Try rephrasing, or check the help center." },
        { status: 502 }
      );
    }

    const seen = new Set<string>();
    const suggestedLinks = out.data.suggestedLinks
      .filter((l) => isAllowedHref(l.href))
      .filter((l) => {
        if (seen.has(l.href)) return false;
        seen.add(l.href);
        return true;
      })
      .slice(0, 3);

    return NextResponse.json({
      reply: out.data.reply,
      escalate: out.data.escalate,
      suggestedLinks,
    });
  } catch (e) {
    if (e instanceof AiError) {
      const status =
        e.code === "rate"
          ? 429
          : e.code === "timeout"
            ? 504
            : e.code === "bad_output"
              ? 502
              : 503;
      return NextResponse.json({ error: e.message }, { status });
    }
    return NextResponse.json(
      { error: "Something went wrong answering your question. Please try again or visit /support." },
      { status: 500 }
    );
  }
}
