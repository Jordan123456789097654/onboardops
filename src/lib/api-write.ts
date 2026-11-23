import { z, ZodError } from "zod";
import { prisma } from "./prisma";
import { writeAudit } from "./audit";
import { AuthzError, ADMIN_ROLES, MANAGEMENT_ROLES, STAFF_ROLES, canIssueSeverity, canSeeConfidential } from "./rbac";
import { can } from "./perms";
import { assignRoleCourses, dispatchEffects, issueInfraction, newEffects, nextStaffCode } from "./automations";
import { emails } from "./email";
import { notifyEmployee } from "./notify";
import { COLORS } from "./webhooks";
import { apiError, authApiKey, type ApiAuth } from "./api-auth";
import type { Scope } from "./api-scopes";
import type { Role } from "@prisma/client";

/** Write operations for /api/v1. Same rules as the app: workspace isolation on every lookup, and the key creator's current role decides what is allowed. */

export class ApiFail extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}

const MAX_BODY = 256 * 1024;
export const MAX_BULK = 100;

const needRole = (a: ApiAuth, roles: Role[]) => { if (!roles.includes(a.ctx.role)) throw new ApiFail(403, "forbidden", "The role of the person who created this key does not allow that."); };

/** Wraps a write endpoint: auth, scope, body size, JSON, then maps every failure to { error, code, requestId }. */
export async function apiWrite(req: Request, scope: Scope, fn: (a: ApiAuth, body: unknown) => Promise<unknown>, success = 200): Promise<Response> {
  const auth = await authApiKey(req, { scope });
  if (auth instanceof Response) return auth;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) throw new ApiFail(413, "body_too_large", "Request body is larger than 256 KB.");
    let body: unknown = {};
    if (text.trim()) { try { body = JSON.parse(text); } catch { throw new ApiFail(400, "invalid_json", "The request body is not valid JSON."); } }
    const out = await fn(auth, body);
    return Response.json({ data: out, requestId: auth.requestId }, { status: success, headers: { "x-request-id": auth.requestId } });
  } catch (e) {
    return failure(e, auth.requestId);
  }
}

export function failure(e: unknown, requestId: string): Response {
  if (e instanceof ApiFail) return apiError(e.status, e.code, e.message, requestId, e.details);
  if (e instanceof ZodError) return apiError(422, "validation_failed", "The request did not pass validation.", requestId, e.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  if (e instanceof AuthzError) return apiError(403, "forbidden", e.message, requestId);
  if (e instanceof Error && !/prisma|invalid .* invocation/i.test(e.message)) return apiError(400, "request_failed", e.message, requestId);
  return apiError(500, "internal_error", "Something went wrong on our side.", requestId);
}

/** Single object or an array of up to 100. Arrays return one result per item and never stop at the first failure. */
export async function maybeBulk(body: unknown, one: (item: unknown) => Promise<unknown>) {
  if (!Array.isArray(body)) return one(body);
  if (body.length === 0) throw new ApiFail(422, "validation_failed", "Send at least one item.");
  if (body.length > MAX_BULK) throw new ApiFail(422, "too_many_items", `Send at most ${MAX_BULK} items per request.`);
  const results: unknown[] = [];
  for (let i = 0; i < body.length; i++) {
    try { results.push({ index: i, ok: true, ...(await one(body[i]) as object) }); }
    catch (e) {
      const f = e instanceof ApiFail ? { code: e.code, message: e.message } : e instanceof ZodError ? { code: "validation_failed", message: e.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ") } : { code: "request_failed", message: e instanceof Error ? e.message : "Failed" };
      results.push({ index: i, ok: false, error: f });
    }
  }
  return results;
}

/* ---------------- Employees ---------------- */

const optStr = (max: number) => z.string().trim().max(max).optional();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Use YYYY-MM-DD");
export const employeeCreate = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: optStr(40), emergencyContact: optStr(200),
  departmentId: z.string().max(60).nullish(), jobRoleId: z.string().max(60).nullish(),
  hireDate: isoDate.optional(),
}).strict();
export const employeeUpdate = employeeCreate.partial().extend({
  status: z.enum(["ONBOARDING", "ACTIVE", "LOA", "SUSPENDED", "TERMINATED"]).optional(),
  statusReason: z.string().trim().min(3).max(300).optional(),
}).strict();

export const employeeOut = (e: { id: string; staffCode: string; fullName: string; email: string; phone: string | null; status: string; readiness: string; hireDate: Date; department?: { name: string } | null; jobRole?: { title: string } | null }) =>
  ({ id: e.id, staffCode: e.staffCode, fullName: e.fullName, email: e.email, phone: e.phone, status: e.status, readiness: e.readiness, department: e.department?.name ?? null, jobRole: e.jobRole?.title ?? null, hireDate: e.hireDate.toISOString().slice(0, 10) });

export async function createEmployee(a: ApiAuth, input: unknown) {
  needRole(a, MANAGEMENT_ROLES);
  const d = employeeCreate.parse(input);
  const ctx = a.ctx;
  const email = d.email.toLowerCase();
  if (await prisma.employeeProfile.findFirst({ where: { workspaceId: a.workspaceId, email: { equals: email, mode: "insensitive" } }, select: { id: true } })) throw new ApiFail(409, "duplicate_email", "An employee with that email already exists.");
  const fx = newEffects();
  const emp = await prisma.$transaction(async (tx) => {
    if (d.departmentId && !(await tx.department.findFirst({ where: { id: d.departmentId, workspaceId: a.workspaceId } }))) throw new ApiFail(422, "unknown_department", "That departmentId does not exist in this workspace.");
    if (d.jobRoleId && !(await tx.jobRole.findFirst({ where: { id: d.jobRoleId, workspaceId: a.workspaceId } }))) throw new ApiFail(422, "unknown_job_role", "That jobRoleId does not exist in this workspace.");
    const staffCode = await nextStaffCode(tx, a.workspaceId);
    const e = await tx.employeeProfile.create({ data: { workspaceId: a.workspaceId, staffCode, fullName: d.fullName, email, phone: d.phone || null, emergencyContact: d.emergencyContact || null, departmentId: d.departmentId || null, jobRoleId: d.jobRoleId || null, hireDate: d.hireDate ? new Date(d.hireDate) : new Date() } });
    const titles = await assignRoleCourses(tx, { workspaceId: a.workspaceId, employeeId: e.id, jobRoleId: e.jobRoleId, reason: "Required for job role (new hire)", fx, employeeName: e.fullName, employeeEmail: e.email, workspaceName: ctx.workspace.name, isHire: true });
    await writeAudit(tx, { workspaceId: a.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "EMPLOYEE_CREATED", targetType: "Employee", targetId: e.id, summary: `${staffCode} ${e.fullName} added through the API${titles.length ? `; ${titles.length} course(s) assigned` : ""}`, metadata: { via: "api", keyId: a.keyId, requestId: a.requestId, courses: titles } });
    return e;
  });
  fx.ops.push({ title: `New hire: ${emp.fullName}`, description: `${emp.staffCode} added through the API`, color: COLORS.info });
  await dispatchEffects(ctx, fx);
  return { id: emp.id, staffCode: emp.staffCode };
}

export async function updateEmployee(a: ApiAuth, id: string, input: unknown) {
  needRole(a, MANAGEMENT_ROLES);
  const d = employeeUpdate.parse(input);
  const ctx = a.ctx;
  const fx = newEffects();
  await prisma.$transaction(async (tx) => {
    const before = await tx.employeeProfile.findFirst({ where: { id, workspaceId: a.workspaceId } });
    if (!before) throw new ApiFail(404, "not_found", "Employee not found.");
    if (d.status && d.status !== before.status && (d.statusReason ?? "").length < 3) throw new ApiFail(422, "reason_required", "Send statusReason (3+ characters) when changing status.");
    if (d.status === "TERMINATED" && d.status !== before.status && !ADMIN_ROLES.includes(ctx.role)) throw new ApiFail(403, "forbidden", "Only an owner or admin can terminate staff.");
    if (d.email && d.email.toLowerCase() !== before.email && (await tx.employeeProfile.findFirst({ where: { workspaceId: a.workspaceId, email: { equals: d.email.toLowerCase(), mode: "insensitive" }, NOT: { id } } }))) throw new ApiFail(409, "duplicate_email", "An employee with that email already exists.");
    if (d.departmentId && !(await tx.department.findFirst({ where: { id: d.departmentId, workspaceId: a.workspaceId } }))) throw new ApiFail(422, "unknown_department", "That departmentId does not exist in this workspace.");
    if (d.jobRoleId && !(await tx.jobRole.findFirst({ where: { id: d.jobRoleId, workspaceId: a.workspaceId } }))) throw new ApiFail(422, "unknown_job_role", "That jobRoleId does not exist in this workspace.");
    const data: Record<string, unknown> = {};
    if (d.fullName !== undefined) data.fullName = d.fullName;
    if (d.email !== undefined) data.email = d.email.toLowerCase();
    if (d.phone !== undefined) data.phone = d.phone || null;
    if (d.emergencyContact !== undefined) data.emergencyContact = d.emergencyContact || null;
    if (d.departmentId !== undefined) data.departmentId = d.departmentId || null;
    if (d.jobRoleId !== undefined) data.jobRoleId = d.jobRoleId || null;
    if (d.hireDate !== undefined) data.hireDate = new Date(d.hireDate);
    if (d.status !== undefined) data.status = d.status;
    const emp = await tx.employeeProfile.update({ where: { id }, data });
    const roleChanged = d.jobRoleId !== undefined && (d.jobRoleId || null) !== before.jobRoleId;
    const statusChanged = d.status !== undefined && d.status !== before.status;
    let titles: string[] = [];
    if (roleChanged) titles = await assignRoleCourses(tx, { workspaceId: a.workspaceId, employeeId: id, jobRoleId: emp.jobRoleId, reason: "Required for new job role", fx, employeeName: emp.fullName, employeeEmail: emp.email, workspaceName: ctx.workspace.name, isHire: false });
    await writeAudit(tx, { workspaceId: a.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: statusChanged ? "STATUS_CHANGED" : roleChanged ? "ROLE_CHANGED" : "EMPLOYEE_UPDATED", targetType: "Employee", targetId: id, summary: statusChanged ? `${emp.staffCode} status ${before.status} → ${d.status}: ${d.statusReason} (API)` : `${emp.staffCode} profile updated through the API${roleChanged ? `; job role changed, ${titles.length} course(s) assigned` : ""}`, metadata: { via: "api", keyId: a.keyId, requestId: a.requestId, fields: Object.keys(data) } });
  });
  await dispatchEffects(ctx, fx);
  return { id };
}

/* ---------------- Course assignment ---------------- */

export const assignSchema = z.object({ courseId: z.string().min(1).max(60), employeeIds: z.array(z.string().min(1).max(60)).min(1).max(MAX_BULK), reason: z.string().trim().min(3).max(200), dueDate: isoDate.optional() }).strict();

export async function assignCourse(a: ApiAuth, input: unknown) {
  if (!can(a.ctx, "training.assign")) throw new ApiFail(403, "forbidden", "The role of the person who created this key cannot assign training.");
  const d = assignSchema.parse(input);
  const ctx = a.ctx;
  const fx = newEffects();
  const out = await prisma.$transaction(async (tx) => {
    const course = await tx.course.findFirst({ where: { id: d.courseId, workspaceId: a.workspaceId } });
    if (!course) throw new ApiFail(404, "course_not_found", "Course not found.");
    const emps = await tx.employeeProfile.findMany({ where: { id: { in: d.employeeIds }, workspaceId: a.workspaceId } });
    const found = new Set(emps.map((e) => e.id));
    const assigned: string[] = []; const skipped: string[] = [];
    for (const e of emps) {
      if (await tx.courseEnrollment.findUnique({ where: { employeeId_courseId: { employeeId: e.id, courseId: course.id } } })) { skipped.push(e.id); continue; }
      await tx.courseEnrollment.create({ data: { workspaceId: a.workspaceId, employeeId: e.id, courseId: course.id, assignedReason: d.reason, dueDate: d.dueDate ? new Date(d.dueDate) : new Date(Date.now() + course.defaultDueDays * 86400000) } });
      await tx.employeeProfile.update({ where: { id: e.id }, data: { readiness: e.readiness === "RETRAINING_REQUIRED" ? e.readiness : "PENDING" } });
      await writeAudit(tx, { workspaceId: a.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "COURSE_ASSIGNED", targetType: "Employee", targetId: e.id, summary: `${e.staffCode} assigned "${course.title}": ${d.reason}`, metadata: { via: "api", keyId: a.keyId, requestId: a.requestId } });
      fx.mail.push({ to: e.email, ...emails.courseAssigned(e.fullName, course.title, d.reason) });
      await notifyEmployee(tx, a.workspaceId, e.id, { title: `New training: ${course.title}`, body: d.reason, href: `/app/training/course/${course.id}` });
      assigned.push(e.id);
    }
    return { assigned, skipped, notFound: d.employeeIds.filter((i) => !found.has(i)) };
  });
  await dispatchEffects(ctx, fx);
  return out;
}

/* ---------------- Infractions ---------------- */

export const infractionSchema = z.object({
  employeeId: z.string().min(1).max(60),
  severity: z.enum(["VERBAL_WARNING", "WRITTEN_INFRACTION", "STRIKE_POINTS"]),
  pointsAdded: z.number().int().min(0).max(20).default(0),
  policyViolated: z.string().trim().min(3).max(200),
  summary: z.string().trim().min(10).max(4000),
  evidenceUrls: z.array(z.string().url()).max(10).default([]),
  confidentialManagerNotes: z.string().max(4000).default(""),
}).strict();

export async function logInfraction(a: ApiAuth, input: unknown) {
  needRole(a, STAFF_ROLES);
  const raw = input as { severity?: string } | null;
  if (raw && (raw.severity === "SUSPENSION" || raw.severity === "TERMINATION")) throw new ApiFail(403, "severity_not_allowed", "Suspensions and terminations cannot be logged through the API. A person must do those in the app.");
  const d = infractionSchema.parse(input);
  const ctx = a.ctx;
  if (!canIssueSeverity(ctx.role, d.severity)) throw new ApiFail(403, "forbidden", "The role of the person who created this key cannot issue this severity.");
  if (d.pointsAdded > 0 && ctx.role === "SUPERVISOR" && d.severity !== "WRITTEN_INFRACTION") throw new ApiFail(403, "forbidden", "Supervisors cannot add strike points.");
  if (d.severity === "STRIKE_POINTS" && d.pointsAdded < 1) throw new ApiFail(422, "validation_failed", "Strike point cases need at least 1 point.");
  if (d.confidentialManagerNotes && !canSeeConfidential(ctx.role)) d.confidentialManagerNotes = "";
  const out = await issueInfraction(ctx, d);
  await dispatchEffects(ctx, out.fx);
  return { id: out.id, caseNumber: out.caseNumber, effects: out.effects };
}

/* ---------------- Shifts ---------------- */

export const shiftSchema = z.object({
  employeeId: z.string().max(60).nullish(), departmentId: z.string().max(60).nullish(),
  startsAt: z.string().min(10), endsAt: z.string().min(10),
  label: z.string().trim().max(120).default(""), notes: z.string().trim().max(1000).default(""),
}).strict();

export async function createShift(a: ApiAuth, input: unknown) {
  needRole(a, MANAGEMENT_ROLES);
  const d = shiftSchema.parse(input);
  const start = new Date(d.startsAt), end = new Date(d.endsAt);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new ApiFail(422, "validation_failed", "startsAt and endsAt must be valid ISO 8601 times.");
  if (end <= start) throw new ApiFail(422, "validation_failed", "endsAt must be after startsAt.");
  const ctx = a.ctx;
  return prisma.$transaction(async (tx) => {
    if (d.employeeId && !(await tx.employeeProfile.findFirst({ where: { id: d.employeeId, workspaceId: a.workspaceId } }))) throw new ApiFail(422, "unknown_employee", "That employeeId does not exist in this workspace.");
    if (d.departmentId && !(await tx.department.findFirst({ where: { id: d.departmentId, workspaceId: a.workspaceId } }))) throw new ApiFail(422, "unknown_department", "That departmentId does not exist in this workspace.");
    const s = await tx.shift.create({ data: { workspaceId: a.workspaceId, employeeId: d.employeeId || null, departmentId: d.departmentId || null, startsAt: start, endsAt: end, label: d.label, notes: d.notes } });
    await writeAudit(tx, { workspaceId: a.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "SHIFT_CREATED", targetType: "Shift", targetId: s.id, summary: `Shift scheduled through the API (${d.label || start.toISOString().slice(0, 10)})`, metadata: { via: "api", keyId: a.keyId, requestId: a.requestId } });
    return { id: s.id };
  });
}
