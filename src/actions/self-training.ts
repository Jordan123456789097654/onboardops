"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { requireWorkspaceRole, ALL_ROLES } from "@/lib/rbac";
import { assignRoleCourses, newEffects, nextStaffCode } from "@/lib/automations";
import { run } from "./_util";

/**
 * Owners, admins and managers normally have no employee record, so they cannot take courses.
 * This gives the signed-in person their own record (linked to their membership) so My Portal, training, policies
 * and checklists work for them like anyone else. They choose a job role to get its required courses, or none.
 */
export async function joinTrainingRosterAction(input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ALL_ROLES);
    const d = z.object({ jobRoleId: z.string().optional().or(z.literal("")) }).parse(input);
    if (ctx.profile) throw new Error("You are already on the training roster.");
    const fx = newEffects();
    const id = await prisma.$transaction(async (tx) => {
      const member = await tx.workspaceMember.findUnique({ where: { id: ctx.id }, include: { profile: true } });
      if (!member || member.workspaceId !== ctx.workspaceId) throw new Error("Membership not found.");
      if (member.profile) throw new Error("You are already on the training roster.");
      if (d.jobRoleId && !(await tx.jobRole.findFirst({ where: { id: d.jobRoleId, workspaceId: ctx.workspaceId } }))) throw new Error("Unknown job role.");
      const staffCode = await nextStaffCode(tx, ctx.workspaceId);
      const emp = await tx.employeeProfile.create({
        data: { workspaceId: ctx.workspaceId, memberId: member.id, staffCode, fullName: ctx.user.name, email: ctx.user.email.toLowerCase(), jobRoleId: d.jobRoleId || null, status: "ACTIVE" },
      });
      const titles = await assignRoleCourses(tx, { workspaceId: ctx.workspaceId, employeeId: emp.id, jobRoleId: emp.jobRoleId, reason: "Required for job role (self-enrolled)", fx, employeeName: emp.fullName, employeeEmail: emp.email, workspaceName: ctx.workspace.name, isHire: false });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "EMPLOYEE_CREATED", targetType: "Employee", targetId: emp.id, summary: `${staffCode} ${emp.fullName} added themselves to the training roster${titles.length ? `; ${titles.length} course(s) assigned` : ""}`, metadata: { self: true, courses: titles } });
      return emp.id;
    });
    revalidatePath("/app", "layout");
    return { id };
  });
}
