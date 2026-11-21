"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { requireWorkspaceRole, STAFF_ROLES, ALL_ROLES, canIssueSeverity, canSeeConfidential } from "@/lib/rbac";
import { dispatchEffects, issueInfraction, newEffects } from "@/lib/automations";
import { emails } from "@/lib/email";
import { COLORS } from "@/lib/webhooks";
import { notifyMembers } from "@/lib/notify";
import { run } from "./_util";

const issueSchema = z.object({
  employeeId: z.string().min(1, "Pick an employee"),
  severity: z.enum(["VERBAL_WARNING", "WRITTEN_INFRACTION", "STRIKE_POINTS", "SUSPENSION", "TERMINATION"]),
  pointsAdded: z.coerce.number().int().min(0).max(20).default(0),
  policyViolated: z.string().trim().min(3, "Name the policy that was violated"),
  summary: z.string().trim().min(10, "Describe what happened (10+ characters)"),
  evidenceUrls: z.array(z.string().url("Evidence links must be full URLs")).default([]),
  confidentialManagerNotes: z.string().default(""),
});

export async function issueInfractionAction(input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(STAFF_ROLES);
    const d = issueSchema.parse(input);
    if (!canIssueSeverity(ctx.role, d.severity)) throw new Error("Your role cannot issue this severity.");
    if (d.pointsAdded > 0 && ctx.role === "SUPERVISOR" && d.severity !== "WRITTEN_INFRACTION") throw new Error("Supervisors cannot add strike points.");
    if (d.confidentialManagerNotes && !canSeeConfidential(ctx.role)) d.confidentialManagerNotes = "";
    if (d.severity === "STRIKE_POINTS" && d.pointsAdded < 1) throw new Error("Strike point cases need at least 1 point.");
    const out = await issueInfraction(ctx, d);
    await dispatchEffects(ctx, out.fx);
    revalidatePath("/app", "layout");
    return { id: out.id, caseNumber: out.caseNumber, effects: out.effects };
  });
}

const noteSchema = z.object({ note: z.string().trim().min(3, "Write a note"), isConfidential: z.boolean().default(false) });

/** Append-only: notes are added, never edited or removed. */
export async function addCaseNoteAction(caseId: string, input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(STAFF_ROLES);
    const d = noteSchema.parse(input);
    if (d.isConfidential && !canSeeConfidential(ctx.role)) throw new Error("Only managers and above can add confidential notes.");
    await prisma.$transaction(async (tx) => {
      const c = await tx.infractionCase.findFirst({ where: { id: caseId, workspaceId: ctx.workspaceId } });
      if (!c) throw new Error("Case not found.");
      await tx.infractionTimelineEvent.create({ data: { caseId, actorMemberId: ctx.id, actorName: ctx.user.name, eventType: "NOTE_ADDED", note: d.note, isConfidential: d.isConfidential } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "CASE_NOTE_ADDED", targetType: "Infraction", targetId: caseId, summary: `${c.caseNumber}: ${d.isConfidential ? "confidential " : ""}note added` });
    });
    revalidatePath("/app", "layout");
    return undefined;
  });
}

export async function logAppealAction(caseId: string, input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(STAFF_ROLES);
    const d = z.object({ note: z.string().trim().min(5, "Describe the appeal") }).parse(input);
    await prisma.$transaction(async (tx) => {
      const c = await tx.infractionCase.findFirst({ where: { id: caseId, workspaceId: ctx.workspaceId } });
      if (!c) throw new Error("Case not found.");
      await tx.infractionTimelineEvent.create({ data: { caseId, actorMemberId: ctx.id, actorName: ctx.user.name, eventType: "APPEAL_LOGGED", note: d.note } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "APPEAL_LOGGED", targetType: "Infraction", targetId: caseId, summary: `${c.caseNumber}: appeal logged` });
    });
    revalidatePath("/app", "layout");
    return undefined;
  });
}

export async function acknowledgeInfractionAction(caseId: string, input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ALL_ROLES);
    const d = z.object({ signatureName: z.string().trim().min(2, "Type your full name to sign") }).parse(input);
    if (!ctx.profile) throw new Error("No employee profile is linked to your login.");
    const fx = newEffects();
    await prisma.$transaction(async (tx) => {
      const c = await tx.infractionCase.findFirst({ where: { id: caseId, workspaceId: ctx.workspaceId, employeeId: ctx.profile!.id }, include: { issuedBy: { include: { user: true } } } });
      if (!c) throw new Error("Case not found.");
      if (c.employeeAcknowledged) throw new Error("This case is already acknowledged.");
      if (d.signatureName.toLowerCase() !== ctx.profile!.fullName.toLowerCase()) throw new Error(`Type your name exactly as it appears on your record: ${ctx.profile!.fullName}`);
      await tx.infractionCase.update({ where: { id: caseId }, data: { employeeAcknowledged: true, employeeSignatureName: d.signatureName, acknowledgedAt: new Date() } });
      await tx.infractionTimelineEvent.create({ data: { caseId, actorMemberId: ctx.id, actorName: ctx.user.name, eventType: "ACKNOWLEDGED", note: `Signed as "${d.signatureName}". Acknowledgment confirms receipt, not agreement.` } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "INFRACTION_ACKNOWLEDGED", targetType: "Infraction", targetId: caseId, summary: `${c.caseNumber} acknowledged by ${ctx.profile!.staffCode}` });
      await notifyMembers(tx, ctx.workspaceId, [c.issuedByMemberId], { title: `${c.caseNumber} was acknowledged`, body: `${ctx.profile!.fullName} signed`, href: "/app/infractions" });
      fx.confidential.push({ title: `${c.caseNumber} acknowledged`, description: `${ctx.profile!.fullName} signed`, color: COLORS.ok });
      fx.mail.push({ to: c.issuedBy.user.email, ...emails.acknowledged(c.issuedBy.user.name, ctx.profile!.fullName, c.caseNumber) });
    });
    await dispatchEffects(ctx, fx);
    revalidatePath("/app", "layout");
    return undefined;
  });
}
