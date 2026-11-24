import { createHash, randomBytes } from "crypto";
import { prisma } from "./prisma";

/** Emails that must never carry a reply link: sign-in links, codes, confirmations, and the reply flow's own mail. */
const NO_REPLY_KINDS = new Set(["login", "signin", "magic-link", "mfa", "verify", "verify-additional", "verify-retry", "recovery", "support-code", "linked", "linked-signin", "newsletter-confirm", "reply-forward", "reply-ack", "admin-test"]);
const NO_REPLY_SUBJECT = /sign-in link|sign in to|verify your email|verify email|reset your|confirm (this|your)|support code|verification code|your code|backup codes|password (was )?changed|new (device|sign-in)/i;

export const REPLY_URL_MARK = "%%OO_REPLY_URL%%";
export const REPLY_LIFETIME_DAYS = 30;

const appUrl = () => (process.env.APP_URL || "https://onboardops.org").trim().replace(/^["']+|["']+$/g, "").replace(/\/$/, "");
export const hashReplyToken = (t: string) => createHash("sha256").update(t).digest("hex");

/** Where a copy of every reply goes. Override with REPLY_FORWARD_TO (comma separated). */
export function forwardTargets(): string[] {
  const raw = process.env.REPLY_FORWARD_TO?.trim() || "jordan@onboardops.org,jordanedanield13@gmail.com";
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
}

export function wantsReplyLink(kind: string | undefined, subject: string): boolean {
  if (kind && NO_REPLY_KINDS.has(kind)) return false;
  return !NO_REPLY_SUBJECT.test(subject);
}

/** Creates a link for one email to one person. Only a hash of the token is stored. Returns null if it could not be made. */
export async function createReplyLink(to: string, subject: string, kind: string, workspaceId?: string | null): Promise<string | null> {
  try {
    const token = randomBytes(24).toString("base64url");
    await prisma.emailReplyLink.create({
      data: { tokenHash: hashReplyToken(token), to: to.toLowerCase(), subject: subject.slice(0, 300), kind: kind.slice(0, 40), workspaceId: workspaceId ?? null, expiresAt: new Date(Date.now() + REPLY_LIFETIME_DAYS * 86400_000) },
    });
    return `${appUrl()}/reply/${token}`;
  } catch {
    return null;
  }
}

/** Swaps the placeholder for the real link, or removes every reply block when there is no link. */
export function applyReplyLink<T extends { html?: string; text: string }>(parts: T, url: string | null): T {
  const html = parts.html === undefined ? undefined : url ? parts.html.split(REPLY_URL_MARK).join(url) : parts.html.replace(/<!--OO_REPLY_START-->[\s\S]*?<!--OO_REPLY_END-->/g, "");
  const text = url ? parts.text.split(REPLY_URL_MARK).join(url) : parts.text.replace(/^Reply to this email: %%OO_REPLY_URL%%\r?\n\r?\n?/m, "");
  return { ...parts, html, text };
}
