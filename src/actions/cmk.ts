"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, verifyPassword } from "@/lib/auth";
import { requireWorkspaceRole } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { verifySecondFactor } from "@/lib/mfa";
import { enableCmk, generateCustomerKey, removeCmk, restoreCmk, revokeCmk, rotateCmk } from "@/lib/cmk";
import { enforceRate } from "@/lib/rate-limit";
import { run, type Result } from "./_util";

/** Key changes are owner-only and need the owner to prove it is them: their password, and a 2FA code if they use 2FA. */
async function owner() {
  const ctx = await requireWorkspaceRole(["OWNER"], { allowLocked: true });
  await enforceRate("cmk", 15, 900);
  return ctx;
}
async function reauth(userId: string, password?: string, code?: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (u.passwordSetAt) {
    if (!password) throw new Error("Enter your password to continue.");
    if (!(await verifyPassword(password, u.passwordHash))) throw new Error("Your password is incorrect.");
  }
  if (u.totpEnabledAt) {
    if (!code) throw new Error("Enter a code from your authenticator app to continue.");
    const r = await verifySecondFactor(u.id, code);
    if (!r.ok) throw new Error(r.reason === "locked" ? "Too many wrong codes. Try again in a few minutes." : "That code is not right.");
  }
}
const confirm = z.object({ password: z.string().optional(), code: z.string().optional() });
const keyInput = confirm.extend({ key: z.string().optional(), generate: z.boolean().optional() });
const log = (ctx: Awaited<ReturnType<typeof owner>>, actionType: string, summary: string, metadata?: Record<string, string | number>) =>
  prisma.$transaction((tx) => writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType, targetType: "Workspace", targetId: ctx.workspaceId, summary, ...(metadata ? { metadata } : {}) }));
const done = () => revalidatePath("/app", "layout");
/** The key itself is never logged or put in an audit entry; only its fingerprint is. */
const pickKey = (d: z.infer<typeof keyInput>) => { if (d.generate) return { key: generateCustomerKey(), generated: true }; if (!d.key) throw new Error("Paste your key, or choose Generate."); return { key: d.key, generated: false }; };

export async function addCmkAction(input: unknown): Promise<Result<{ generatedKey?: string; fingerprint: string }>> {
  return run(async () => {
    const ctx = await owner(); const d = keyInput.parse(input);
    await reauth(ctx.userId, d.password, d.code);
    const k = pickKey(d);
    const r = await enableCmk(ctx.workspaceId, k.key);
    await log(ctx, "CMK_ADDED", `A customer-managed encryption key was added (fingerprint ${r.fingerprint})`, { fingerprint: r.fingerprint, version: r.version });
    done();
    return { generatedKey: k.generated ? k.key : undefined, fingerprint: r.fingerprint };
  });
}

export async function rotateCmkAction(input: unknown): Promise<Result<{ generatedKey?: string; fingerprint: string }>> {
  return run(async () => {
    const ctx = await owner(); const d = keyInput.parse(input);
    await reauth(ctx.userId, d.password, d.code);
    const k = pickKey(d);
    const r = await rotateCmk(ctx.workspaceId, k.key);
    await log(ctx, "CMK_ROTATED", `The customer-managed encryption key was rotated (now version ${r.version}, fingerprint ${r.fingerprint})`, { fingerprint: r.fingerprint, version: r.version });
    done();
    return { generatedKey: k.generated ? k.key : undefined, fingerprint: r.fingerprint };
  });
}

export async function revokeCmkAction(input: unknown): Promise<Result> {
  return run(async () => {
    const ctx = await owner(); const d = confirm.parse(input);
    await reauth(ctx.userId, d.password, d.code);
    await revokeCmk(ctx.workspaceId);
    await log(ctx, "CMK_REVOKED", "The customer-managed encryption key was revoked. The workspace's encrypted records are locked until the key is provided again.");
    done();
    return undefined;
  });
}

/** Used from the locked screen: no password step, because the key itself is the proof, and it is checked against the stored data key. */
export async function restoreCmkAction(input: unknown): Promise<Result<{ fingerprint: string }>> {
  return run(async () => {
    const ctx = await owner(); const d = z.object({ key: z.string().min(1, "Paste your key") }).parse(input);
    const r = await restoreCmk(ctx.workspaceId, d.key);
    await log(ctx, "CMK_RESTORED", `The customer-managed encryption key was provided again; the workspace is unlocked (fingerprint ${r.fingerprint})`, { fingerprint: r.fingerprint });
    done();
    return { fingerprint: r.fingerprint };
  });
}

export async function removeCmkAction(input: unknown): Promise<Result> {
  return run(async () => {
    const ctx = await owner(); const d = confirm.parse(input);
    await reauth(ctx.userId, d.password, d.code);
    await removeCmk(ctx.workspaceId);
    await log(ctx, "CMK_REMOVED", "The workspace went back to the OnboardOps-managed encryption key");
    done();
    return undefined;
  });
}

export async function cmkNeedsReauth(): Promise<Result<{ password: boolean; code: boolean }>> {
  return run(async () => { const u = await getCurrentUser(); if (!u) throw new Error("Sign in first."); return { password: !!u.passwordSetAt, code: !!u.totpEnabledAt }; });
}
