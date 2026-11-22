"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { requireWorkspaceRole, ADMIN_ROLES } from "@/lib/rbac";
import { sendEmbed, validWebhookUrl, COLORS } from "@/lib/webhooks";
import { run } from "./_util";

const url = z.string().trim().refine((v) => v === "" || validWebhookUrl(v), "Webhook must be an https Discord, Slack or Microsoft Teams URL").default("");

const settingsSchema = z.object({
  name: z.string().trim().min(2, "Workspace name is required"),
  operationsWebhookUrl: url,
  confidentialWebhookUrl: url,
  autoSuspendStrikeThreshold: z.coerce.number().int().min(1).max(50),
  autoRetrainOnWrittenInfraction: z.boolean(),
  remindersEnabled: z.boolean().default(true),
});

export async function saveSettingsAction(input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    const d = settingsSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({ where: { id: ctx.workspaceId }, data: { name: d.name, operationsWebhookUrl: d.operationsWebhookUrl || null, confidentialWebhookUrl: d.confidentialWebhookUrl || null, autoSuspendStrikeThreshold: d.autoSuspendStrikeThreshold, autoRetrainOnWrittenInfraction: d.autoRetrainOnWrittenInfraction, remindersEnabled: d.remindersEnabled } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "SETTINGS_UPDATED", targetType: "Workspace", targetId: ctx.workspaceId, summary: `Settings updated (suspend at ${d.autoSuspendStrikeThreshold} points, auto-retrain ${d.autoRetrainOnWrittenInfraction ? "on" : "off"})` });
    });
    revalidatePath("/app", "layout");
    return undefined;
  });
}

export async function testWebhookAction(kind: "operations" | "confidential", urlOverride?: string) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    const target = urlOverride?.trim() || (kind === "operations" ? ctx.workspace.operationsWebhookUrl : ctx.workspace.confidentialWebhookUrl);
    if (!target) throw new Error("Enter a webhook URL first.");
    const r = await sendEmbed(target, {
      title: `Test embed — ${kind === "operations" ? "Operations" : "Confidential HR"} channel`,
      description: `Sent by ${ctx.user.name} from ${ctx.workspace.name}. If you can read this, the webhook works.`,
      color: COLORS.info,
    });
    if (!r.ok) throw new Error(r.error);
    return undefined;
  });
}

export async function saveDepartmentAction(input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    const d = z.object({ id: z.string().optional(), name: z.string().trim().min(2, "Department name is required"), colorCode: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #52525B") }).parse(input);
    await prisma.$transaction(async (tx) => {
      if (d.id) {
        if (!(await tx.department.findFirst({ where: { id: d.id, workspaceId: ctx.workspaceId } }))) throw new Error("Department not found.");
        await tx.department.update({ where: { id: d.id }, data: { name: d.name, colorCode: d.colorCode } });
      } else {
        await tx.department.create({ data: { workspaceId: ctx.workspaceId, name: d.name, colorCode: d.colorCode } });
      }
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: d.id ? "DEPARTMENT_UPDATED" : "DEPARTMENT_CREATED", targetType: "Department", targetId: d.id ?? "new", summary: `Department "${d.name}" saved` });
    });
    revalidatePath("/app", "layout");
    return undefined;
  });
}

export async function saveJobRoleAction(input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    const d = z.object({ id: z.string().optional(), title: z.string().trim().min(2, "Job title is required"), description: z.string().trim().default(""), requiredCourseIds: z.array(z.string()) }).parse(input);
    await prisma.$transaction(async (tx) => {
      const valid = await tx.course.findMany({ where: { id: { in: d.requiredCourseIds }, workspaceId: ctx.workspaceId }, select: { id: true } });
      const data = { title: d.title, description: d.description, requiredCourseIds: valid.map((v) => v.id) };
      if (d.id) {
        if (!(await tx.jobRole.findFirst({ where: { id: d.id, workspaceId: ctx.workspaceId } }))) throw new Error("Job role not found.");
        await tx.jobRole.update({ where: { id: d.id }, data });
      } else {
        await tx.jobRole.create({ data: { ...data, workspaceId: ctx.workspaceId } });
      }
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: d.id ? "JOB_ROLE_UPDATED" : "JOB_ROLE_CREATED", targetType: "JobRole", targetId: d.id ?? "new", summary: `Job role "${d.title}" saved with ${valid.length} required course(s)` });
    });
    revalidatePath("/app", "layout");
    return undefined;
  });
}

export async function saveWorkspaceMetaAction(input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    const d = z.object({
      strikeDecayDays: z.coerce.number().int().min(0).max(730).refine((n) => n === 0 || n >= 7, "Use 0 (off) or at least 7 days"),
      accentColor: z.string().trim().regex(/^(#[0-9a-fA-F]{6})?$/, "Use a #RRGGBB color").default(""),
      tagline: z.string().trim().max(140).default(""),
    }).parse(input);
    const ws = await prisma.workspace.findUnique({ where: { id: ctx.workspaceId }, select: { features: true } });
    const prev = ((ws?.features ?? {}) as Record<string, unknown>);
    const prevBrand = ((prev.__branding ?? {}) as Record<string, unknown>);
    const next = { ...prev, __strikeDecayDays: d.strikeDecayDays, __branding: { ...prevBrand, accentColor: d.accentColor, tagline: d.tagline } };
    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({ where: { id: ctx.workspaceId }, data: { features: next as never } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "SETTINGS_UPDATED", targetType: "Workspace", targetId: ctx.workspaceId, summary: `Strike decay ${d.strikeDecayDays || "off"} days; branding updated` });
    });
    revalidatePath("/app", "layout");
    return undefined;
  });
}
