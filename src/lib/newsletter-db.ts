import { prisma } from "./prisma";

/** Confirms a subscription from the link in the confirmation email. Safe to open twice. */
export async function confirmByToken(token: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) return false;
  const r = await prisma.newsletterSubscriber.updateMany({ where: { token }, data: { status: "ACTIVE", confirmedAt: new Date(), unsubscribedAt: null } });
  return r.count > 0;
}

export async function unsubscribeByToken(token: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) return false;
  const r = await prisma.newsletterSubscriber.updateMany({ where: { token }, data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() } });
  return r.count > 0;
}
