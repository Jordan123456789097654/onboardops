import { buildEmail, type EmailSpec } from "./email-template";
import { EMAIL_IMAGES } from "./email-assets";
import { OPTIONAL_CATEGORIES, fillVars, parseMarkup, unfilled, type MailIcon } from "./email-markup";

const appUrl = () => (process.env.APP_URL || "https://onboardops.org").trim().replace(/^["']+|["']+$/g, "").replace(/\/$/, "");

export type ComposeInput = {
  subject: string;
  body: string;
  icon: MailIcon;
  buttonText: string;
  buttonUrl: string;
  vars: Record<string, string>;
  /** Product news that people can switch off. Everything else is an important notice. */
  optional: boolean;
};

export function autoVars(name: string): Record<string, string> {
  const base = appUrl();
  return {
    name: name.trim().split(/\s+/)[0] || "there",
    year: String(new Date().getFullYear()),
    app_url: base,
    login_url: `${base}/login`,
    status_url: "https://status.onboardops.org",
    support_url: `${base}/support`,
    security_url: `${base}/security`,
    privacy_url: `${base}/legal/privacy`,
    terms_url: `${base}/legal/terms`,
    changelog_url: `${base}/changelog`,
  };
}

export const defaultOptional = (category: string) => OPTIONAL_CATEGORIES.includes(category);

const validUrl = (u: string) => {
  try { return new URL(u).protocol === "https:"; } catch { return false; }
};

export type Rendered = { subject: string; html: string; text: string; missing: string[]; badUrl: boolean };

/** Fills every {{variable}} for one recipient and builds the final HTML and text. Fields left empty are reported in `missing`. */
export function renderComposed(input: ComposeInput, recipientName: string): Rendered {
  const vars = { ...Object.fromEntries(Object.entries(input.vars).map(([k, v]) => [k.toLowerCase(), v.trim()])), ...autoVars(recipientName) };
  const subject = fillVars(input.subject, vars).trim();
  const body = fillVars(input.body, vars);
  const buttonText = fillVars(input.buttonText, vars).trim();
  const buttonUrl = fillVars(input.buttonUrl, vars).trim();
  const missing = Array.from(new Set([...unfilled(subject), ...unfilled(body), ...unfilled(buttonText), ...unfilled(buttonUrl)]));
  const badUrl = !!buttonText && !!buttonUrl && !missing.length && !validUrl(buttonUrl);
  const blocks = parseMarkup(body);
  const firstPara = blocks.find((b) => b.t === "p");
  const spec: EmailSpec = {
    icon: input.icon,
    preheader: (firstPara && firstPara.t === "p" ? firstPara.v.replace(/\s+/g, " ").slice(0, 110) : subject) || subject,
    title: subject,
    paragraphs: [],
    blocks,
    ...(buttonText && buttonUrl && validUrl(buttonUrl) ? { button: { label: buttonText, url: buttonUrl } } : {}),
    align: "left",
    footer: input.optional
      ? "You are receiving this because you have an OnboardOps account. You can turn off product news in your notification settings."
      : "This is an important notice about your OnboardOps account or our service.",
  };
  const { html, text } = buildEmail(spec);
  return { subject, html, text, missing, badUrl };
}

/** Swaps the attached-image references for inline data so the preview shows pictures in the browser. */
export function previewHtml(html: string): string {
  return html.replace(/cid:([a-z-]+)/g, (whole, id: string) => (EMAIL_IMAGES[id] ? `data:image/png;base64,${EMAIL_IMAGES[id]}` : whole));
}
