"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { requireWorkspaceRole, MANAGEMENT_ROLES, STAFF_ROLES, ALL_ROLES, requirePerm } from "@/lib/rbac";
import { run } from "./_util";

const templateSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(3, "Give the checklist a title"),
  shiftType: z.enum(["OPENING", "MID_SHIFT", "CLOSING"]),
  departmentId: z.string().optional().or(z.literal("")),
  items: z.array(z.object({ id: z.string().min(1), label: z.string().trim().min(1, "Every item needs a label"), required: z.boolean() })).min(1, "Add at least one item"),
});

export async function saveTemplateAction(input: unknown) {
  return run(async () => {
    const ctx = await requirePerm("checklists.manage");
    const d = templateSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      const data = { title: d.title, shiftType: d.shiftType, departmentId: d.departmentId || null, items: d.items };
      let id = d.id;
      if (id) {
        const ex = await tx.shiftChecklistTemplate.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
        if (!ex) throw new Error("Template not found.");
        await tx.shiftChecklistTemplate.update({ where: { id }, data });
      } else {
        id = (await tx.shiftChecklistTemplate.create({ data: { ...data, workspaceId: ctx.workspaceId } })).id;
      }
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: d.id ? "CHECKLIST_UPDATED" : "CHECKLIST_CREATED", targetType: "Checklist", targetId: id, summary: `Checklist "${d.title}" ${d.id ? "updated" : "created"}` });
    });
    revalidatePath("/app", "layout");
    return undefined;
  });
}

const submitSchema = z.object({ completedIds: z.array(z.string()), handoffNotes: z.string().trim().default("") });

export async function submitChecklistAction(templateId: string, input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ALL_ROLES);
    if (!ctx.profile) throw new Error("No employee profile is linked to your login.");
    const d = submitSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      const t = await tx.shiftChecklistTemplate.findFirst({ where: { id: templateId, workspaceId: ctx.workspaceId } });
      if (!t) throw new Error("Checklist not found.");
      const items = t.items as { id: string; label: string; required: boolean }[];
      const missing = items.filter((i) => i.required && !d.completedIds.includes(i.id));
      if (missing.length) throw new Error(`Complete required items: ${missing.map((m) => m.label).join(", ")}`);
      const sub = await tx.shiftChecklistSubmission.create({ data: { workspaceId: ctx.workspaceId, templateId, completedByEmployeeId: ctx.profile!.id, completedItems: d.completedIds.filter((id) => items.some((i) => i.id === id)), handoffNotes: d.handoffNotes } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "CHECKLIST_SUBMITTED", targetType: "Checklist", targetId: sub.id, summary: `${ctx.profile!.staffCode} submitted "${t.title}"` });
    });
    revalidatePath("/app", "layout");
    return undefined;
  });
}

export async function verifyChecklistAction(submissionId: string) {
  return run(async () => {
    const ctx = await requirePerm("checklists.verify");
    await prisma.$transaction(async (tx) => {
      const s = await tx.shiftChecklistSubmission.findFirst({ where: { id: submissionId, workspaceId: ctx.workspaceId }, include: { template: true } });
      if (!s) throw new Error("Submission not found.");
      if (s.verifiedAt) throw new Error("Already verified.");
      await tx.shiftChecklistSubmission.update({ where: { id: submissionId }, data: { verifiedByName: ctx.user.name, verifiedAt: new Date() } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "CHECKLIST_VERIFIED", targetType: "Checklist", targetId: submissionId, summary: `"${s.template.title}" verified by ${ctx.user.name}` });
    });
    revalidatePath("/app", "layout");
    return undefined;
  });
}
