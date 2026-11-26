import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

/**
 * Email subscribers for status incidents and updates. Double opt-in: nobody receives anything until they click the link
 * in the confirmation email. Every email has an unsubscribe link.
 */

const SITE = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.onboardops.org").replace(/\/+$/, "");
const SEND_LIMIT_PER_RUN = 500;

const norm = (e: string) => e.trim().toLowerCase();
const looksLikeEmail = (e: string) => /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(e);

/** Starts a subscription and emails a confirmation link. Always answers the same way, so the form does not reveal who is subscribed. */
export async function startStatusSubscription(rawEmail: string): Promise<void> {
  const email = norm(rawEmail);
  if (!looksLikeEmail(email) || email.length > 254) return;
  const existing = await prisma.statusSubscriber.findUnique({ where: { email } });
  if (existing?.status === "ACTIVE") return;
  const token = existing?.token ?? randomBytes(32).toString("hex");
  if (!existing) await prisma.statusSubscriber.create({ data: { email, token, status: "PENDING" } });
  else await prisma.statusSubscriber.update({ where: { email }, data: { status: "PENDING", unsubscribedAt: null } });
  const link = `${SITE}/status-updates/confirm?token=${token}`;
  await sendEmail(email, "Confirm your status updates", `Thanks for asking to hear about OnboardOps incidents and updates.\n\nConfirm your address to start receiving them:\n${link}\n\nIf you didn't ask for this, ignore this email and nothing will be sent.`, {
    html: `<p>Thanks for asking to hear about OnboardOps incidents and updates.</p><p><a href="${link}">Confirm my address</a></p><p>If you didn't ask for this, ignore this email and nothing will be sent.</p>`,
    kind: "status-confirm",
  });
}

/** Returns true when the token matched a pending subscription. */
export async function confirmStatusSubscription(token: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const row = await prisma.statusSubscriber.findUnique({ where: { token } });
  if (!row || row.unsubscribedAt) return false;
  await prisma.statusSubscriber.update({ where: { id: row.id }, data: { status: "ACTIVE", confirmedAt: new Date(), unsubscribedAt: null } });
  return true;
}

export async function unsubscribeStatus(token: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const row = await prisma.statusSubscriber.findUnique({ where: { token } });
  if (!row) return false;
  await prisma.statusSubscriber.update({ where: { id: row.id }, data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() } });
  return true;
}

/**
 * Emails every confirmed subscriber about an incident or update. Failures are counted and never thrown,
 * so a mail problem can't stop an incident from being posted.
 */
export async function notifyStatusSubscribers(subject: string, text: string): Promise<{ sent: number; failed: number }> {
  const out = { sent: 0, failed: 0 };
  try {
    const list = await prisma.statusSubscriber.findMany({ where: { status: "ACTIVE" }, take: SEND_LIMIT_PER_RUN, orderBy: { confirmedAt: "asc" } });
    for (const s of list) {
      const unsub = `${SITE}/status-updates/unsubscribe?token=${s.token}`;
      const body = `${text}\n\nCurrent status: https://status.onboardops.org\n\nStop these emails: ${unsub}`;
      const r = await sendEmail(s.email, subject, body, {
        html: `<p>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p><p><a href="https://status.onboardops.org">Current status</a></p><p style="font-size:12px;color:#666"><a href="${unsub}">Stop these emails</a></p>`,
        kind: "status-update",
      });
      if (r.ok) {
        out.sent++;
        await prisma.statusSubscriber.update({ where: { id: s.id }, data: { lastNotifiedAt: new Date() } }).catch(() => undefined);
      } else out.failed++;
    }
  } catch {
    out.failed++;
  }
  return out;
}
