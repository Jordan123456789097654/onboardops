"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { requireWorkspaceRole, MANAGEMENT_ROLES } from "@/lib/rbac";
import { run } from "./_util";

/** Informal manager notes. Never an infraction, never shown to the employee, and no strike points. */
export async function addCoachingNoteAction(employeeId: string, input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(MANAGEMENT_ROLES);
    const d = z.object({ note: z.string().trim().min(3, "Write a short note").max(3000) }).parse(input);
    await prisma.$transaction(async (tx) => {
      const emp = await tx.employeeProfile.findFirst({ where: { id: employeeId, workspaceId: ctx.workspaceId } });
      if (!emp) throw new Error("Employee not found.");
      await tx.coachingNote.create({ data: { workspaceId: ctx.workspaceId, employeeId, authorName: ctx.user.name, note: d.note } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "COACHING_NOTE_ADDED", targetType: "Employee", targetId: employeeId, summary: `${emp.staffCode}: coaching note added` });
    });
    revalidatePath("/app", "layout");
    return undefined;
  });
}

export async function deleteCoachingNoteAction(id: string) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(MANAGEMENT_ROLES);
    const n = await prisma.coachingNote.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
    if (!n) throw new Error("Note not found.");
    if (n.authorName !== ctx.user.name && !["OWNER", "ADMIN"].includes(ctx.role)) throw new Error("Only the author or an admin can delete a coaching note.");
    await prisma.$transaction(async (tx) => {
      await tx.coachingNote.delete({ where: { id } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "COACHING_NOTE_DELETED", targetType: "Employee", targetId: n.employeeId, summary: "Coaching note deleted" });
    });
    revalidatePath("/app", "layout");
    return undefined;
  });
}
