import { NextResponse } from "next/server";
import { z } from "zod";
import { AiError, aiConfigured, chat } from "@/lib/ai/groq";
import { extractJson } from "@/lib/ai/run";
import { articles, type Article, type Block } from "@/lib/docs";
import { notYet, securityGroups } from "@/lib/security-facts";
import { clientIp, hit } from "@/lib/rate-limit";

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
  "/contact",
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
    "- Contact support (/contact): Contact form read Monday–Friday 9am–5pm ET (response target within 2 business days during beta). Do not send passwords or confidential employee records.",
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

const SYSTEM_PROMPT = `You are the OnboardOps website assistant helping prospective visitors learn about OnboardOps.

STRICT RULES:
1. Answer ONLY using the public help docs, pricing summary, and security facts provided in the prompt.
2. NEVER invent prices, paid tiers, SLAs, certifications (do NOT claim SOC 2, ISO 27001, or HIPAA compliance), or features not explicitly stated in the provided context.
3. NEVER give legal, HR, compliance, or employment-law advice. If asked for legal/HR advice, politely note that OnboardOps cannot provide legal or HR advice and suggest consulting qualified counsel.
4. NEVER pretend to inspect, look up, or change any user account, workspace, password, or employee record. You have zero access to customer accounts or databases. For account-specific issues, direct the visitor to /contact.
5. Keep replies concise, helpful, and easy to scan (2–5 sentences or short bullets). If the public docs do not cover a question, say so honestly and point to /support or /contact.
6. Reply with ONLY a valid JSON object matching:
{
  "reply": "string (clear plain-text answer)",
  "suggestedLinks": [{ "label": "short link label", "href": "/path or https://status.onboardops.org" }]
}
Include at most 3 relevant links in suggestedLinks. Every href MUST be a relative path starting with "/" from the provided context (such as "/pricing", "/tutorial", "/security", "/contact", "/support/<slug>") or "https://status.onboardops.org".`;

export async function POST(req: Request) {
  if (!aiConfigured()) {
    return NextResponse.json(
      { error: "The website assistant is not available right now. Browse /support or reach us at /contact." },
      { status: 503 }
    );
  }

  const wait = await hit(`vchat:${clientIp(req.headers)}`, 20, 3600);
  if (wait > 0) {
    const waitLabel = wait > 90 ? `${Math.ceil(wait / 60)} minutes` : `${wait} seconds`;
    return NextResponse.json(
      { error: `You have asked several questions this hour. Please try again in ${waitLabel}, or browse the help center at /support.` },
      { status: 429, headers: { "Retry-After": String(wait) } }
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

  const knowledge = buildPublicKnowledge(recentUserText);
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
