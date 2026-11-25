"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { destroySession, verifyPassword } from "@/lib/auth";
import { requireWorkspaceRole, ADMIN_ROLES } from "@/lib/rbac";
import { runLoggedDailyJobs } from "@/lib/jobs";
import { writeAudit } from "@/lib/audit";
import { assertNotUnderLegalHold } from "@/lib/retention";
import { releaseWorkspaceAddresses } from "@/lib/subdomain";
import { run } from "./_util";

/** Runs the same job the daily cron runs, for this workspace only. */
export async function runRemindersNowAction() {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    const r = await runLoggedDailyJobs("reminders-manual", ctx.workspaceId);
    await prisma.$transaction((tx) => writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "REMINDERS_RUN", targetType: "Workspace", targetId: ctx.workspaceId, summary: `Reminders run manually: ${r.expired} expired, ${r.expiringNotices} expiry notices, ${r.dueReminders} due, ${r.overdueReminders} overdue`, metadata: r }));
    return r;
  });
}

const closeSchema = z.object({ confirmName: z.string(), password: z.string().min(1, "Enter your password") });

/** Permanently deletes the workspace and everything in it. Owner only; needs the workspace name and password. */
export async function closeWorkspaceAction(input: unknown) {
  const res = await run(async () => {
    const ctx = await requireWorkspaceRole(["OWNER"]);
    assertNotUnderLegalHold(ctx.workspace);
    const d = closeSchema.parse(input);
    if (d.confirmName.trim() !== ctx.workspace.name) throw new Error("Type the workspace name exactly to confirm.");
    if (!(await verifyPassword(d.password, ctx.user.passwordHash))) throw new Error("That password is incorrect.");
    const wsId = ctx.workspaceId;
    const addresses = { subdomain: ctx.workspace.subdomain ?? null, customDomain: ctx.workspace.customDomain ?? null };
    await prisma.$transaction(async (tx) => {
      const members = await tx.workspaceMember.findMany({ where: { workspaceId: wsId }, select: { userId: true } });
      await tx.infractionCase.deleteMany({ where: { workspaceId: wsId } });
      await tx.workspace.delete({ where: { id: wsId } });
      const ids = members.map((m) => m.userId);
      const stillMember = await tx.workspaceMember.findMany({ where: { userId: { in: ids } }, select: { userId: true } });
      const keep = new Set(stillMember.map((m) => m.userId));
      const orphans = ids.filter((id) => !keep.has(id));
      if (orphans.length) await tx.user.deleteMany({ where: { id: { in: orphans } } });
    }, { timeout: 60000 });
    // The workspace is gone, so free its address and custom domain. Never blocks closing.
    await releaseWorkspaceAddresses(addresses);
    return undefined;
  });
  if (!res.ok) return res;
  destroySession();
  redirect("/?closed=1");
}
