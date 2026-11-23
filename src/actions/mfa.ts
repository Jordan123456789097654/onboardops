"use server";
import { z } from "zod";
import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createSession, getCurrentUser, verifyPassword } from "@/lib/auth";
import { clearMfaPending, landingFor, readMfaPending } from "@/lib/login";
import { auditUser, backupCodesLeft, confirmSetup, disableMfa, generateBackupCodes, startSetup, verifySecondFactor, type SecondFactorResult } from "@/lib/mfa";
import { requireWorkspaceRole } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { enforceRate } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { run, type Result } from "./_util";

const qrFor = (uri: string) => QRCode.toDataURL(uri, { margin: 1, width: 224, color: { dark: "#000000", light: "#ffffff" } });

function factorError(r: Extract<SecondFactorResult, { ok: false }>): Error {
  if (r.reason === "locked") {
    const mins = Math.max(1, Math.ceil(((r.retryAt?.getTime() ?? Date.now()) - Date.now()) / 60_000));
    return new Error(`Too many wrong codes. Two-factor sign-in is locked for ${mins} minute${mins === 1 ? "" : "s"}.`);
  }
  return new Error("That code is not right. Use the code from your authenticator app, or a backup code.");
}

/* ---------------- Sign-in step: after the password, before a session exists ---------------- */

export async function verifyLoginMfaAction(input: unknown): Promise<Result<{ to: string }>> {
  return run(async () => {
    await enforceRate("totp", 10, 900);
    const d = z.object({ code: z.string().trim().min(6, "Enter your code").max(20) }).parse(input);
    const pending = await readMfaPending();
    if (!pending || pending.enroll) throw new Error("Your sign-in timed out. Please sign in again.");
    const r = await verifySecondFactor(pending.u, d.code);
    if (!r.ok) throw factorError(r);
    clearMfaPending();
    await createSession(pending.u);
    if (r.via === "backup") {
      const u = await prisma.user.findUnique({ where: { id: pending.u }, select: { name: true } });
      const left = await backupCodesLeft(pending.u);
      await auditUser(pending.u, u?.name ?? "User", "MFA_BACKUP_CODE_USED", `${u?.name ?? "A member"} signed in with a backup code (${left} left)`);
    }
    return { to: await landingFor(pending.u, pending.ws, "/workplaces") };
  });
}

/** Forced enrolment at sign-in (the workspace requires 2FA and this person has not set it up). */
export async function loginEnrollStartAction(): Promise<Result<{ secret: string; qr: string }>> {
  return run(async () => {
    await enforceRate("totp-setup", 10, 900);
    const pending = await readMfaPending();
    if (!pending?.enroll) throw new Error("Your sign-in timed out. Please sign in again.");
    const u = await prisma.user.findUnique({ where: { id: pending.u }, select: { id: true, email: true, totpEnabledAt: true } });
    if (!u || u.totpEnabledAt) throw new Error("Your sign-in timed out. Please sign in again.");
    const s = await startSetup(u);
    return { secret: s.secret, qr: await qrFor(s.uri) };
  });
}

export async function loginEnrollConfirmAction(input: unknown): Promise<Result<{ to: string; backupCodes: string[] }>> {
  return run(async () => {
    await enforceRate("totp", 10, 900);
    const d = z.object({ code: z.string().trim().min(6, "Enter the 6-digit code").max(10) }).parse(input);
    const pending = await readMfaPending();
    if (!pending?.enroll) throw new Error("Your sign-in timed out. Please sign in again.");
    const r = await confirmSetup(pending.u, d.code);
    if (!r.ok) throw new Error(r.error);
    clearMfaPending();
    await createSession(pending.u);
    const u = await prisma.user.findUnique({ where: { id: pending.u }, select: { name: true } });
    await auditUser(pending.u, u?.name ?? "User", "MFA_ENABLED", `${u?.name ?? "A member"} turned on two-factor authentication (required by the workspace)`);
    return { to: await landingFor(pending.u, pending.ws, "/workplaces"), backupCodes: r.backupCodes };
  });
}

/* ---------------- Account settings ---------------- */

async function me() {
  const u = await getCurrentUser();
  if (!u) throw new Error("Sign in first.");
  return u;
}
const done = () => { revalidatePath("/account"); revalidatePath("/app", "layout"); };

/** People who sign in only with email links have no password to confirm; everyone else must re-enter it for these changes. */
async function confirmPassword(u: Awaited<ReturnType<typeof me>>, password: string | undefined) {
  if (!u.passwordSetAt) return;
  if (!password) throw new Error("Enter your password to continue.");
  if (!(await verifyPassword(password, u.passwordHash))) throw new Error("Your password is incorrect.");
}

export async function startTotpSetupAction(input: unknown): Promise<Result<{ secret: string; qr: string }>> {
  return run(async () => {
    await enforceRate("totp-setup", 10, 900);
    const u = await me();
    if (u.totpEnabledAt) throw new Error("Two-factor authentication is already on.");
    const d = z.object({ password: z.string().optional() }).parse(input);
    await confirmPassword(u, d.password);
    const s = await startSetup(u);
    return { secret: s.secret, qr: await qrFor(s.uri) };
  });
}

export async function confirmTotpSetupAction(input: unknown): Promise<Result<{ backupCodes: string[] }>> {
  return run(async () => {
    await enforceRate("totp", 10, 900);
    const u = await me();
    const d = z.object({ code: z.string().trim().min(6, "Enter the 6-digit code").max(10) }).parse(input);
    const r = await confirmSetup(u.id, d.code);
    if (!r.ok) throw new Error(r.error);
    await auditUser(u.id, u.name, "MFA_ENABLED", `${u.name} turned on two-factor authentication`);
    done();
    return { backupCodes: r.backupCodes };
  });
}

export async function disableTotpAction(input: unknown): Promise<Result> {
  return run(async () => {
    await enforceRate("totp", 10, 900);
    const u = await me();
    if (!u.totpEnabledAt) throw new Error("Two-factor authentication is not on.");
    const d = z.object({ password: z.string().optional(), code: z.string().trim().min(6, "Enter a code").max(20) }).parse(input);
    await confirmPassword(u, d.password);
    const required = await prisma.workspaceMember.findFirst({ where: { userId: u.id, workspace: { require2fa: true } }, include: { workspace: { select: { name: true } } } });
    if (required) throw new Error(`${required.workspace.name} requires two-factor authentication for everyone, so it cannot be turned off. Ask the workspace owner to change that policy first.`);
    const r = await verifySecondFactor(u.id, d.code);
    if (!r.ok) throw factorError(r);
    await disableMfa(u.id);
    await auditUser(u.id, u.name, "MFA_DISABLED", `${u.name} turned off two-factor authentication`);
    done();
    return undefined;
  });
}

export async function regenerateBackupCodesAction(input: unknown): Promise<Result<{ backupCodes: string[] }>> {
  return run(async () => {
    await enforceRate("totp", 10, 900);
    const u = await me();
    if (!u.totpEnabledAt) throw new Error("Turn on two-factor authentication first.");
    const d = z.object({ password: z.string().optional(), code: z.string().trim().min(6, "Enter a code").max(20) }).parse(input);
    await confirmPassword(u, d.password);
    const r = await verifySecondFactor(u.id, d.code);
    if (!r.ok) throw factorError(r);
    const codes = await generateBackupCodes(u.id);
    await auditUser(u.id, u.name, "MFA_BACKUP_CODES_REGENERATED", `${u.name} generated new backup codes; the old ones no longer work`);
    done();
    return { backupCodes: codes };
  });
}

/* ---------------- Workspace policy (owner only) ---------------- */

export async function setWorkspace2faPolicyAction(input: unknown): Promise<Result<{ withoutMfa: number }>> {
  return run(async () => {
    const ctx = await requireWorkspaceRole(["OWNER"]);
    const d = z.object({ enabled: z.boolean() }).parse(input);
    if (d.enabled && !ctx.user.totpEnabledAt) throw new Error("Turn on two-factor authentication for your own account first (Account settings), so you do not lock yourself out.");
    const members = await prisma.workspaceMember.findMany({ where: { workspaceId: ctx.workspaceId }, include: { user: { select: { totpEnabledAt: true } } } });
    const withoutMfa = members.filter((m) => !m.user.totpEnabledAt).length;
    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({ where: { id: ctx.workspaceId }, data: { require2fa: d.enabled } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "MFA_POLICY_CHANGED", targetType: "Workspace", targetId: ctx.workspaceId, summary: d.enabled ? `Two-factor authentication is now required for every member (${withoutMfa} member${withoutMfa === 1 ? "" : "s"} must set it up at next sign-in)` : "Two-factor authentication is no longer required for every member" });
    });
    revalidatePath("/app", "layout");
    return { withoutMfa };
  });
}

/** For someone who lost their phone and their backup codes. Clears their 2FA so they can set it up again. */
export async function resetMemberMfaAction(input: unknown): Promise<Result> {
  return run(async () => {
    const ctx = await requireWorkspaceRole(["OWNER"]);
    const d = z.object({ memberId: z.string().min(1) }).parse(input);
    const target = await prisma.workspaceMember.findFirst({ where: { id: d.memberId, workspaceId: ctx.workspaceId }, include: { user: true } });
    if (!target) throw new Error("Member not found.");
    if (target.userId === ctx.userId) throw new Error("Use a backup code to reset your own two-factor authentication.");
    if (target.role === "OWNER") throw new Error("Another owner resets their own two-factor authentication.");
    if (!target.user.totpEnabledAt) throw new Error("That member does not have two-factor authentication on.");
    await disableMfa(target.userId);
    await prisma.$transaction(async (tx) => {
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "MFA_RESET_BY_OWNER", targetType: "User", targetId: target.userId, summary: `${ctx.user.name} reset two-factor authentication for ${target.user.name}` });
    });
    await sendEmail(target.user.email, "Two-factor authentication was reset on your account", `Hi ${target.user.name},\n\n${ctx.user.name} reset two-factor authentication on your OnboardOps account because you asked for help signing in. You can set it up again in Account settings${ctx.workspace.require2fa ? ", and you will be asked to at your next sign-in" : ""}.\n\nIf you did not ask for this, tell your workspace owner and change your password.`, { kind: "security", workspaceId: ctx.workspaceId });
    revalidatePath("/app", "layout");
    return undefined;
  });
}
