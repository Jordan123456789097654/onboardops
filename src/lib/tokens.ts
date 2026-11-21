import { createHash, randomBytes } from "crypto";
import { prisma } from "./prisma";

const hash = (t: string) => createHash("sha256").update(t).digest("hex");

/** Creates a single-use token. Only the hash is stored; the raw value goes in the emailed link. */
export async function createToken(userId: string, kind: "RESET" | "INVITE" | "VERIFY" | "MAGIC" | "ADDEMAIL", ttlMs: number) {
  const raw = randomBytes(32).toString("base64url");
  await prisma.authToken.create({ data: { userId, kind, tokenHash: hash(raw), expiresAt: new Date(Date.now() + ttlMs) } });
  return raw;
}

export async function findValidToken(raw: string) {
  const t = await prisma.authToken.findUnique({ where: { tokenHash: hash(raw) }, include: { user: true } });
  if (!t || t.usedAt || t.expiresAt < new Date()) return null;
  return t;
}
