"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { requireWorkspaceRole, MANAGEMENT_ROLES } from "@/lib/rbac";
import { notifyEmployee } from "@/lib/notify";
import { run } from "./_util";

const schema = z.object({
  id: z.string().optional(),
  employeeId: z.string().min(1),
  kind: z.enum(["ONE_ON_ONE", "REVIEW"]),
  periodLabel: z.string().trim().max(60).default(""),
  rating: z.coerce.number().int().min(1).max(5).nullable().optional(),
  summary: z.string().trim().max(5000).default(""),
  strengths: z.string().trim().max(5000).default(""),
  improvements: z.string().trim().max(5000).default(""),
  goals: z.string().trim().max(5000).default(""),
  privateNotes: z.string().trim().max(5000).default(""),
  share: z.boolean(),
});

/**
 * Reviews and 1:1 notes follow the confidential-notes model: only Owners, Admins and Managers can read or write them.
 * Drafts can be edited. Sharing publishes everything except the private notes to the employee and locks the entry.
 */
export async function saveReviewAction(input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(MANAGEMENT_ROLES);
    const d = schema.parse(input);
    if (!d.summary && !d.strengths && !d.improvements && !d.goals && !d.privateNotes) throw new Error("Write something before saving.");
    if (d.share && !d.summary && !d.strengths && !d.improvements && !d.goals) throw new Error("Add something the employee can see before sharing (private notes are never shared).");
    await prisma.$transaction(async (tx) => {
      const emp = await tx.employeeProfile.findFirst({ where: { id: d.employeeId, workspaceId: ctx.workspaceId } });
      if (!emp) throw new Error("Employee not found.");
      const data = { kind: d.kind, periodLabel: d.periodLabel, rating: d.rating ?? null, summary: d.summary, strengths: d.strengths, improvements: d.improvements, goals: d.goals, privateNotes: d.privateNotes };
      let id = d.id;
      if (id) {
        const ex = await tx.review.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
        if (!ex) throw new Error("Entry not found.");
        if (ex.status === "SHARED") throw new Error("Shared entries are locked. Create a new entry instead.");
        await tx.review.update({ where: { id }, data: { ...data, ...(d.share ? { status: "SHARED", sharedAt: new Date() } : {}) } });
      } else {
        id = (await tx.review.create({ data: { ...data, workspaceId: ctx.workspaceId, employeeId: emp.id, authorName: ctx.user.name, authorMemberId: ctx.id, ...(d.share ? { status: "SHARED", sharedAt: new Date() } : {}) } })).id;
      }
      const label = d.kind === "ONE_ON_ONE" ? "1:1 note" : "performance review";
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: d.share ? "REVIEW_SHARED" : d.id ? "REVIEW_UPDATED" : "REVIEW_DRAFTED", targetType: "Employee", targetId: emp.id, summary: `${emp.staffCode} ${label} ${d.share ? "shared with the employee" : "saved as a draft"}` });
      if (d.share) await notifyEmployee(tx, ctx.workspaceId, emp.id, { title: d.kind === "ONE_ON_ONE" ? "A 1:1 summary was shared with you" : "A performance review was shared with you", body: d.periodLabel, href: "/app/my-portal" });
    });
    revalidatePath("/app", "layout");
    return undefined;
  });
}
