import { randomBytes } from "crypto";
import { buildEmail } from "./email-template";
import { parseMarkup } from "./email-markup";

const base = () => (process.env.APP_URL || "https://onboardops.org").trim().replace(/^["']+|["']+$/g, "").replace(/\/$/, "");

export const newToken = () => randomBytes(32).toString("base64url");
export const postUrl = (slug: string) => `${base()}/newsletter/${slug}`;
export const confirmUrl = (token: string) => `${base()}/newsletter/confirm?token=${encodeURIComponent(token)}`;
export const unsubscribeUrl = (token: string) => `${base()}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
export const oneClickUnsubscribeUrl = (token: string) => `${base()}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;

/** Headers that let mail apps show an Unsubscribe button and honor it with one click. */
export const listHeaders = (token: string) => ({ "List-Unsubscribe": `<${oneClickUnsubscribeUrl(token)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });

/** The email version of an issue, for one subscriber. The issue stays on the website; the email links back to it. */
export function renderIssueEmail(post: { title: string; summary: string; slug: string; body: string }, token: string) {
  const { html, text } = buildEmail({
    icon: "book",
    preheader: post.summary || post.title,
    title: post.title,
    paragraphs: [],
    blocks: parseMarkup(post.body),
    button: { label: "Read this on the website", url: postUrl(post.slug) },
    align: "left",
    footer: "You are receiving this because you subscribed to the OnboardOps newsletter. We only email the bigger issues.",
    unsubscribeUrl: unsubscribeUrl(token),
  });
  return { html, text };
}

export function renderConfirmEmail(token: string) {
  return buildEmail({
    icon: "verify",
    preheader: "Confirm your email to get the OnboardOps newsletter.",
    title: "Confirm your subscription",
    paragraphs: ["Thanks for your interest in the OnboardOps newsletter. Please confirm your email address so we know it's really you.", "We publish every issue on our website and only email the bigger ones, so your inbox stays quiet."],
    button: { label: "Confirm my email", url: confirmUrl(token) },
    note: "If you didn't ask for this, ignore this email and nothing will happen. You will not be subscribed.",
    align: "left",
  });
}
