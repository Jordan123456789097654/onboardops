"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { emails, sendEmail } from "@/lib/email";
import { requireStaff, staffAudit, OWNER_ONLY, SUPPORT_STAFF } from "@/lib/platform";
import { run } from "./_util";

const reasonSchema = z.string().trim().min(10, "Give a reason (10+ characters). The person will see it.").max(500);
const refresh = () => revalidatePath("/admin", "layout");

/** Bans an account: it can't sign in and every existing session ends. Recorded in the moderation log and emailed. */
export async function banUserAction(input: unknown) {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    const d = z.object({ userId: z.string(), reason: reasonSchema }).parse(input);
    const user = await prisma.user.findUnique({ where: { id: d.userId }, select: { id: true, name: true, email: true, bannedAt: true } });
    if (!user) throw new Error("Account not found.");
    if (user.bannedAt) throw new Error("This account is already banned.");
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { bannedAt: new Date(), banReason: d.reason } });
      await tx.userSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.moderationCase.create({ data: { targetType: "USER", userId: user.id, action: "BAN", reason: d.reason, actorName: staff.name } });
      await staffAudit(tx, staff, { action: "ACCOUNT_BAN", targetType: "User", targetId: user.id, summary: `Banned ${user.email}. Reason: ${d.reason}` });
    });
    const m = emails.accountBanned(user.name, d.reason);
    await sendEmail(user.email, m.subject, m.text, { html: m.html, kind: "moderation" });
    refresh();
    return undefined;
  });
}

/** Restores a banned account. */
export async function unbanUserAction(input: unknown) {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    const d = z.object({ userId: z.string(), reason: reasonSchema }).parse(input);
    const user = await prisma.user.findUnique({ where: { id: d.userId }, select: { id: true, name: true, email: true, bannedAt: true } });
    if (!user) throw new Error("Account not found.");
    if (!user.bannedAt) throw new Error("This account is not banned.");
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { bannedAt: null, banReason: "" } });
      await tx.moderationCase.create({ data: { targetType: "USER", userId: user.id, action: "UNBAN", reason: d.reason, actorName: staff.name } });
      await staffAudit(tx, staff, { action: "ACCOUNT_UNBAN", targetType: "User", targetId: user.id, summary: `Unbanned ${user.email}. Reason: ${d.reason}` });
    });
    const m = emails.accountUnbanned(user.name);
    await sendEmail(user.email, m.subject, m.text, { html: m.html, kind: "moderation" });
    refresh();
    return undefined;
  });
}

/** Sends a formal warning. Doesn't restrict access; it creates a record. */
export async function warnUserAction(input: unknown) {
  return run(async () => {
    const staff = await requireStaff(SUPPORT_STAFF);
    const d = z.object({ userId: z.string(), reason: reasonSchema }).parse(input);
    const user = await prisma.user.findUnique({ where: { id: d.userId }, select: { id: true, name: true, email: true } });
    if (!user) throw new Error("Account not found.");
    await prisma.$transaction(async (tx) => {
      await tx.moderationCase.create({ data: { targetType: "USER", userId: user.id, action: "WARN", reason: d.reason, actorName: staff.name } });
      await staffAudit(tx, staff, { action: "ACCOUNT_WARN", targetType: "User", targetId: user.id, summary: `Warned ${user.email}. Reason: ${d.reason}` });
    });
    const m = emails.moderationWarning(user.name, d.reason);
    await sendEmail(user.email, m.subject, m.text, { html: m.html, kind: "moderation" });
    refresh();
    return undefined;
  });
}

/** Decides an appeal. Overturning reverses the ban or workspace suspension it was about. */
export async function decideAppealAction(input: unknown) {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    const d = z.object({ appealId: z.string(), overturn: z.boolean(), note: z.string().trim().min(10, "Explain the decision (10+ characters).").max(500) }).parse(input);
    const appeal = await prisma.moderationAppeal.findUnique({ where: { id: d.appealId }, include: { case: true } });
    if (!appeal) throw new Error("Appeal not found.");
    if (appeal.status !== "PENDING") throw new Error("This appeal has already been decided.");
    const c = appeal.case;
    let notifyName = "there";
    let notifyEmail = appeal.email;
    await prisma.$transaction(async (tx) => {
      if (d.overturn && c.targetType === "USER" && c.userId) {
        await tx.user.update({ where: { id: c.userId }, data: { bannedAt: null, banReason: "" } });
        await tx.moderationCase.create({ data: { targetType: "USER", userId: c.userId, action: "UNBAN", reason: `Appeal upheld: ${d.note}`, actorName: staff.name } });
      }
      if (d.overturn && c.targetType === "WORKSPACE" && c.workspaceId) {
        await tx.workspace.update({ where: { id: c.workspaceId }, data: { suspendedAt: null, suspendedReason: "" } });
        await tx.moderationCase.create({ data: { targetType: "WORKSPACE", workspaceId: c.workspaceId, action: "UNSUSPEND", reason: `Appeal upheld: ${d.note}`, actorName: staff.name } });
      }
      await tx.moderationAppeal.update({ where: { id: appeal.id }, data: { status: d.overturn ? "OVERTURNED" : "UPHELD", decisionNote: d.note, decidedBy: staff.name, decidedAt: new Date() } });
      await staffAudit(tx, staff, { action: "APPEAL_DECIDED", targetType: "Appeal", targetId: appeal.id, summary: `Appeal ${d.overturn ? "overturned" : "upheld"}. ${d.note}` });
    });
    const u = c.userId ? await prisma.user.findUnique({ where: { id: c.userId }, select: { name: true, email: true } }) : null;
    if (u) { notifyName = u.name; notifyEmail = u.email; }
    const m = emails.appealDecided(notifyName, d.overturn, d.note);
    await sendEmail(notifyEmail, m.subject, m.text, { html: m.html, kind: "moderation" });
    refresh();
    return undefined;
  });
}

/**
 * Public appeal form. Always returns the same answer, so it can't be used to find out which emails have accounts.
 * An appeal attaches to the most recent ban or workspace suspension for that address, if there is one.
 */
export async function submitAppealAction(input: unknown) {
  return run(async () => {
    const { enforceRate } = await import("@/lib/rate-limit");
    await enforceRate("appeal", 5, 3600);
    const d = z.object({ email: z.string().trim().toLowerCase().email().max(200), message: z.string().trim().min(20, "Tell us why the decision is wrong (20+ characters).").max(2000), website: z.string().max(0).optional() }).parse(input);
    const user = await prisma.user.findFirst({ where: { OR: [{ email: d.email }, { extraEmails: { some: { email: d.email } } }] }, select: { id: true, bannedAt: true } });
    let caseId: string | null = null;
    if (user?.bannedAt) {
      const c = await prisma.moderationCase.findFirst({ where: { userId: user.id, action: "BAN" }, orderBy: { createdAt: "desc" }, select: { id: true } });
      caseId = c?.id ?? null;
    }
    if (!caseId) {
      const ws = await prisma.workspace.findFirst({ where: { suspendedAt: { not: null }, members: { some: { role: "OWNER", user: { email: d.email } } } }, select: { id: true } });
      if (ws) {
        const c = await prisma.moderationCase.findFirst({ where: { workspaceId: ws.id, action: "SUSPEND" }, orderBy: { createdAt: "desc" }, select: { id: true } });
        caseId = c?.id ?? null;
      }
    }
    if (caseId) {
      const pending = await prisma.moderationAppeal.findFirst({ where: { caseId, status: "PENDING" }, select: { id: true } });
      if (!pending) await prisma.moderationAppeal.create({ data: { caseId, email: d.email, message: d.message } });
    }
    return undefined;
  });
}
