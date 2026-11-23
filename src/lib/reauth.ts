import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { verifySecondFactor } from "./mfa";

/** Sensitive owner changes need the owner to prove it is them again: their password, and a code from their authenticator app if they use one. */
export async function reauth(userId: string, password?: string, code?: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (u.passwordSetAt) {
    if (!password) throw new Error("Enter your password to continue.");
    if (!(await bcrypt.compare(password, u.passwordHash))) throw new Error("Your password is incorrect.");
  }
  if (u.totpEnabledAt) {
    if (!code) throw new Error("Enter a code from your authenticator app to continue.");
    const r = await verifySecondFactor(u.id, code);
    if (!r.ok) throw new Error(r.reason === "locked" ? "Too many wrong codes. Try again in a few minutes." : "That code is not right.");
  }
}
