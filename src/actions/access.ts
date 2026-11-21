"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { requireWorkspaceRole, MANAGEMENT_ROLES } from "@/lib/rbac";
import { inviteEmployee, type InviteOutcome } from "@/lib/invites";
import { run } from "./_util";

const ROLES = ["ADMIN", "MANAGER", "SUPERVISOR", "EMPLOYEE"] as const;

/** Sends sign-in invites to many employees at once (Managers and above), optionally with a chosen role. */
export async function bulkInviteAction(input: unknown, roleArg?: "ADMIN" | "MANAGER" | "SUPERVISOR" | "EMPLOYEE") {
  return run(async () => {
    const ctx = await requireWorkspaceRole(MANAGEMENT_ROLES);
    const ids = z.array(z.string()).min(1, "Pick at least one employee").max(200, "Invite at most 200 people at once").parse(input);
    const role = roleArg && ROLES.includes(roleArg) ? roleArg : "EMPLOYEE";
    const out: InviteOutcome[] = [];
    for (const id of ids) out.push(await inviteEmployee(ctx, id, role));
    revalidatePath("/app", "layout");
    return out;
  });
}

/** Assigns or updates an employee's workspace role (and grants sign-in access automatically if they don't have one yet). */
export async function assignEmployeeRoleAction(employeeId: string, roleInput: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(MANAGEMENT_ROLES);
    const role = z.enum(ROLES).parse(roleInput);
    if (role === "ADMIN" && ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
      throw new Error("Only an owner or admin can assign the Admin role.");
    }
    const emp = await prisma.employeeProfile.findFirst({ where: { id: employeeId, workspaceId: ctx.workspaceId }, include: { member: { include: { user: true } } } });
    if (!emp) throw new Error("Employee not found.");
    if (!emp.member) {
      const outcome = await inviteEmployee(ctx, emp.id, role);
      revalidatePath("/app", "layout");
      return { invited: true, role, link: outcome.link, emailed: outcome.emailed };
    }
    if (emp.member.role === "OWNER") throw new Error("The workspace owner's role cannot be changed.");
    await prisma.$transaction(async (tx) => {
      await tx.workspaceMember.update({ where: { id: emp.member!.id }, data: { role } });
      await writeAudit(tx, {
        workspaceId: ctx.workspaceId,
        actorMemberId: ctx.id,
        actorName: ctx.user.name,
        actionType: "MEMBER_ROLE_CHANGED",
        targetType: "Member",
        targetId: emp.member!.id,
        summary: `${emp.fullName} (${emp.staffCode}): ${emp.member!.role} → ${role}`,
      });
    });
    revalidatePath("/app", "layout");
    return { invited: false, role };
  });
}
