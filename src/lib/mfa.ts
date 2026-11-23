import { randomInt } from "crypto";
import { prisma } from "./prisma";
import { keyedDigest, open, seal } from "./secret-box";
import { generateSecret, otpauthUri, verifyTotp } from "./totp";
import { writeAudit } from "./audit";

/** Two-factor sign-in (TOTP + backup codes). Plain functions with explicit arguments, so they can be tested without a request. */

export const MFA_ISSUER = process.env.MFA_ISSUER_NAME || "OnboardOps";
export const LOCK_AFTER_FAILURES = 5;
export const LOCK_MINUTES = 15;
const BACKUP_COUNT = 10;
// No 0/O/1/I/L so codes are easy to read out and type.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function loginRequirement(user: { totpEnabledAt: Date | null }, ws: { require2fa: boolean } | null): "none" | "code" | "enroll" {
  if (user.totpEnabledAt) return "code";
  return ws?.require2fa ? "enroll" : "none";
}

export const normalizeBackup = (s: string) => s.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
const backupHash = (userId: string, code: string) => keyedDigest(`backup:${userId}`, normalizeBackup(code));

function newBackupCode(): string {
  let c = "";
  for (let i = 0; i < 10; i++) c += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `${c.slice(0, 5)}-${c.slice(5)}`;
}

/** Replaces all backup codes with 10 new single-use ones. The plain codes are returned once and never stored. */
export async function generateBackupCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: BACKUP_COUNT }, newBackupCode);
  await prisma.$transaction([
    prisma.backupCode.deleteMany({ where: { userId } }),
    prisma.backupCode.createMany({ data: codes.map((c) => ({ userId, codeHash: backupHash(userId, c) })) }),
  ]);
  return codes;
}

export async function backupCodesLeft(userId: string): Promise<number> {
  return prisma.backupCode.count({ where: { userId, usedAt: null } });
}

/** Starts enrolment: makes a new secret, stores it sealed as "pending", and returns it for the QR code and manual entry. */
export async function startSetup(user: { id: string; email: string }) {
  const secret = generateSecret();
  await prisma.user.update({ where: { id: user.id }, data: { totpPendingEnc: seal(secret) } });
  return { secret, uri: otpauthUri(secret, user.email, MFA_ISSUER) };
}

/** Turns 2FA on once the person proves their app shows the right code. Returns the backup codes (shown once). */
export async function confirmSetup(userId: string, code: string, now = new Date()): Promise<{ ok: true; backupCodes: string[] } | { ok: false; error: string }> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { totpPendingEnc: true, totpEnabledAt: true } });
  if (!u?.totpPendingEnc) return { ok: false, error: "Start the setup again to get a new QR code." };
  if (u.totpEnabledAt) return { ok: false, error: "Two-factor authentication is already on." };
  const secret = open(u.totpPendingEnc);
  if (!secret) return { ok: false, error: "Start the setup again to get a new QR code." };
  const r = verifyTotp(secret, code, { now: now.getTime() });
  if (!r.ok) return { ok: false, error: "That code is not right. Check the code in your app and try again." };
  await prisma.user.update({ where: { id: userId }, data: { totpSecretEnc: u.totpPendingEnc, totpPendingEnc: null, totpEnabledAt: now, totpLastStep: r.step, totpFailed: 0, totpLockedUntil: null } });
  return { ok: true, backupCodes: await generateBackupCodes(userId) };
}

export type SecondFactorResult = { ok: true; via: "totp" | "backup" } | { ok: false; reason: "locked" | "invalid" | "not_enabled"; retryAt?: Date };

/**
 * Checks an authenticator code or a backup code.
 * After 5 wrong codes the account is locked for 15 minutes (this lock is separate from the password lock, so a magic link or reset cannot clear it).
 */
export async function verifySecondFactor(userId: string, input: string, now = new Date()): Promise<SecondFactorResult> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { totpSecretEnc: true, totpEnabledAt: true, totpLastStep: true, totpLockedUntil: true } });
  if (!u || !u.totpEnabledAt || !u.totpSecretEnc) return { ok: false, reason: "not_enabled" };
  if (u.totpLockedUntil && u.totpLockedUntil > now) return { ok: false, reason: "locked", retryAt: u.totpLockedUntil };

  const clean = input.trim();
  let via: "totp" | "backup" | null = null;
  if (/^\d{6}$/.test(clean.replace(/\s/g, ""))) {
    const secret = open(u.totpSecretEnc);
    const r = secret ? verifyTotp(secret, clean, { now: now.getTime(), lastStep: u.totpLastStep }) : { ok: false as const };
    if (r.ok) {
      // Claim the step atomically so two requests carrying the same code cannot both succeed.
      const claimed = await prisma.user.updateMany({ where: { id: userId, OR: [{ totpLastStep: null }, { totpLastStep: { lt: r.step } }] }, data: { totpLastStep: r.step } });
      if (claimed.count === 1) via = "totp";
    }
  } else {
    const norm = normalizeBackup(clean);
    if (norm.length === 10) {
      const used = await prisma.backupCode.updateMany({ where: { userId, codeHash: backupHash(userId, norm), usedAt: null }, data: { usedAt: now } });
      if (used.count === 1) via = "backup";
    }
  }

  if (via) {
    await prisma.user.update({ where: { id: userId }, data: { totpFailed: 0, totpLockedUntil: null } });
    return { ok: true, via };
  }
  const after = await prisma.user.update({ where: { id: userId }, data: { totpFailed: { increment: 1 } }, select: { totpFailed: true } });
  if (after.totpFailed >= LOCK_AFTER_FAILURES) {
    const retryAt = new Date(now.getTime() + LOCK_MINUTES * 60_000);
    await prisma.user.update({ where: { id: userId }, data: { totpFailed: 0, totpLockedUntil: retryAt } });
    return { ok: false, reason: "locked", retryAt };
  }
  return { ok: false, reason: "invalid" };
}

/** Turns 2FA off and removes the secret and every backup code. */
export async function disableMfa(userId: string) {
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { totpSecretEnc: null, totpPendingEnc: null, totpEnabledAt: null, totpLastStep: null, totpFailed: 0, totpLockedUntil: null } }),
    prisma.backupCode.deleteMany({ where: { userId } }),
  ]);
}

/** Audit rows are per workspace, so a personal security change is recorded in each workspace the person belongs to. */
export async function auditUser(userId: string, actorName: string, actionType: string, summary: string) {
  const ms = await prisma.workspaceMember.findMany({ where: { userId }, select: { id: true, workspaceId: true }, take: 25 });
  if (!ms.length) return;
  await prisma.$transaction(async (tx) => {
    for (const m of ms) await writeAudit(tx, { workspaceId: m.workspaceId, actorMemberId: m.id, actorName, actionType, targetType: "User", targetId: userId, summary });
  });
}
