"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { requireWorkspaceRole, requirePerm, requireFeature, ADMIN_ROLES, hasFeature } from "@/lib/rbac";
import { notifyEmployee, notifyRoles } from "@/lib/notify";
import { run } from "./_util";

const done = () => revalidatePath("/app", "layout");
const SEV = ["VERBAL_WARNING", "WRITTEN_INFRACTION", "STRIKE_POINTS", "SUSPENSION", "TERMINATION"] as const;

/* Corrective-action templates */
export async function saveCaseTemplateAction(input: unknown) {
  return run(async () => {
    const ctx = await requirePerm("training.build", "caseTemplates");
    const d = z.object({ id: z.string().optional(), name: z.string().trim().min(2).max(80), severity: z.enum(SEV), points: z.coerce.number().int().min(0).max(20), policy: z.string().trim().min(3), summary: z.string().trim().min(5).max(2000) }).parse(input);
    await prisma.$transaction(async (tx) => {
      const data = { name: d.name, severity: d.severity, points: d.points, policy: d.policy, summary: d.summary };
      if (d.id) await tx.caseTemplate.updateMany({ where: { id: d.id, workspaceId: ctx.workspaceId }, data });
      else await tx.caseTemplate.create({ data: { ...data, workspaceId: ctx.workspaceId } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "CASE_TEMPLATE_SAVED", targetType: "Workspace", targetId: ctx.workspaceId, summary: `Case template "${d.name}" saved` });
    });
    done();
    return undefined;
  });
}

/* Progressive discipline rules */
export async function saveDisciplineRuleAction(input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    if (!hasFeature(ctx, "progressive")) throw new Error("Progressive discipline is turned off.");
    const d = z.object({ whenSeverity: z.enum(SEV), count: z.coerce.number().int().min(2).max(10), withinDays: z.coerce.number().int().min(7).max(730), escalateTo: z.enum(SEV), enabled: z.boolean().default(true) }).parse(input);
    if (SEV.indexOf(d.escalateTo) <= SEV.indexOf(d.whenSeverity)) throw new Error("The escalation must be more serious than the trigger.");
    await prisma.$transaction(async (tx) => {
      await tx.disciplineRule.create({ data: { ...d, workspaceId: ctx.workspaceId } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "DISCIPLINE_RULE_ADDED", targetType: "Workspace", targetId: ctx.workspaceId, summary: `Rule: ${d.count} x ${d.whenSeverity} in ${d.withinDays} days, escalate to ${d.escalateTo}` });
    });
    done();
    return undefined;
  });
}

export async function deleteDisciplineRuleAction(id: string) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    await prisma.disciplineRule.deleteMany({ where: { id, workspaceId: ctx.workspaceId } });
    done();
    return undefined;
  });
}

/* Witness statements and evidence on cases */
export async function addCaseAttachmentAction(caseId: string, input: unknown) {
  return run(async () => {
    const ctx = await requirePerm("training.build", "evidence");
    const d = z.object({ kind: z.enum(["WITNESS", "EVIDENCE"]), title: z.string().trim().min(2).max(120), statement: z.string().trim().max(5000).default("") }).parse(input);
    const c = await prisma.infractionCase.findFirst({ where: { id: caseId, workspaceId: ctx.workspaceId } });
    if (!c) throw new Error("Case not found.");
    await prisma.$transaction(async (tx) => {
      await tx.caseAttachment.create({ data: { caseId, kind: d.kind, title: d.title, statement: d.statement, authorName: ctx.user.name } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "CASE_ATTACHMENT_ADDED", targetType: "Infraction", targetId: caseId, summary: `${c.caseNumber}: ${d.kind.toLowerCase()} "${d.title}" added` });
    });
    done();
    return undefined;
  });
}

/* Appeals: filed by the employee, decided by a reviewer who did not issue the case */
export async function fileAppealAction(caseId: string, input: unknown) {
  return run(async () => {
    const ctx = await requireFeature("appeals");
    const me = ctx.profile;
    if (!me) throw new Error("No employee profile is linked to your login.");
    const d = z.object({ reason: z.string().trim().min(10, "Explain why you disagree (10+ characters)").max(3000) }).parse(input);
    const c = await prisma.infractionCase.findFirst({ where: { id: caseId, employeeId: me.id, workspaceId: ctx.workspaceId } });
    if (!c) throw new Error("Case not found.");
    if (await prisma.appeal.count({ where: { caseId, status: "OPEN" } })) throw new Error("An appeal is already open for this case.");
    await prisma.$transaction(async (tx) => {
      await tx.appeal.create({ data: { workspaceId: ctx.workspaceId, caseId, filedByName: me.fullName, reason: d.reason } });
      await tx.infractionTimelineEvent.create({ data: { caseId, actorMemberId: ctx.id, actorName: me.fullName, eventType: "APPEAL_LOGGED", note: d.reason.slice(0, 400) } });
      await notifyRoles(tx, ctx.workspaceId, ["OWNER", "ADMIN", "MANAGER"], { title: `Appeal filed on ${c.caseNumber}`, href: "/app/infractions" }, ctx.id);
    });
    done();
    return undefined;
  });
}

export async function decideAppealAction(appealId: string, input: unknown) {
  return run(async () => {
    const ctx = await requirePerm("requests.decide", "appeals");
    const d = z.object({ decision: z.enum(["UPHELD", "OVERTURNED"]), note: z.string().trim().min(5, "Explain the decision").max(3000) }).parse(input);
    await prisma.$transaction(async (tx) => {
      const a = await tx.appeal.findFirst({ where: { id: appealId, workspaceId: ctx.workspaceId, status: "OPEN" }, include: { case: true } });
      if (!a) throw new Error("Appeal not found or already decided.");
      if (a.case.issuedByMemberId === ctx.id) throw new Error("The person who issued the case cannot decide its appeal.");
      await tx.appeal.update({ where: { id: appealId }, data: { status: d.decision, reviewerName: ctx.user.name, reviewerMemberId: ctx.id, decisionNote: d.note, decidedAt: new Date() } });
      await tx.infractionTimelineEvent.create({ data: { caseId: a.caseId, actorMemberId: ctx.id, actorName: ctx.user.name, eventType: "NOTE_ADDED", note: `Appeal ${d.decision.toLowerCase()}: ${d.note}` } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "APPEAL_DECIDED", targetType: "Infraction", targetId: a.caseId, summary: `${a.case.caseNumber} appeal ${d.decision.toLowerCase()} by ${ctx.user.name}` });
      await notifyEmployee(tx, ctx.workspaceId, a.case.employeeId, { title: `Your appeal was ${d.decision.toLowerCase()}`, body: d.note.slice(0, 120), href: "/app/my-portal" });
    });
    done();
    return undefined;
  });
}

/* Safety incident details */
export async function updateSafetyDetailsAction(id: string, input: unknown) {
  return run(async () => {
    const ctx = await requirePerm("incidents.review", "safetyLog");
    const d = z.object({ severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]), rootCause: z.string().trim().max(3000).default(""), actions: z.array(z.object({ text: z.string().trim().min(2).max(300), owner: z.string().trim().max(80).default(""), done: z.boolean().default(false) })).max(20).default([]) }).parse(input);
    await prisma.$transaction(async (tx) => {
      const r = await tx.incidentReport.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
      if (!r) throw new Error("Incident not found.");
      await tx.incidentReport.update({ where: { id }, data: { severity: d.severity, rootCause: d.rootCause, actions: d.actions } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "SAFETY_DETAILS_UPDATED", targetType: "Incident", targetId: id, summary: `Incident marked ${d.severity}, ${d.actions.length} corrective action(s)` });
    });
    done();
    return undefined;
  });
}
