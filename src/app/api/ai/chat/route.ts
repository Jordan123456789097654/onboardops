import { NextResponse } from "next/server";
import { z } from "zod";
import { AiError, aiConfigured, chat } from "@/lib/ai/groq";
import { extractJson } from "@/lib/ai/run";
import { articles, type Article, type Block } from "@/lib/docs";
import { notYet, securityGroups } from "@/lib/security-facts";
import { prisma } from "@/lib/prisma";
import { getActiveMembership } from "@/lib/auth";
import { entries as changelog } from "@/lib/changelog";
import { getSupportConfig, hoursStatus } from "@/lib/support-config";
import { bumpDaily, createTicket, refOf } from "@/lib/support";
import { clientIp, hit } from "@/lib/rate-limit";
import { hashChatToken, newChatToken } from "@/lib/chat-ticket";
import { buildOutageView } from "@/lib/incidents";
import { recordGap } from "@/lib/maya-ops";
import { legalPages } from "@/lib/site";
import { posts } from "@/lib/blog";
import { playbooks } from "@/lib/playbooks";
import { guides } from "@/lib/migrate";

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
const LEGAL_PATHS = new Set(["/legal", ...legalPages.map((p) => p.href)]);
const BLOG_SLUGS = new Set(posts.map((p) => p.slug));
const PLAYBOOK_SLUGS = new Set(playbooks.map((p) => p.slug));
const MIGRATE_SLUGS = new Set(guides.map((g) => g.slug));
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
  "/newsletter",
  "/team",
  "/feedback",
  "/roadmap",
  "/faq",
  "/register",
  "/login",
  "/tools",
  "/tools/discipline-ladder",
  "/tools/handbook-outline",
  "/tools/policy-builder",
  "/tools/should-i-write-this-up",
  "/tools/write-up-helper",
  "/playbooks",
  "/migrate",
  "/launch",
  "/verify",
  "/about",
  "/blog",
  "/partners",
  "/careers",
  "/contact",
  "/brand",
  "/story",
  "/founder",
  "/legal",
]);

/** Every page Maya may link to, grouped for the prompt so she knows what exists. */
function linkableFacts(): string {
  const legal = legalPages.map((p) => `${p.label} (${p.href})`).join("; ");
  return [
    "",
    "=== PAGES YOU CAN LINK TO (use these exact paths) ===",
    "Main pages: /pricing, /features, /solutions, /why, /security, /security/summary, /changelog, /roadmap, /faq, /about, /story, /team, /partners, /careers, /contact, /tutorial, /register, /login, /tools",
    "Free tools: /tools/discipline-ladder, /tools/handbook-outline, /tools/policy-builder, /tools/should-i-write-this-up, /tools/write-up-helper",
    `Legal pages (link them; never restate their wording): ${legal}`,
    `Help articles: ${articles.map((a) => `/support/${a.slug} (${a.title})`).join("; ")}`,
    `Blog posts: ${posts.map((p) => `/blog/${p.slug} (${p.title})`).join("; ")}`,
    `Playbooks: ${playbooks.map((p) => `/playbooks/${p.slug} (${p.title})`).join("; ")}`,
    `Migration guides: ${guides.map((g) => `/migrate/${g.slug} (${g.title})`).join("; ")}`,
    "Use a link whenever it helps the visitor. Put it in your reply as a plain path like /legal/beta-terms, and also add it to suggestedLinks.",
  ].join("\n");
}

function isAllowedHref(href: string): boolean {
  if (href === "https://status.onboardops.org" || href.startsWith("https://status.onboardops.org/")) {
    return true;
  }
  if (!href.startsWith("/") || href.startsWith("//") || !/^\/[a-zA-Z0-9/_-]*$/.test(href)) {
    return false;
  }
  if (href.startsWith("/support/")) return VALID_DOC_SLUGS.has(href.slice("/support/".length));
  if (href.startsWith("/blog/")) return BLOG_SLUGS.has(href.slice("/blog/".length));
  if (href.startsWith("/playbooks/")) return PLAYBOOK_SLUGS.has(href.slice("/playbooks/".length));
  if (href.startsWith("/migrate/")) return MIGRATE_SLUGS.has(href.slice("/migrate/".length));
  if (LEGAL_PATHS.has(href)) return true;
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
      `First name (use it warmly): ${m.user.name.trim().split(/\s+/)[0]}`,
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

/** Who is signed in, for the greeting and for automatic hand-off. Null when nobody is signed in. */
async function signedInUser(): Promise<{ id: string; name: string; email: string; firstName: string } | null> {
  try {
    const m = await getActiveMembership();
    if (!m) return null;
    return { id: m.userId, name: m.user.name, email: m.user.email, firstName: m.user.name.trim().split(/\s+/)[0] || "there" };
  } catch {
    return null;
  }
}

/** The live status from the status page data: is anything down right now, and what the latest public update says. */
async function liveStatusFacts(): Promise<string> {
  try {
    const v = await buildOutageView();
    if (!v.active && v.incidents.length === 0) {
      return "=== LIVE STATUS ===\nAll OnboardOps services are operating normally right now. If someone reports a problem, don't assume it's on our side. Ask what they see, and point them to https://status.onboardops.org.";
    }
    const lines = v.incidents.slice(0, 3).map((i) => {
      const latest = i.updates?.[0];
      return `- ${i.name} (${i.status}${i.startedAt ? `, started ${i.startedAt}` : ""})${latest ? `. Latest update: ${latest.message}` : ""}`;
    });
    return [
      "=== LIVE STATUS (we are aware of this right now) ===",
      v.incidents.length ? lines.join("\n") : `Services currently affected: ${v.services.join(", ") || "some services"}.`,
      "When a visitor asks about login, data, errors or slowness, open with 'We're aware of an outage right now' and share only what the status page says. Do not guess at causes, do not describe any security incident beyond what the status page says, and point them to https://status.onboardops.org for the latest update.",
    ].join("\n");
  } catch {
    return "";
  }
}

const SYSTEM_PROMPT = `You are Maya, the OnboardOps support assistant. You are warm, kind, patient and genuinely glad to help. You feel like a caring, knowledgeable teammate who makes people feel looked after, not a corporate FAQ bot.

Your personality:
- Greet people by first name when you know it, and make it feel personal ("Hi Sam, good to see you!"). Never use a name you weren't given.
- Be warm and encouraging. Acknowledge feelings first when someone is stressed or frustrated ("I'm sorry this is getting in your way, let's sort it out together.").
- Keep it human and easy to scan. Short paragraphs, plain English, bullet points for steps.
- Reply in the same language the visitor writes in. If they write in Spanish, answer in Spanish, and so on for any language.
- When you don't know something, say so kindly and offer to get a teammate on it.
- Never sound robotic, never pad with filler, and never repeat yourself.

STRICT RULES (never break these):
1. Answer ONLY using the public help docs, pricing summary, security facts, live status and account facts provided in the prompt. Never invent features, prices, timelines or claims.
2. NEVER claim SOC 2, ISO 27001, HIPAA, or any certification not explicitly stated in the context.
3. NEVER give legal, HR, compliance, employment-law or security advice as fact. Say you can't give that advice and point to the right page or a teammate.
4. NEVER promise refunds, outcomes, dates or fixes that the team hasn't confirmed. Only share what the live status or docs say.
5. You see only the signed-in visitor's own account facts. You cannot change accounts or see anyone else's data, employee records or case text. For account changes or problems, escalate.
6. If live status shows an incident, open by acknowledging it ("We're aware of an outage right now...") and share only what the status page says.
7. Keep replies concise: a couple of sentences or short bullets is usually perfect. If the docs don't cover it, be honest, point to /support, and escalate.
8. Reply with ONLY a valid JSON object:
{
  "reply": "warm, helpful plain-text answer",
  "escalate": true or false,
  "suggestedLinks": [{ "label": "short link label", "href": "/path or https://status.onboardops.org" }]
}
Set escalate to true when: the visitor asks for a person, needs an account change, reports a bug or outage, is upset or in distress, or asks something you can't answer confidently. When you escalate, say something like "I've passed this to a teammate and they'll pick it up from here. You won't need to repeat yourself." Do not ask the visitor for their name or email; their details are handled for them.
Include at most 3 relevant links. Every href MUST be a path from the context (like "/pricing", "/support/<slug>") or "https://status.onboardops.org".`;

export async function POST(req: Request) {
  if (!aiConfigured()) {
    return NextResponse.json(
      { error: "The website assistant is not available right now. Browse /support for help." },
      { status: 503 }
    );
  }

  // Abuse and cost protection. Normal visitors ask a handful of questions, so these are generous for people and hard on bots.
  if (Number(req.headers.get("content-length") ?? 0) > 24_000) {
    return NextResponse.json({ error: "That message is too large." }, { status: 413 });
  }
  const wait = await hit(`ai-chat:ip:${clientIp(req.headers)}`, 60, 3600);
  if (wait) {
    return NextResponse.json({ error: "You've asked a lot of questions in a short time. Please try again a bit later, or talk to a person." }, { status: 429, headers: { "Retry-After": String(wait) } });
  }
  if (await hit("ai-chat:global-day", 6000, 86400)) {
    return NextResponse.json({ error: "The assistant has reached its daily limit. Browse /support or talk to a person." }, { status: 503 });
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

  const cfg = await getSupportConfig();
  const hours = hoursStatus(cfg);
  const hoursLine = `\n\n=== SUPPORT TEAM RIGHT NOW ===\n${hours.open ? "The support team is online." : `The support team is away${hours.nextOpenLabel ? `, back ${hours.nextOpenLabel}` : ""}. Tickets still reach them and they reply when back.`} Reply target: ${cfg.responseTarget}.`;
  if (messages.length === 1) await bumpDaily("chats");
  const me = await signedInUser();
  const knowledge = [buildPublicKnowledge(recentUserText), linkableFacts(), await changelogAndLegal(), await liveStatusFacts(), await accountFacts(), hoursLine].join("\n");
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
      system: SYSTEM_PROMPT.replace(/Maya/g, cfg.brand.name),
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
      .slice(0, 4);

    await bumpDaily("aiReplies");
    if (out.data.escalate) await bumpDaily("escalations");

    // Signed-in people never have to fill in a form: when Maya hands off, the ticket is opened for them right away.
    let ticket: { id: string; token: string; ref: string } | null = null;
    if (out.data.escalate) {
      // Logged for the weekly report, so the docs can be improved where Maya couldn't help.
      const asked = [...messages].reverse().find((m) => m.role === "user")?.content;
      if (asked) await recordGap(asked);
    }
    if (out.data.escalate && me) {
      const lastQuestion = [...messages].reverse().find((m) => m.role === "user")?.content ?? "Asked to speak with support from the website chat.";
      const transcript = messages.slice(-6).map((m) => `${m.role === "user" ? "Visitor" : "Assistant"}: ${m.content}`).join("\n");
      const token = newChatToken();
      const req = await createTicket({
        name: me.name,
        email: me.email,
        topic: "Question",
        message: transcript ? `${lastQuestion}\n\n--- Chat with Maya before handoff ---\n${transcript}` : lastQuestion,
        source: "CHAT",
        chatTokenHash: hashChatToken(token),
        pageUrl: null,
      });
      ticket = { id: req.id, token, ref: refOf(req.id) };
    }

    return NextResponse.json({
      reply: out.data.reply,
      escalate: out.data.escalate,
      suggestedLinks,
      signedIn: !!me,
      firstName: me?.firstName ?? null,
      ticket,
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

/** Who is signed in, so Maya can greet them by name before they type anything. Returns no account details beyond the first name. */
export async function GET() {
  const me = await signedInUser();
  return NextResponse.json({ signedIn: !!me, firstName: me?.firstName ?? null }, { headers: { "Cache-Control": "no-store" } });
}
