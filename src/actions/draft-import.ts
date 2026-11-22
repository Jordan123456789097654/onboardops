"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { requirePerm, requireWorkspaceRole, ADMIN_ROLES } from "@/lib/rbac";
import { run } from "./_util";

const SEV = ["VERBAL_WARNING", "WRITTEN_INFRACTION", "STRIKE_POINTS", "SUSPENSION", "TERMINATION"] as const;

const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("policy"), title: z.string().trim().min(3).max(150), markdown: z.string().max(50000) }),
  z.object({ kind: z.literal("caseTemplate"), name: z.string().trim().min(2).max(80), severity: z.enum(["VERBAL_WARNING", "WRITTEN_INFRACTION", "SUSPENSION"]), policy: z.string().trim().min(3).max(300), summary: z.string().trim().min(5).max(2000) }),
  z.object({ kind: z.literal("ladder"), rules: z.array(z.object({ whenSeverity: z.enum(SEV), count: z.coerce.number().int().min(2).max(10), withinDays: z.coerce.number().int().min(7).max(730), escalateTo: z.enum(SEV) })).min(1).max(6) }),
]);

/** Adds a draft made with the free public tools to the signed-in user's workspace as an unpublished or inactive item. */
export async function importDraftAction(input: unknown) {
  return run(async () => {
    const d = schema.parse(input);
    if (d.kind === "policy") {
      const ctx = await requirePerm("policies.manage", "policies");
      await prisma.$transaction(async (tx) => {
        const p = await tx.policy.create({ data: { workspaceId: ctx.workspaceId, title: d.title, contentMarkdown: d.markdown, appliesToAll: true, isPublished: false } });
        await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "POLICY_CREATED", targetType: "Policy", targetId: p.id, summary: `Policy "${d.title}" added from a free tool draft (unpublished)` });
      });
      revalidatePath("/app", "layout");
      return { what: `Added "${d.title}" as an unpublished policy. Review it under Policies before publishing.`, href: "/app/policies" };
    }
    if (d.kind === "caseTemplate") {
      const ctx = await requirePerm("training.build", "caseTemplates");
      await prisma.$transaction(async (tx) => {
        await tx.caseTemplate.create({ data: { workspaceId: ctx.workspaceId, name: d.name, severity: d.severity, points: 0, policy: d.policy, summary: d.summary } });
        await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "CASE_TEMPLATE_SAVED", targetType: "Workspace", targetId: ctx.workspaceId, summary: `Case template "${d.name}" added from a free tool draft` });
      });
      revalidatePath("/app", "layout");
      return { what: `Added "${d.name}" as a corrective-action template. It appears when you log an infraction.`, href: "/app/infractions" };
    }
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    const bad = d.rules.find((r) => SEV.indexOf(r.escalateTo) <= SEV.indexOf(r.whenSeverity));
    if (bad) throw new Error("Each step must lead to a more serious one.");
    await prisma.$transaction(async (tx) => {
      for (const r of d.rules) await tx.disciplineRule.create({ data: { workspaceId: ctx.workspaceId, whenSeverity: r.whenSeverity, count: r.count, withinDays: r.withinDays, escalateTo: r.escalateTo, enabled: true } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "DISCIPLINE_RULE_ADDED", targetType: "Workspace", targetId: ctx.workspaceId, summary: `${d.rules.length} progressive discipline rules added from a free tool draft` });
    });
    revalidatePath("/app", "layout");
    return { what: `Added ${d.rules.length} progressive discipline rules. Review them under Infractions, Discipline rules.`, href: "/app/infractions" };
  });
}
