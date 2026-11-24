import type { EmailBlock } from "./email-template";

export const ICONS = ["magic", "verify", "key", "invite", "welcome", "team", "book", "clock", "alert", "pen", "chat", "eye", "lock", "unlock", "seal", "calendar", "shield"] as const;
export type MailIcon = (typeof ICONS)[number];

export const CATEGORIES = [
  "Security & Incidents", "Legal & Policy", "Outages & Maintenance", "Product Updates", "Onboarding & Welcome",
  "Billing & Plans", "Customer Success", "Account & Access", "Compliance & Data",
] as const;
export type MailCategory = (typeof CATEGORIES)[number];

/** Product news and tips can be switched off by the reader. Security, legal, outage, account, billing and compliance notices cannot. */
export const OPTIONAL_CATEGORIES: string[] = ["Product Updates", "Customer Success", "Onboarding & Welcome"];

/** Filled in automatically when the email is sent. Everything else in {{double braces}} is a field the sender fills in. */
export const AUTO_VARS = ["name", "year", "app_url", "login_url", "status_url", "support_url", "security_url", "privacy_url", "terms_url", "changelog_url"] as const;

const VAR_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** The fields a sender still has to fill in, in the order they first appear. */
export function findVars(...texts: string[]): string[] {
  const seen: string[] = [];
  for (const t of texts) for (const m of t.matchAll(VAR_RE)) {
    const k = m[1].toLowerCase();
    if (!(AUTO_VARS as readonly string[]).includes(k) && !seen.includes(k)) seen.push(k);
  }
  return seen;
}

export function fillVars(text: string, vars: Record<string, string>): string {
  return text.replace(VAR_RE, (whole, k: string) => {
    const v = vars[k.toLowerCase()];
    return v === undefined || v === "" ? whole : v;
  });
}

/** Variables still unfilled after substitution. */
export function unfilled(text: string): string[] {
  return Array.from(new Set(Array.from(text.matchAll(VAR_RE), (m) => m[1].toLowerCase())));
}

const toneOf = (prefix: string): "info" | "warn" | "danger" | "ok" => (prefix === ">!!" ? "danger" : prefix === ">!" ? "warn" : prefix === ">+" ? "ok" : "info");

/**
 * Plain-text markup for the email body:
 *   blank line         starts a new paragraph
 *   ## Heading         a heading
 *   - item             a bullet list      1. item   a numbered list
 *   > text             a blue note        >! text   a warning      >!! text   an alert      >+ text   a success note
 *   [details]          then lines like "Label: value", shown as a card
 */
export function parseMarkup(body: string): EmailBlock[] {
  const out: EmailBlock[] = [];
  let para: string[] = [];
  let list: { t: "ul" | "ol"; v: string[] } | null = null;
  let details: [string, string][] | null = null;
  let callout: { tone: "info" | "warn" | "danger" | "ok"; v: string[] } | null = null;
  const flush = () => {
    if (para.length) out.push({ t: "p", v: para.join("\n") });
    if (list) out.push(list);
    if (details?.length) out.push({ t: "details", v: details });
    if (callout) out.push({ t: "callout", tone: callout.tone, v: callout.v.join("\n") });
    para = []; list = null; details = null; callout = null;
  };
  for (const raw of body.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const t = line.trim();
    if (!t) { flush(); continue; }
    if (/^##\s+/.test(t)) { flush(); out.push({ t: "h", v: t.replace(/^##\s+/, "") }); continue; }
    if (/^\[details\]$/i.test(t)) { flush(); details = []; continue; }
    if (details) {
      const m = t.match(/^([^:]{1,40}):\s*(.+)$/);
      if (m) { details.push([m[1].trim(), m[2].trim()]); continue; }
      flush();
    }
    const c = t.match(/^(>!!|>!|>\+|>)\s?(.*)$/);
    if (c) {
      const tone = toneOf(c[1]);
      if (!callout || callout.tone !== tone) { flush(); callout = { tone, v: [] }; }
      callout.v.push(c[2]);
      continue;
    }
    const li = t.match(/^[-*]\s+(.*)$/);
    const ol = t.match(/^\d+[.)]\s+(.*)$/);
    if (li || ol) {
      const kind = li ? "ul" : "ol";
      if (!list || list.t !== kind) { flush(); list = { t: kind, v: [] }; }
      list.v.push((li ?? ol)![1]);
      continue;
    }
    if (list || callout) flush();
    para.push(t);
  }
  flush();
  return out;
}
