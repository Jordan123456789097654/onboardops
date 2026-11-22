"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { requireWorkspaceRole, ALL_ROLES, MANAGEMENT_ROLES, canIssueSeverity, requirePerm, requireFeature } from "@/lib/rbac";
import { dispatchEffects, issueInfraction } from "@/lib/automations";
import { notifyRoles } from "@/lib/notify";
import { COLORS, sendEmbed } from "@/lib/webhooks";
import { INCIDENT_TYPES } from "@/lib/constants";
import { storeUpload } from "@/lib/files";
import { run } from "./_util";


const fileSchema = z.object({
  type: z.enum(INCIDENT_TYPES),
  occurredAt: z.string().min(1, "When did it happen?"),
  location: z.string().trim().max(200).default(""),
  description: z.string().trim().min(15, "Describe what happened (15+ characters)").max(4000),
  anonymous: z.boolean().default(false),
});

/** Any signed-in user may file a report. Good-faith reports are protected by the stop-work and non-retaliation rules in the Acceptable Use Policy. */
export async function fileIncidentAction(input: unknown) {
  return run(async () => {
    const ctx = await requireFeature("incidents");
    const form = input instanceof FormData ? input : null;
    const d = fileSchema.parse(form ? JSON.parse(String(form.get("json") ?? "{}")) : input);
    const files = form ? form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 2) : [];
    for (const f of files) if (!f.type.startsWith("image/")) throw new Error("Photos must be images (PNG, JPG or WEBP).");
    const who = d.anonymous ? "Anonymous" : ctx.user.name;
    const photoFileIds: string[] = [];
    for (const f of files) photoFileIds.push((await storeUpload(ctx.workspaceId, f, who)).id);
    const when = new Date(d.occurredAt);
    if (isNaN(when.getTime())) throw new Error("Enter a valid date and time.");
    if (when.getTime() > Date.now() + 3600_000) throw new Error("The incident date cannot be in the future.");
    const inc = await prisma.$transaction(async (tx) => {
      const inc = await tx.incidentReport.create({ data: { workspaceId: ctx.workspaceId, reporterEmployeeId: d.anonymous ? null : ctx.profile?.id ?? null, reportedByName: who, anonymous: d.anonymous, photoFileIds, type: d.type, occurredAt: when, location: d.location, description: d.description } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: d.anonymous ? null : ctx.id, actorName: who, actionType: "INCIDENT_FILED", targetType: "Incident", targetId: inc.id, summary: `${d.type.replace(/_/g, " ")} reported by ${who}${d.location ? ` at ${d.location}` : ""}` });
      await notifyRoles(tx, ctx.workspaceId, ["OWNER", "ADMIN", "MANAGER", "SUPERVISOR"], { title: `New incident: ${d.type.replace(/_/g, " ").toLowerCase()}`, body: d.description.slice(0, 120), href: "/app/incidents" }, ctx.id);
      return inc;
    });
    await sendEmbed(ctx.workspace.operationsWebhookUrl, { title: `Incident reported: ${d.type.replace(/_/g, " ")}`, description: d.location || undefined, color: d.type === "INJURY" ? COLORS.danger : COLORS.warn, fields: [{ name: "Reported by", value: ctx.user.name, inline: true }] });
    revalidatePath("/app", "layout");
    return { id: inc.id };
  });
}

const reviewSchema = z.object({ status: z.enum(["NEW", "REVIEWING", "CLOSED"]), reviewerNotes: z.string().trim().max(4000).default(""), investigatorMemberId: z.string().optional().or(z.literal("")), investigationDue: z.string().optional().or(z.literal("")), injury: z.object({ bodyPart: z.string().trim().max(80).default(""), treatment: z.string().trim().max(80).default(""), daysAway: z.coerce.number().int().min(0).max(365).default(0) }).optional() });

export async function updateIncidentAction(id: string, input: unknown) {
  return run(async () => {
    const ctx = await requirePerm("incidents.review", "incidents");
    const d = reviewSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      const inc = await tx.incidentReport.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
      if (!inc) throw new Error("Incident not found.");
      if (inc.status === "CONVERTED") throw new Error("This incident was already turned into a case.");
      let investigatorName: string | null = null;
      if (d.investigatorMemberId) {
        const m = await tx.workspaceMember.findFirst({ where: { id: d.investigatorMemberId, workspaceId: ctx.workspaceId }, include: { user: true } });
        if (!m) throw new Error("Investigator not found.");
        investigatorName = m.user.name;
      }
      const due = d.investigationDue ? new Date(d.investigationDue) : null;
      if (due && isNaN(due.getTime())) throw new Error("Enter a valid due date.");
      await tx.incidentReport.update({ where: { id }, data: { status: d.status, reviewerNotes: d.reviewerNotes, investigatorMemberId: d.investigatorMemberId || null, investigatorName, investigationDue: due, ...(d.injury ? { injury: d.injury } : {}) } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "INCIDENT_UPDATED", targetType: "Incident", targetId: id, summary: `Incident status ${inc.status} → ${d.status}` });
    });
    revalidatePath("/app", "layout");
    return undefined;
  });
}

const convertSchema = z.object({
  employeeId: z.string().min(1, "Pick the employee the case is about"),
  severity: z.enum(["VERBAL_WARNING", "WRITTEN_INFRACTION", "STRIKE_POINTS", "SUSPENSION", "TERMINATION"]),
  pointsAdded: z.coerce.number().int().min(0).max(20).default(0),
  policyViolated: z.string().trim().min(3, "Name the policy that was violated"),
  summary: z.string().trim().min(10, "Describe what happened"),
  confidentialManagerNotes: z.string().default(""),
});

/** Turns a report into an infraction case through the same automation as the Infractions page. */
export async function convertIncidentAction(id: string, input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(MANAGEMENT_ROLES);
    const d = convertSchema.parse(input);
    if (!canIssueSeverity(ctx.role, d.severity)) throw new Error("Your role cannot issue this severity.");
    const inc = await prisma.incidentReport.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
    if (!inc) throw new Error("Incident not found.");
    if (inc.status === "CONVERTED") throw new Error("This incident was already turned into a case.");
    const out = await issueInfraction(ctx, { employeeId: d.employeeId, severity: d.severity, pointsAdded: d.pointsAdded, policyViolated: d.policyViolated, summary: d.summary, evidenceUrls: [], confidentialManagerNotes: d.confidentialManagerNotes });
    await prisma.$transaction(async (tx) => {
      await tx.incidentReport.update({ where: { id }, data: { status: "CONVERTED", convertedCaseNumber: out.caseNumber } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "INCIDENT_CONVERTED", targetType: "Incident", targetId: id, summary: `Incident converted to ${out.caseNumber}` });
    });
    await dispatchEffects(ctx, out.fx);
    revalidatePath("/app", "layout");
    return { caseNumber: out.caseNumber };
  });
}
