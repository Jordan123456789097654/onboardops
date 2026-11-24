import type { EmailIcon } from "./email-assets";

/** Rich body content, rendered in order. Used by the staff console's email composer. */
export type EmailBlock =
  | { t: "p"; v: string }
  | { t: "h"; v: string }
  | { t: "ul"; v: string[] }
  | { t: "ol"; v: string[] }
  | { t: "details"; v: [string, string][] }
  | { t: "callout"; tone: "info" | "warn" | "danger" | "ok"; v: string };

export type EmailSpec = {
  icon: EmailIcon;
  /** Short line shown in inbox previews. */
  preheader: string;
  title: string;
  /** Plain paragraphs. */
  paragraphs: string[];
  /** Optional bullet list (for example required courses). */
  list?: string[];
  /** Label / value rows shown in a card. */
  details?: [string, string][];
  button?: { label: string; url: string };
  /** Small text under the button. */
  note?: string;
  align?: "center" | "left";
  /** When set, replaces paragraphs, list and details with these blocks, in order. */
  blocks?: EmailBlock[];
  /** An extra line in the footer, such as why the person got this email. */
  footer?: string;
  /** Adds an Unsubscribe link to the footer (newsletters). */
  unsubscribeUrl?: string;
};

const TONES = {
  info: { bg: "#eff6ff", border: "#1D4ED8", text: "#1e3a8a" },
  warn: { bg: "#fffbeb", border: "#d97706", text: "#78350f" },
  danger: { bg: "#fef2f2", border: "#dc2626", text: "#7f1d1d" },
  ok: { bg: "#f0fdf4", border: "#16a34a", text: "#14532d" },
} as const;

const baseUrl = () => process.env.APP_URL || "http://localhost:3000";

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const nl2br = (s: string) => esc(s).replace(/\n/g, "<br>");

/** Safe inline formatting for rich blocks: **bold** and [label](https://link). Everything else is escaped text. Only https and mailto links are allowed. */
const rich = (s: string) =>
  esc(s)
    .replace(/\[([^\]\n]{1,120})\]\((https:\/\/[^\s)]{1,400}|mailto:[^\s)]{1,200})\)/g, (_m, label: string, url: string) => `<a href="${url}" style="color:#1D4ED8;text-decoration:underline">${label}</a>`)
    .replace(/\*\*([^*\n]{1,200})\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
const plainInline = (s: string) => s.replace(/\[([^\]\n]{1,120})\]\(((?:https:\/\/|mailto:)[^\s)]{1,400})\)/g, "$1 ($2)").replace(/\*\*([^*\n]{1,200})\*\*/g, "$1");

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Builds a designed HTML email plus a plain-text twin. Images are referenced as cid: and attached by sendEmail. */
export function buildEmail(s: EmailSpec): { html: string; text: string } {
  const base = baseUrl();
  const align = s.align ?? "center";
  const p = s.paragraphs.map((t) => `<p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:#52525b" class="muted">${nl2br(t)}</p>`).join("");
  const list = s.list?.length ? `<ul style="margin:0 0 14px 0;padding:0 0 0 20px;text-align:left;font-size:15px;line-height:1.7;color:#27272a" class="body">${s.list.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "";
  const details = s.details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 20px 0;border:1px solid #e4e4e7;border-radius:10px;background:#fafafa" class="panel"><tbody>${s.details
        .map(([k, v], i) => `<tr><td style="padding:10px 14px;${i ? "border-top:1px solid #e4e4e7;" : ""}text-align:left"><div style="font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#71717a" class="muted">${esc(k)}</div><div style="margin-top:2px;font-size:14px;line-height:1.5;color:#18181b" class="body">${nl2br(v)}</div></td></tr>`)
        .join("")}</tbody></table>`
    : "";
  const blockHtml = (b: EmailBlock): string => {
    switch (b.t) {
      case "p": return `<p style="margin:0 0 14px 0;font-size:15px;line-height:1.65;color:#52525b;text-align:left" class="muted">${rich(b.v)}</p>`;
      case "h": return `<h2 class="title" style="margin:22px 0 8px 0;font-family:${FONT};font-size:17px;line-height:1.3;font-weight:700;letter-spacing:-.01em;color:#09090b;text-align:left">${esc(b.v)}</h2>`;
      case "ul": return `<ul style="margin:0 0 14px 0;padding:0 0 0 22px;text-align:left;font-size:15px;line-height:1.7;color:#27272a" class="body">${b.v.map((i) => `<li style="margin-bottom:4px">${rich(i)}</li>`).join("")}</ul>`;
      case "ol": return `<ol style="margin:0 0 14px 0;padding:0 0 0 22px;text-align:left;font-size:15px;line-height:1.7;color:#27272a" class="body">${b.v.map((i) => `<li style="margin-bottom:6px">${rich(i)}</li>`).join("")}</ol>`;
      case "details": return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 20px 0;border:1px solid #e4e4e7;border-radius:10px;background:#fafafa" class="panel"><tbody>${b.v.map(([k, v], i) => `<tr><td style="padding:10px 14px;${i ? "border-top:1px solid #e4e4e7;" : ""}text-align:left"><div style="font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#71717a" class="muted">${esc(k)}</div><div style="margin-top:2px;font-size:14px;line-height:1.5;color:#18181b" class="body">${nl2br(v)}</div></td></tr>`).join("")}</tbody></table>`;
      case "callout": { const c = TONES[b.tone]; return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px 0"><tr><td class="co-${b.tone}" style="padding:12px 16px;background:${c.bg};border-left:4px solid ${c.border};border-radius:6px;font-size:14px;line-height:1.6;color:${c.text};text-align:left">${rich(b.v)}</td></tr></table>`; }
    }
  };
  const blockText = (b: EmailBlock): string[] => {
    switch (b.t) {
      case "p": return [plainInline(b.v), ""];
      case "h": return [b.v.toUpperCase(), ""];
      case "ul": return [...b.v.map((i) => `- ${plainInline(i)}`), ""];
      case "ol": return [...b.v.map((i, n) => `${n + 1}. ${plainInline(i)}`), ""];
      case "details": return [...b.v.map(([k, v]) => `${k}: ${plainInline(v)}`), ""];
      case "callout": return [`>> ${plainInline(b.v)}`, ""];
    }
  };
  const button = s.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:8px auto 18px auto"><tr><td align="center" bgcolor="#1D4ED8" style="border-radius:8px"><a href="${esc(s.button.url)}" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">${esc(s.button.label)}</a></td></tr></table><p style="margin:0 0 18px 0;font-size:12px;line-height:1.5;color:#a1a1aa" class="muted">Button not working? Paste this link into your browser:<br><a href="${esc(s.button.url)}" style="color:#1D4ED8;word-break:break-all">${esc(s.button.url)}</a></p>`
    : "";
  const note = s.note ? `<p style="margin:0 0 6px 0;font-size:13px;line-height:1.6;color:#71717a" class="muted">${nl2br(s.note)}</p>` : "";

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${esc(s.title)}</title>
<style>
@media (prefers-color-scheme: dark){
  .page{background:#09090b !important}
  .card{background:#111113 !important;border-color:#27272a !important}
  .title,.body{color:#fafafa !important}
  .muted{color:#a1a1aa !important}
  .panel{background:#18181b !important;border-color:#27272a !important}
  .rule{border-color:#27272a !important}
  .co-info{background:#172554 !important;color:#bfdbfe !important}
  .co-warn{background:#451a03 !important;color:#fde68a !important}
  .co-danger{background:#450a0a !important;color:#fecaca !important}
  .co-ok{background:#052e16 !important;color:#bbf7d0 !important}
}
@media only screen and (max-width:600px){ .pad{padding-left:22px !important;padding-right:22px !important} }
</style></head>
<body class="page" style="margin:0;padding:0;background:#f4f4f5;font-family:${FONT}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(s.preheader)}&#8203;&zwnj;&#8203;&zwnj;&#8203;&zwnj;&#8203;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="page" style="background:#f4f4f5"><tr><td align="center" style="padding:32px 14px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" class="card" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #e4e4e7;border-radius:14px">
<tr><td align="center" class="pad" style="padding:30px 36px 0 36px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="padding-right:8px"><img src="cid:logo" width="30" height="30" alt="" style="display:block;border:0"></td><td style="font-family:${FONT};font-size:19px;font-weight:700;letter-spacing:-.03em;color:#09090b" class="title">Onboard<span style="color:#71717a">Ops</span></td></tr></table></td></tr>
<tr><td align="center" style="padding:26px 36px 0 36px"><img src="cid:${s.icon}" width="96" height="96" alt="" style="display:block;border:0"></td></tr>
<tr><td align="center" class="pad" style="padding:14px 36px 0 36px"><h1 class="title" style="margin:0 0 14px 0;font-family:${FONT};font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-.02em;color:#09090b">${esc(s.title)}</h1></td></tr>
<tr><td class="pad" align="${align}" style="padding:0 36px;text-align:${align}">${s.blocks ? s.blocks.map(blockHtml).join("") : `${p}${list}${details}`}${button}${note}<!--OO_REPLY_START--><table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:18px auto 0 auto"><tr><td style="border:1px solid #d4d4d8;border-radius:8px"><a href="%%OO_REPLY_URL%%" style="display:inline-block;padding:9px 18px;font-family:${FONT};font-size:13px;font-weight:600;color:#3f3f46;text-decoration:none">Reply to this email</a></td></tr></table><!--OO_REPLY_END--></td></tr>
<tr><td class="pad" style="padding:22px 36px 0 36px"><div class="rule" style="border-top:1px solid #e4e4e7"></div></td></tr>
<tr><td class="pad" style="padding:18px 36px 30px 36px;font-size:12px;line-height:1.7;color:#71717a;text-align:left"><div class="muted">OnboardOps &middot; Staff records, training and discipline for shift-based teams. Built in Georgia, USA.</div>${s.footer ? `<div class="muted" style="margin-top:8px">${esc(s.footer)}</div>` : ""}${s.unsubscribeUrl ? `<div class="muted" style="margin-top:8px">Don&rsquo;t want these emails? <a href="${esc(s.unsubscribeUrl)}" style="color:#71717a;text-decoration:underline">Unsubscribe</a></div>` : ""}<!--OO_REPLY_START--><div class="muted" style="margin-top:8px">Questions about this email? <a href="%%OO_REPLY_URL%%" style="color:#71717a;text-decoration:underline">Reply here</a>.</div><!--OO_REPLY_END--><div style="margin-top:8px"><a href="${base}/support" style="color:#71717a;text-decoration:underline">Help</a> &nbsp;&middot;&nbsp; <a href="${base}/legal/privacy" style="color:#71717a;text-decoration:underline">Privacy</a> &nbsp;&middot;&nbsp; <a href="${base}/legal/terms-of-service" style="color:#71717a;text-decoration:underline">Terms</a></div></td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    s.title,
    "",
    ...(s.blocks
      ? s.blocks.flatMap(blockText)
      : [
          ...s.paragraphs.flatMap((t) => [t, ""]),
          ...(s.list?.length ? [...s.list.map((i) => `- ${i}`), ""] : []),
          ...(s.details?.length ? [...s.details.map(([k, v]) => `${k}: ${v}`), ""] : []),
        ]),
    ...(s.button ? [`${s.button.label}: ${s.button.url}`, ""] : []),
    ...(s.note ? [s.note, ""] : []),
    ...(s.unsubscribeUrl ? [`Unsubscribe: ${s.unsubscribeUrl}`, ""] : []),
    "Reply to this email: %%OO_REPLY_URL%%",
    "",
    "—",
    `OnboardOps · ${base}/support`,
  ].join("\n");
  return { html, text };
}
