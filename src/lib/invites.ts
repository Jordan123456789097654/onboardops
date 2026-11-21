import { randomBytes } from "crypto";
import type { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { hashPassword } from "./auth";
import { createToken } from "./tokens";
import { writeAudit } from "./audit";
import { emails, sendEmail } from "./email";
import type { Ctx } from "./rbac";

export type InviteOutcome = { employeeId: string; name: string; email: string; result: "invited" | "linked" | "skipped"; reason?: string; link?: string; emailed?: boolean };

/**
 * Gives one employee a login for this workspace with the specified role (default EMPLOYEE).
 * New people get an email with a one-time link to choose their own password. People who already have an OnboardOps account are simply linked.
 */
export async function inviteEmployee(ctx: Ctx, employeeId: string, role: Role = "EMPLOYEE"): Promise<InviteOutcome> {
  const safeRole: Role = role === "OWNER" ? "ADMIN" : role === "ADMIN" && ctx.role !== "OWNER" && ctx.role !== "ADMIN" ? "MANAGER" : role;
  const emp = await prisma.employeeProfile.findFirst({ where: { id: employeeId, workspaceId: ctx.workspaceId } });
  const base = { employeeId, name: emp?.fullName ?? "", email: emp?.email ?? "" };
  if (!emp) return { ...base, result: "skipped", reason: "Employee not found" };
  if (emp.memberId) return { ...base, result: "skipped", reason: "Already has sign-in access" };
  if (emp.status === "TERMINATED") return { ...base, result: "skipped", reason: "Employee is terminated" };

  const r = await prisma.$transaction(async (tx) => {
    let user = await tx.user.findUnique({ where: { email: emp.email.toLowerCase() } });
    let created = false;
    if (!user) {
      user = await tx.user.create({ data: { email: emp.email.toLowerCase(), name: emp.fullName, passwordHash: await hashPassword(randomBytes(24).toString("hex")) } });
      created = true;
    }
    const member = await tx.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: ctx.workspaceId, userId: user.id } },
      create: { workspaceId: ctx.workspaceId, userId: user.id, role: safeRole },
      update: { role: safeRole },
    });
    await tx.employeeProfile.update({ where: { id: emp.id }, data: { memberId: member.id } });
    await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "ACCESS_GRANTED", targetType: "Employee", targetId: emp.id, summary: `${emp.staffCode} given ${safeRole} sign-in access${created ? " (invite link)" : " (existing account linked)"}` });
    return { userId: user.id, created };
  });

  if (!r.created) return { ...base, result: "linked" };
  const raw = await createToken(r.userId, "INVITE", 7 * 86400000);
  const link = `${process.env.APP_URL || "https://onboardops.org"}/reset-password?token=${raw}&invite=1`;
  const m = emails.invite(emp.fullName, ctx.workspace.name, link);
  const sent = await sendEmail(emp.email, m.subject, m.text, { html: m.html, kind: "invite", workspaceId: ctx.workspaceId, workspaceName: ctx.workspace.name });
  return { ...base, result: "invited", link, emailed: sent.ok };
}
