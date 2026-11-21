"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { hashPassword } from "@/lib/auth";
import { createToken } from "@/lib/tokens";
import { inviteEmployee } from "@/lib/invites";
import { emails, sendEmail } from "@/lib/email";
import { writeAudit } from "@/lib/audit";
import { requireWorkspaceRole, MANAGEMENT_ROLES, ADMIN_ROLES } from "@/lib/rbac";
import { assignRoleCourses, dispatchEffects, newEffects, nextStaffCode } from "@/lib/automations";
import { COLORS } from "@/lib/webhooks";
import { run } from "./_util";

const employeeSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the employee's full name"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().trim().optional().or(z.literal("")),
  emergencyContact: z.string().trim().optional().or(z.literal("")),
  departmentId: z.string().optional().or(z.literal("")),
  jobRoleId: z.string().optional().or(z.literal("")),
  hireDate: z.string().optional().or(z.literal("")),
  sendInvite: z.boolean().optional(),
  accessRole: z.enum(["EMPLOYEE", "SUPERVISOR", "MANAGER", "ADMIN"]).optional().default("EMPLOYEE"),
});

export async function createEmployeeAction(input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(MANAGEMENT_ROLES);
    const d = employeeSchema.parse(input);
    const fx = newEffects();
    const emp = await prisma.$transaction(async (tx) => {
      if (d.departmentId && !(await tx.department.findFirst({ where: { id: d.departmentId, workspaceId: ctx.workspaceId } }))) throw new Error("Unknown department.");
      const staffCode = await nextStaffCode(tx, ctx.workspaceId);
      const emp = await tx.employeeProfile.create({
        data: {
          workspaceId: ctx.workspaceId,
          staffCode,
          fullName: d.fullName,
          email: d.email.toLowerCase(),
          phone: d.phone || null,
          emergencyContact: d.emergencyContact || null,
          departmentId: d.departmentId || null,
          jobRoleId: d.jobRoleId || null,
          hireDate: d.hireDate ? new Date(d.hireDate) : new Date(),
        },
      });
      const titles = await assignRoleCourses(tx, { workspaceId: ctx.workspaceId, employeeId: emp.id, jobRoleId: emp.jobRoleId, reason: "Required for job role (new hire)", fx, employeeName: emp.fullName, employeeEmail: emp.email, workspaceName: ctx.workspace.name, isHire: true });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "EMPLOYEE_CREATED", targetType: "Employee", targetId: emp.id, summary: `${staffCode} ${emp.fullName} added${titles.length ? `; ${titles.length} course(s) assigned` : ""}`, metadata: { courses: titles } });
      return emp;
    });
    fx.ops.push({ title: `New hire: ${emp.fullName}`, description: `${emp.staffCode} added by ${ctx.user.name}`, color: COLORS.info });
    await dispatchEffects(ctx, fx);
    let invite: { link?: string; emailed?: boolean } = {};
    if (d.sendInvite) { const o = await inviteEmployee(ctx, emp.id, d.accessRole); invite = { link: o.link, emailed: o.emailed }; }
    revalidatePath("/app", "layout");
    return { id: emp.id, ...invite };
  });
}

export async function updateEmployeeAction(id: string, input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(MANAGEMENT_ROLES);
    const d = employeeSchema.parse(input);
    const fx = newEffects();
    await prisma.$transaction(async (tx) => {
      const before = await tx.employeeProfile.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
      if (!before) throw new Error("Employee not found.");
      const roleChanged = (d.jobRoleId || null) !== before.jobRoleId;
      const emp = await tx.employeeProfile.update({
        where: { id },
        data: { fullName: d.fullName, email: d.email.toLowerCase(), phone: d.phone || null, emergencyContact: d.emergencyContact || null, departmentId: d.departmentId || null, jobRoleId: d.jobRoleId || null },
      });
      let titles: string[] = [];
      if (roleChanged) {
        titles = await assignRoleCourses(tx, { workspaceId: ctx.workspaceId, employeeId: id, jobRoleId: emp.jobRoleId, reason: "Required for new job role", fx, employeeName: emp.fullName, employeeEmail: emp.email, workspaceName: ctx.workspace.name, isHire: false });
      }
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: roleChanged ? "ROLE_CHANGED" : "EMPLOYEE_UPDATED", targetType: "Employee", targetId: id, summary: `${emp.staffCode} profile updated${roleChanged ? `; job role changed, ${titles.length} course(s) assigned` : ""}`, metadata: { courses: titles } });
    });
    await dispatchEffects(ctx, fx);
    revalidatePath("/app", "layout");
    return undefined;
  });
}

const statusSchema = z.object({ status: z.enum(["ONBOARDING", "ACTIVE", "LOA", "SUSPENDED", "TERMINATED"]), reason: z.string().trim().min(3, "Give a reason for the change") });

export async function changeStatusAction(id: string, input: unknown) {
  return run(async () => {
    const d = statusSchema.parse(input);
    const ctx = await requireWorkspaceRole(MANAGEMENT_ROLES);
    if (d.status === "TERMINATED" && !ADMIN_ROLES.includes(ctx.role)) throw new Error("Only owners and admins can terminate staff.");
    const fx = newEffects();
    await prisma.$transaction(async (tx) => {
      const emp = await tx.employeeProfile.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
      if (!emp) throw new Error("Employee not found.");
      await tx.employeeProfile.update({ where: { id }, data: { status: d.status } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "STATUS_CHANGED", targetType: "Employee", targetId: id, summary: `${emp.staffCode} status ${emp.status} → ${d.status}: ${d.reason}`, metadata: { from: emp.status, to: d.status } });
      fx.confidential.push({ title: `Status change: ${emp.fullName}`, description: `${emp.staffCode} ${emp.status} → ${d.status}`, color: d.status === "ACTIVE" ? COLORS.ok : COLORS.warn, fields: [{ name: "Reason", value: d.reason }, { name: "By", value: ctx.user.name, inline: true }] });
    });
    await dispatchEffects(ctx, fx);
    revalidatePath("/app", "layout");
    return undefined;
  });
}

const accessSchema = z.object({ password: z.string().min(8, "Password must be at least 8 characters").optional().or(z.literal("")), role: z.enum(["EMPLOYEE", "SUPERVISOR", "MANAGER", "ADMIN"]).default("EMPLOYEE") });

/** Creates (or links) a login for an employee. Without a password, an invite link is emailed so they choose their own. */
export async function grantPortalAccessAction(id: string, input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(MANAGEMENT_ROLES);
    const d = accessSchema.parse(input);
    if (d.role !== "EMPLOYEE" && !ADMIN_ROLES.includes(ctx.role)) throw new Error("Only owners and admins can grant elevated roles.");
    if (d.role === "ADMIN" && ctx.role !== "OWNER") throw new Error("Only the owner can create admins.");
    const r = await prisma.$transaction(async (tx) => {
      const emp = await tx.employeeProfile.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
      if (!emp) throw new Error("Employee not found.");
      if (emp.memberId) throw new Error("This employee already has sign-in access.");
      let user = await tx.user.findUnique({ where: { email: emp.email } });
      let created = false;
      if (!user) {
        user = await tx.user.create({ data: { email: emp.email, name: emp.fullName, passwordHash: await hashPassword(d.password || randomBytes(24).toString("hex")) } });
        created = true;
      }
      const member = await tx.workspaceMember.upsert({ where: { workspaceId_userId: { workspaceId: ctx.workspaceId, userId: user.id } }, create: { workspaceId: ctx.workspaceId, userId: user.id, role: d.role }, update: {} });
      await tx.employeeProfile.update({ where: { id }, data: { memberId: member.id } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "ACCESS_GRANTED", targetType: "Employee", targetId: id, summary: `${emp.staffCode} given ${d.role} sign-in access${created && !d.password ? " (invite link)" : ""}` });
      return { emp, userId: user.id, needsInvite: created && !d.password };
    });
    let inviteUrl: string | undefined;
    let emailed = false;
    if (r.needsInvite) {
      const raw = await createToken(r.userId, "INVITE", 7 * 86400000);
      inviteUrl = `${process.env.APP_URL || "https://onboardops.org"}/reset-password?token=${raw}&invite=1`;
      const m = emails.invite(r.emp.fullName, ctx.workspace.name, inviteUrl);
      emailed = (await sendEmail(r.emp.email, m.subject, m.text, { html: m.html, kind: "invite", workspaceId: ctx.workspaceId, workspaceName: ctx.workspace.name })).ok;
    }
    revalidatePath("/app", "layout");
    return { inviteUrl, emailed };
  });
}

/** Issues a fresh set-password link for someone who already has a login in this workspace. */
export async function sendAccessLinkAction(id: string) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(MANAGEMENT_ROLES);
    const emp = await prisma.employeeProfile.findFirst({ where: { id, workspaceId: ctx.workspaceId }, include: { member: true } });
    if (!emp?.member) throw new Error("This employee has no sign-in access yet.");
    const raw = await createToken(emp.member.userId, "RESET", 7 * 86400000);
    const url = `${process.env.APP_URL || "https://onboardops.org"}/reset-password?token=${raw}&invite=1`;
    const m = emails.invite(emp.fullName, ctx.workspace.name, url);
    const emailed = (await sendEmail(emp.email, m.subject, m.text, { html: m.html, kind: "invite", workspaceId: ctx.workspaceId, workspaceName: ctx.workspace.name })).ok;
    await prisma.$transaction((tx) => writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "ACCESS_LINK_SENT", targetType: "Employee", targetId: id, summary: `Set-password link issued for ${emp.staffCode}` }));
    return { inviteUrl: url, emailed };
  });
}

const roleSchema = z.object({ role: z.enum(["ADMIN", "MANAGER", "SUPERVISOR", "EMPLOYEE"]) });

export async function changeMemberRoleAction(memberId: string, input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(["OWNER", "ADMIN"]);
    const d = roleSchema.parse(input);
    if (d.role === "ADMIN" && ctx.role !== "OWNER") throw new Error("Only the owner can promote to admin.");
    await prisma.$transaction(async (tx) => {
      const m = await tx.workspaceMember.findFirst({ where: { id: memberId, workspaceId: ctx.workspaceId }, include: { user: true } });
      if (!m) throw new Error("Member not found.");
      if (m.role === "OWNER") throw new Error("The owner's role cannot be changed.");
      await tx.workspaceMember.update({ where: { id: memberId }, data: { role: d.role } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "MEMBER_ROLE_CHANGED", targetType: "Member", targetId: memberId, summary: `${m.user.name}: ${m.role} → ${d.role}` });
    });
    revalidatePath("/app", "layout");
    return undefined;
  });
}
