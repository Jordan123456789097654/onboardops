"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaff, OWNER_ONLY, SUPPORT_STAFF } from "@/lib/platform";
import { banUserCore, decideAppealCore, unbanUserCore, warnUserCore } from "@/lib/moderation-core";
import { postDiscord } from "@/lib/discord-events";
import { run } from "./_util";

const reasonSchema = z.string().trim().min(10, "Give a reason (10+ characters). The person will see it.").max(500);
const refresh = () => revalidatePath("/admin", "layout");

/** Bans an account: it can't sign in and every existing session ends. Recorded in the moderation log and emailed. */
export async function banUserAction(input: unknown) {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    const d = z.object({ userId: z.string(), reason: reasonSchema }).parse(input);
    await banUserCore(staff, d.userId, d.reason);
    refresh();
    return undefined;
  });
}

/** Restores a banned account. */
export async function unbanUserAction(input: unknown) {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    const d = z.object({ userId: z.string(), reason: reasonSchema }).parse(input);
    await unbanUserCore(staff, d.userId, d.reason);
    refresh();
    return undefined;
  });
}

/** Sends a formal warning. Doesn't restrict access; it creates a record. */
export async function warnUserAction(input: unknown) {
  return run(async () => {
    const staff = await requireStaff(SUPPORT_STAFF);
    const d = z.object({ userId: z.string(), reason: reasonSchema }).parse(input);
    await warnUserCore(staff, d.userId, d.reason);
    refresh();
    return undefined;
  });
}

/** Decides an appeal. Overturning reverses the ban or workspace suspension it was about. */
export async function decideAppealAction(input: unknown) {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    const d = z.object({ appealId: z.string(), overturn: z.boolean(), note: z.string().trim().min(10, "Explain the decision (10+ characters).").max(500) }).parse(input);
    await decideAppealCore(staff, d.appealId, d.overturn, d.note);
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
      if (!pending) {
        const appeal = await prisma.moderationAppeal.create({ data: { caseId, email: d.email, message: d.message } });
        await postDiscord("appeals", {
          title: "New appeal waiting",
          description: "Open the moderation screen to read it, or decide it here.",
          url: `${(process.env.APP_URL || "https://onboardops.org").replace(/\/$/, "")}/admin/moderation`,
          tone: "warn",
          buttons: [
            { id: `appeal:overturn:${appeal.id}`, label: "Overturn", style: "success" },
            { id: `appeal:uphold:${appeal.id}`, label: "Uphold", style: "secondary" },
          ],
        });
      }
    }
    return undefined;
  });
}
