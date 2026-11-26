"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { requirePerm } from "@/lib/rbac";
import { notifyEmployee } from "@/lib/notify";
import { run } from "./_util";

/** Reassigns a course to someone who already attempted it. Their earlier results stay on record. */
/** Takes a course off someone's list. Their past attempts and answers stay on record. */
export async function unenrollAction(enrollmentId: string) {
  return run(async () => {
    const ctx = await requirePerm("training.assign");
    const en = await prisma.courseEnrollment.findFirst({ where: { id: enrollmentId, workspaceId: ctx.workspaceId }, include: { employee: true, course: true } });
    if (!en) throw new Error("Enrollment not found.");
    await prisma.$transaction(async (tx) => {
      await tx.courseEnrollment.delete({ where: { id: en.id } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "COURSE_UNENROLLED", targetType: "Employee", targetId: en.employeeId, summary: `${en.employee.staffCode} removed from "${en.course.title}"` });
    });
    revalidatePath("/app/training/compliance");
    return { ok: true };
  });
}

export async function reassignEnrollmentAction(enrollmentId: string, reason: string) {
  return run(async () => {
    const ctx = await requirePerm("training.assign");
    const why = reason.trim().slice(0, 300) || "Reassigned for another attempt";
    const en = await prisma.courseEnrollment.findFirst({ where: { id: enrollmentId, workspaceId: ctx.workspaceId }, include: { employee: true, course: true } });
    if (!en) throw new Error("Enrollment not found.");
    await prisma.$transaction(async (tx) => {
      await tx.courseEnrollment.update({
        where: { id: en.id },
        data: { status: "ASSIGNED", bestScore: null, completedAt: null, certificateCode: null, expiresAt: null, reminderStage: 0, reminderSentAt: null, assignedReason: why, dueDate: new Date(Date.now() + 14 * 86400000) },
      });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "COURSE_REASSIGNED", targetType: "Employee", targetId: en.employeeId, summary: `${en.employee.staffCode} reassigned "${en.course.title}": ${why}` });
      await notifyEmployee(tx, ctx.workspaceId, en.employeeId, { title: `Training reassigned: ${en.course.title}`, body: why, href: `/app/training/course/${en.courseId}` });
    });
    revalidatePath("/app/training/compliance");
    return { ok: true };
  });
}
