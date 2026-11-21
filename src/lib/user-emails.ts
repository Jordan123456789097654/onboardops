import { prisma } from "./prisma";

export const norm = (e: string) => e.trim().toLowerCase();

/** Finds an account by its primary email, or by a verified secondary email. */
export async function findUserByAnyEmail(email: string) {
  const e = norm(email);
  const u = await prisma.user.findUnique({ where: { email: e } });
  if (u) return u;
  const x = await prisma.userEmail.findFirst({ where: { email: e, verifiedAt: { not: null } }, include: { user: true } });
  return x?.user ?? null;
}

/** True if the address is already used by any account, as primary or secondary. */
export async function emailTaken(email: string, exceptUserId?: string) {
  const e = norm(email);
  const [u, x] = await Promise.all([prisma.user.findUnique({ where: { email: e } }), prisma.userEmail.findUnique({ where: { email: e } })]);
  if (u && u.id !== exceptUserId) return true;
  if (x && x.userId !== exceptUserId) return true;
  return false;
}

/** Every verified address for a user (used to find employer records that were created with any of them). */
export async function verifiedEmails(user: { id: string; email: string; emailVerifiedAt: Date | null }) {
  const extras = await prisma.userEmail.findMany({ where: { userId: user.id, verifiedAt: { not: null } }, select: { email: true } });
  return [...(user.emailVerifiedAt ? [norm(user.email)] : []), ...extras.map((x) => norm(x.email))];
}
