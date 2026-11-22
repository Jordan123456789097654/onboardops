"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { requireWorkspaceRole, requirePerm, requireFeature, ADMIN_ROLES, MANAGEMENT_ROLES, hasFeature } from "@/lib/rbac";
import { notifyEmployee, notifyRoles } from "@/lib/notify";
import { run } from "./_util";

const done = () => revalidatePath("/app", "layout");
const d0 = (s?: string | null) => (s ? new Date(`${s}T00:00:00Z`) : null);

/* ---------------- Setup wizard ---------------- */
export async function finishSetupAction() {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    await prisma.workspace.update({ where: { id: ctx.workspaceId }, data: { setupDone: true } });
    done();
    return undefined;
  });
}

/* ---------------- Credentials ---------------- */
const credSchema = z.object({ id: z.string().optional(), employeeId: z.string().min(1, "Pick an employee"), name: z.string().trim().min(2, "Name the credential").max(120), number: z.string().trim().max(80).default(""), issuer: z.string().trim().max(120).default(""), issuedAt: z.string().optional().or(z.literal("")), expiresAt: z.string().optional().or(z.literal("")) });

export async function saveCredentialAction(input: unknown) {
  return run(async () => {
    const ctx = await requirePerm("credentials.manage", "credentials");
    const d = credSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      const emp = await tx.employeeProfile.findFirst({ where: { id: d.employeeId, workspaceId: ctx.workspaceId } });
      if (!emp) throw new Error("Employee not found.");
      const data = { name: d.name, number: d.number, issuer: d.issuer, issuedAt: d0(d.issuedAt), expiresAt: d0(d.expiresAt), remindedAt: null };
      if (d.id) {
        if (!(await tx.credential.findFirst({ where: { id: d.id, workspaceId: ctx.workspaceId } }))) throw new Error("Credential not found.");
        await tx.credential.update({ where: { id: d.id }, data });
      } else await tx.credential.create({ data: { ...data, workspaceId: ctx.workspaceId, employeeId: emp.id } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: d.id ? "CREDENTIAL_UPDATED" : "CREDENTIAL_ADDED", targetType: "Employee", targetId: emp.id, summary: `${emp.staffCode} credential "${d.name}" ${d.id ? "updated" : "added"}${d.expiresAt ? `, expires ${d.expiresAt}` : ""}` });
    });
    done();
    return undefined;
  });
}

export async function deleteCredentialAction(id: string) {
  return run(async () => {
    const ctx = await requirePerm("credentials.manage", "credentials");
    await prisma.$transaction(async (tx) => {
      const c = await tx.credential.findFirst({ where: { id, workspaceId: ctx.workspaceId }, include: { employee: true } });
      if (!c) throw new Error("Credential not found.");
      await tx.credential.delete({ where: { id } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "CREDENTIAL_REMOVED", targetType: "Employee", targetId: c.employeeId, summary: `${c.employee.staffCode} credential "${c.name}" removed` });
    });
    done();
    return undefined;
  });
}

/* ---------------- Employee self-service profile changes ---------------- */
const changeSchema = z.object({ phone: z.string().trim().max(40).optional(), emergencyContact: z.string().trim().max(200).optional() });

export async function submitProfileChangeAction(input: unknown) {
  return run(async () => {
    const ctx = await requireFeature("selfService");
    const me = ctx.profile;
    if (!me) throw new Error("No employee profile is linked to your login.");
    const d = changeSchema.parse(input);
    const changes: Record<string, string> = {};
    if (d.phone !== undefined && d.phone !== (me.phone ?? "")) changes.phone = d.phone;
    if (d.emergencyContact !== undefined && d.emergencyContact !== (me.emergencyContact ?? "")) changes.emergencyContact = d.emergencyContact;
    if (!Object.keys(changes).length) throw new Error("Nothing changed.");
    if (await prisma.profileChangeRequest.count({ where: { employeeId: me.id, status: "PENDING" } })) throw new Error("You already have a pending update. Wait for a decision first.");
    await prisma.$transaction(async (tx) => {
      await tx.profileChangeRequest.create({ data: { workspaceId: ctx.workspaceId, employeeId: me.id, changes } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "PROFILE_CHANGE_REQUESTED", targetType: "Employee", targetId: me.id, summary: `${me.staffCode} asked to update ${Object.keys(changes).join(" and ")}` });
      await notifyRoles(tx, ctx.workspaceId, ["OWNER", "ADMIN", "MANAGER"], { title: `${me.fullName} asked to update their details`, href: "/app/requests" }, ctx.id);
    });
    done();
    return undefined;
  });
}

export async function decideProfileChangeAction(id: string, input: unknown) {
  return run(async () => {
    const ctx = await requirePerm("requests.decide", "selfService");
    const d = z.object({ decision: z.enum(["APPROVED", "DENIED"]), note: z.string().trim().max(500).default("") }).parse(input);
    await prisma.$transaction(async (tx) => {
      const r = await tx.profileChangeRequest.findFirst({ where: { id, workspaceId: ctx.workspaceId, status: "PENDING" }, include: { employee: true } });
      if (!r) throw new Error("Request not found or already decided.");
      if (d.decision === "APPROVED") {
        const c = r.changes as { phone?: string; emergencyContact?: string };
        await tx.employeeProfile.update({ where: { id: r.employeeId }, data: { ...(c.phone !== undefined ? { phone: c.phone || null } : {}), ...(c.emergencyContact !== undefined ? { emergencyContact: c.emergencyContact || null } : {}) } });
      }
      await tx.profileChangeRequest.update({ where: { id }, data: { status: d.decision, decidedBy: ctx.user.name, note: d.note, decidedAt: new Date() } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: `PROFILE_CHANGE_${d.decision}`, targetType: "Employee", targetId: r.employeeId, summary: `${r.employee.staffCode} detail update ${d.decision.toLowerCase()}` });
      await notifyEmployee(tx, ctx.workspaceId, r.employeeId, { title: `Your details update was ${d.decision.toLowerCase()}`, body: d.note, href: "/app/my-portal" });
    });
    done();
    return undefined;
  });
}

/* ---------------- Custom fields ---------------- */
const fieldSchema = z.array(z.object({ id: z.string().optional(), label: z.string().trim().min(1, "Every field needs a label").max(60), type: z.enum(["text", "date", "select", "yesno"]), options: z.array(z.string().trim().min(1)).default([]), showToEmployee: z.boolean().default(false) })).max(30);

export async function saveCustomFieldsAction(input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    if (!hasFeature(ctx, "customFields")) throw new Error("Custom fields are turned off for this workspace.");
    const fields = fieldSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      const keep: string[] = [];
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        const data = { label: f.label, type: f.type, options: f.type === "select" ? f.options : [], orderIndex: i, showToEmployee: f.showToEmployee };
        if (f.id && (await tx.customField.findFirst({ where: { id: f.id, workspaceId: ctx.workspaceId } }))) { await tx.customField.update({ where: { id: f.id }, data }); keep.push(f.id); }
        else keep.push((await tx.customField.create({ data: { ...data, workspaceId: ctx.workspaceId } })).id);
      }
      await tx.customField.deleteMany({ where: { workspaceId: ctx.workspaceId, id: { notIn: keep } } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "CUSTOM_FIELDS_UPDATED", targetType: "Workspace", targetId: ctx.workspaceId, summary: `Custom fields updated (${fields.length})` });
    });
    done();
    return undefined;
  });
}

export async function saveEmployeeCustomValuesAction(employeeId: string, input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(MANAGEMENT_ROLES);
    if (!hasFeature(ctx, "customFields")) throw new Error("Custom fields are turned off for this workspace.");
    const values = z.record(z.string().max(300)).parse(input);
    await prisma.$transaction(async (tx) => {
      const emp = await tx.employeeProfile.findFirst({ where: { id: employeeId, workspaceId: ctx.workspaceId } });
      if (!emp) throw new Error("Employee not found.");
      const valid = new Set((await tx.customField.findMany({ where: { workspaceId: ctx.workspaceId }, select: { id: true } })).map((f) => f.id));
      const clean = Object.fromEntries(Object.entries(values).filter(([k, v]) => valid.has(k) && v !== ""));
      await tx.employeeProfile.update({ where: { id: employeeId }, data: { customValues: clean } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "CUSTOM_FIELDS_SET", targetType: "Employee", targetId: employeeId, summary: `${emp.staffCode} custom field values updated` });
    });
    done();
    return undefined;
  });
}

export async function saveTimeOffAllowanceAction(employeeId: string, input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(MANAGEMENT_ROLES);
    const d = z.object({ VACATION: z.coerce.number().min(0).max(365), SICK: z.coerce.number().min(0).max(365), PERSONAL: z.coerce.number().min(0).max(365) }).parse(input);
    await prisma.$transaction(async (tx) => {
      const emp = await tx.employeeProfile.findFirst({ where: { id: employeeId, workspaceId: ctx.workspaceId } });
      if (!emp) throw new Error("Employee not found.");
      await tx.employeeProfile.update({ where: { id: employeeId }, data: { timeOffAllowance: d } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "TIMEOFF_ALLOWANCE_SET", targetType: "Employee", targetId: employeeId, summary: `${emp.staffCode} yearly time off: ${d.VACATION} vacation, ${d.SICK} sick, ${d.PERSONAL} personal` });
    });
    done();
    return undefined;
  });
}
