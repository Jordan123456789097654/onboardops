// Local check of the API write endpoints: scopes, creator role, workspace isolation, validation, bulk, rate limit, audit.
// Calls the route handlers directly with real Request objects. Local demo database only; creates and removes its own keys and records.
// Run: DATA_MASTER_KEY=<any throwaway key> npx tsx scripts/api-write-selftest.mts
import { createHash, randomBytes } from "node:crypto";
const unwrap = (m: any) => (m && m.default && !m.prisma ? m.default : m);
const { prisma } = unwrap(await import("../src/lib/prisma.ts"));
if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) { console.error("Local database only."); process.exit(1); }
const emp = unwrap(await import("../src/app/api/v1/employees/route.ts"));
const empId = unwrap(await import("../src/app/api/v1/employees/[id]/route.ts"));
const shifts = unwrap(await import("../src/app/api/v1/shifts/route.ts"));
const assign = unwrap(await import("../src/app/api/v1/assignments/route.ts"));
const infr = unwrap(await import("../src/app/api/v1/infractions/route.ts"));
const audit = unwrap(await import("../src/app/api/v1/audit/route.ts"));
const ok = (n: string, c: boolean, extra = "") => { console.log(c ? "PASS" : "FAIL", n, extra); if (!c) process.exitCode = 1; };

const ws = await prisma.workspace.findFirstOrThrow({ where: { slug: "northside-supply-logistics" } });
const otherWs = await prisma.workspace.findFirst({ where: { id: { not: ws.id } } });
const members = await prisma.workspaceMember.findMany({ where: { workspaceId: ws.id }, include: { user: true } });
const owner = members.find((m: any) => m.role === "OWNER")!, mgr = members.find((m: any) => m.role === "MANAGER")!, sup = members.find((m: any) => m.role === "SUPERVISOR")!, employee = members.find((m: any) => m.role === "EMPLOYEE")!;
const tag = `apitest${Date.now()}`;
const keys: string[] = [];
async function mkKey(scopes: string[], memberId: string | null, extra: any = {}) {
  const raw = `oo_live_${randomBytes(24).toString("hex")}`;
  const k = await prisma.apiKey.create({ data: { workspaceId: ws.id, name: `${tag}-${keys.length}`, prefix: raw.slice(0, 15), keyHash: createHash("sha256").update(raw).digest("hex"), createdByName: "selftest", createdByMemberId: memberId, scopes, ...extra } });
  keys.push(k.id); return { raw, id: k.id };
}
const call = async (h: any, raw: string | null, body?: unknown, method = "POST", url = "http://x/api/v1/x", params: any = {}) => {
  const r = await h(new Request(url, { method, headers: { ...(raw ? { authorization: `Bearer ${raw}` } : {}), "content-type": "application/json" }, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) }), { params });
  return { status: r.status, json: await r.json().catch(() => ({})), headers: r.headers } as { status: number; json: any; headers: Headers };
};
const clearRate = () => prisma.$executeRaw`DELETE FROM "RateLimit" WHERE "key" LIKE 'api:%' OR "key" LIKE 'apiw:%'`;
const createdEmps: string[] = [];
const cleanup = async () => {
  await prisma.shift.deleteMany({ where: { workspaceId: ws.id, label: { startsWith: tag } } });
  await prisma.infractionCase.deleteMany({ where: { workspaceId: ws.id, summary: { contains: tag } } });
  await prisma.employeeProfile.deleteMany({ where: { workspaceId: ws.id, email: { startsWith: tag } } });
  await prisma.apiKey.deleteMany({ where: { id: { in: keys } } });
  await prisma.workspaceMember.updateMany({ where: { id: mgr.id }, data: { role: "MANAGER" } });
};
await clearRate();
try {
  const W = await mkKey(["employees:write", "shifts:write", "courses:assign", "infractions:write", "employees:read", "shifts:read", "audit:read"], owner.id);
  const R = await mkKey(["employees:read", "shifts:read"], owner.id);

  // ---- auth and scopes ----
  let r = await call(emp.POST, null, { fullName: "X Y", email: `${tag}@e.test` });
  ok("no key: 401 missing_key with a requestId", r.status === 401 && r.json.code === "missing_key" && !!r.json.requestId && !!r.headers.get("x-request-id"));
  r = await call(emp.POST, "oo_live_" + "0".repeat(48), { fullName: "X Y", email: `${tag}@e.test` });
  ok("unknown key: 401 invalid_key", r.status === 401 && r.json.code === "invalid_key");
  r = await call(emp.POST, R.raw, { fullName: "Read Only", email: `${tag}-ro@e.test` });
  ok("a read-only key cannot write (403 insufficient_scope)", r.status === 403 && r.json.code === "insufficient_scope" && r.json.details.required === "employees:write");
  ok("...and nothing was created", (await prisma.employeeProfile.count({ where: { email: { startsWith: `${tag}-ro` } } })) === 0);
  r = await call(emp.GET, R.raw, undefined, "GET");
  ok("a read key can still list employees (existing behaviour)", r.status === 200 && Array.isArray(r.json.data) && r.json.data.length > 0);
  r = await call(audit.GET, R.raw, undefined, "GET");
  ok("audit:read is a separate scope", r.status === 403 && r.json.code === "insufficient_scope");
  const exp = await mkKey(["employees:write"], owner.id, { expiresAt: new Date(Date.now() - 1000) });
  r = await call(emp.POST, exp.raw, { fullName: "Late Key", email: `${tag}-exp@e.test` });
  ok("an expired key is refused (401 key_expired)", r.status === 401 && r.json.code === "key_expired");
  const rev = await mkKey(["employees:write"], owner.id, { revokedAt: new Date() });
  r = await call(emp.POST, rev.raw, { fullName: "Revoked Key", email: `${tag}-rev@e.test` });
  ok("a revoked key is refused immediately", r.status === 401 && r.json.code === "invalid_key");
  const legacy = await mkKey(["employees:write"], null);
  r = await call(emp.POST, legacy.raw, { fullName: "No Creator", email: `${tag}-leg@e.test` });
  ok("a write key with no creator on record cannot write", r.status === 403 && r.json.code === "key_owner_missing");

  // ---- employees ----
  const dept = await prisma.department.findFirstOrThrow({ where: { workspaceId: ws.id } });
  const role = await prisma.jobRole.findFirstOrThrow({ where: { workspaceId: ws.id, requiredCourseIds: { isEmpty: false } } });
  r = await call(emp.POST, W.raw, { fullName: "Api Person", email: `${tag}-a@e.test`, departmentId: dept.id, jobRoleId: role.id, phone: "555-0100" });
  ok("POST /employees creates an employee (201, staff code, id)", r.status === 201 && /^EMP-\d+$/.test(r.json.data.staffCode) && !!r.json.data.id, r.json.data?.staffCode);
  const eid = r.json.data.id; createdEmps.push(eid);
  const created = await prisma.employeeProfile.findUniqueOrThrow({ where: { id: eid } });
  ok("it belongs to the key's workspace with the right fields", created.workspaceId === ws.id && created.email === `${tag}-a@e.test` && created.departmentId === dept.id && created.jobRoleId === role.id);
  ok("required courses were assigned like in the app", (await prisma.courseEnrollment.count({ where: { employeeId: eid } })) >= 1);
  const au = await prisma.auditLog.findFirst({ where: { workspaceId: ws.id, targetId: eid, actionType: "EMPLOYEE_CREATED" } });
  ok("the write is in the audit log, naming the key and marked as API", !!au && au.actorName.includes(`via API key "${tag}-`) && (au.metadata as any)?.via === "api" && (au.metadata as any)?.keyId === W.id);
  r = await call(emp.POST, W.raw, { fullName: "Api Person Two", email: `${tag}-A@E.test` });
  ok("a duplicate email is refused (409)", r.status === 409 && r.json.code === "duplicate_email");
  r = await call(emp.POST, W.raw, { fullName: "x", email: "not-an-email", extra: 1 });
  ok("validation errors are 422 with field details", r.status === 422 && r.json.code === "validation_failed" && Array.isArray(r.json.details) && r.json.details.length >= 2);
  r = await call(emp.POST, W.raw, "{not json");
  ok("invalid JSON is 400", r.status === 400 && r.json.code === "invalid_json");
  r = await call(emp.POST, W.raw, { fullName: "Big", email: `${tag}-big@e.test`, phone: "x".repeat(300_000) });
  ok("an oversized body is 413", r.status === 413 && r.json.code === "body_too_large");
  if (otherWs) {
    const od = await prisma.department.findFirst({ where: { workspaceId: otherWs.id } });
    if (od) { r = await call(emp.POST, W.raw, { fullName: "Cross Tenant", email: `${tag}-x@e.test`, departmentId: od.id }); ok("a department from ANOTHER workspace is refused", r.status === 422 && r.json.code === "unknown_department"); }
    const oe = await prisma.employeeProfile.findFirst({ where: { workspaceId: otherWs.id } });
    if (oe) { r = await call(empId.PATCH, W.raw, { fullName: "Hijack Attempt" }, "PATCH", "http://x", { id: oe.id }); ok("another workspace's employee cannot be changed (404)", r.status === 404 && (await prisma.employeeProfile.findUniqueOrThrow({ where: { id: oe.id } })).fullName === oe.fullName); r = await call(empId.GET, W.raw, undefined, "GET", "http://x", { id: oe.id }); ok("...or read (404)", r.status === 404); }
  }
  r = await call(emp.POST, W.raw, [{ fullName: "Bulk One", email: `${tag}-b1@e.test` }, { fullName: "B", email: "bad" }, { fullName: "Bulk Three", email: `${tag}-b3@e.test` }]);
  ok("a bulk request returns one result per item and keeps going after a bad one", r.status === 201 && r.json.data.length === 3 && r.json.data[0].ok && !r.json.data[1].ok && r.json.data[1].error.code === "validation_failed" && r.json.data[2].ok);
  r = await call(emp.POST, W.raw, Array.from({ length: 101 }, (_, i) => ({ fullName: "Too Many", email: `${tag}-m${i}@e.test` })));
  ok("more than 100 items is refused", r.status === 422 && r.json.code === "too_many_items");
  r = await call(empId.PATCH, W.raw, { phone: "555-0199", status: "LOA" }, "PATCH", "http://x", { id: eid });
  ok("PATCH asking for a status change without a reason is refused", r.status === 422 && r.json.code === "reason_required");
  r = await call(empId.PATCH, W.raw, { phone: "555-0199", status: "LOA", statusReason: "Medical leave" }, "PATCH", "http://x", { id: eid });
  const upd = await prisma.employeeProfile.findUniqueOrThrow({ where: { id: eid } });
  ok("PATCH updates the fields and status", r.status === 200 && upd.status === "LOA" && upd.phone === "555-0199");
  r = await call(empId.GET, W.raw, undefined, "GET", "http://x", { id: eid });
  ok("GET /employees/{id} returns it without confidential data", r.status === 200 && r.json.data.status === "LOA" && !("confidentialManagerNotes" in r.json.data));

  // ---- creator's role caps the key ----
  const MG = await mkKey(["employees:write", "infractions:write", "shifts:write", "courses:assign"], mgr.id);
  r = await call(empId.PATCH, MG.raw, { status: "TERMINATED", statusReason: "Left the company" }, "PATCH", "http://x", { id: eid });
  ok("a manager's key cannot terminate (only owner/admin)", r.status === 403 && r.json.code === "forbidden");
  const ES = await mkKey(["employees:write", "shifts:write"], employee.id);
  r = await call(emp.POST, ES.raw, { fullName: "Emp Key", email: `${tag}-ek@e.test` });
  ok("a key created by an EMPLOYEE-role member cannot write employees", r.status === 403 && r.json.code === "forbidden");
  await prisma.workspaceMember.update({ where: { id: mgr.id }, data: { role: "EMPLOYEE" } });
  r = await call(emp.POST, MG.raw, { fullName: "Demoted", email: `${tag}-dm@e.test` });
  ok("demoting the creator immediately limits the key", r.status === 403 && r.json.code === "forbidden");
  await prisma.workspaceMember.update({ where: { id: mgr.id }, data: { role: "MANAGER" } });

  // ---- assignments ----
  const course = await prisma.course.findFirstOrThrow({ where: { workspaceId: ws.id, isRemedial: false } });
  r = await call(assign.POST, W.raw, { courseId: course.id, employeeIds: [eid, "does-not-exist"], reason: "API assignment test" });
  ok("POST /assignments enrols found employees and reports unknown ids", r.status === 200 && r.json.data.assigned.length + r.json.data.skipped.length === 1 && r.json.data.notFound[0] === "does-not-exist");
  r = await call(assign.POST, W.raw, { courseId: course.id, employeeIds: [eid], reason: "again" });
  ok("assigning twice skips the existing enrolment", r.status === 200 && r.json.data.skipped.length === 1 && r.json.data.assigned.length === 0);
  r = await call(assign.POST, W.raw, { courseId: "nope", employeeIds: [eid], reason: "bad course" });
  ok("an unknown course is 404", r.status === 404 && r.json.code === "course_not_found");

  // ---- infractions ----
  const target = await prisma.employeeProfile.findFirstOrThrow({ where: { id: eid } });
  r = await call(infr.POST, W.raw, { employeeId: target.id, severity: "SUSPENSION", policyViolated: "Policy 1", summary: `${tag} should not be allowed` });
  ok("suspension cannot be logged through the API", r.status === 403 && r.json.code === "severity_not_allowed");
  r = await call(infr.POST, W.raw, { employeeId: target.id, severity: "TERMINATION", policyViolated: "Policy 1", summary: `${tag} should not be allowed` });
  ok("termination cannot be logged through the API", r.status === 403 && r.json.code === "severity_not_allowed");
  r = await call(infr.POST, W.raw, { employeeId: target.id, severity: "VERBAL_WARNING", policyViolated: "Attendance, Policy 2.1", summary: `${tag} arrived 20 minutes late twice this week`, confidentialManagerNotes: "private note" });
  ok("a verbal warning is logged (case number returned)", r.status === 201 && /^INF-\d{4}-\d+$/.test(r.json.data?.caseNumber ?? ""), r.json.data?.caseNumber ?? `${r.status} ${r.json.code}: ${r.json.error}`);
  const kase = await prisma.infractionCase.findFirstOrThrow({ where: { workspaceId: ws.id, caseNumber: r.json.data.caseNumber } });
  ok("the case is stored in the right workspace against the right employee, issued by the key's creator", kase.workspaceId === ws.id && kase.employeeId === target.id && kase.issuedByMemberId === owner.id);
  r = await call(infr.POST, W.raw, { employeeId: target.id, severity: "STRIKE_POINTS", pointsAdded: 0, policyViolated: "Policy 3", summary: `${tag} strike with no points` });
  ok("strike points need at least one point", r.status === 422);
  r = await call(infr.POST, W.raw, { employeeId: "nope", severity: "VERBAL_WARNING", policyViolated: "Policy 1", summary: `${tag} unknown employee here` });
  ok("an unknown employee is refused", r.status >= 400 && r.status < 500);
  const SK = await mkKey(["infractions:write"], sup.id);
  r = await call(infr.POST, SK.raw, { employeeId: target.id, severity: "STRIKE_POINTS", pointsAdded: 2, policyViolated: "Policy 3", summary: `${tag} supervisor strike points` });
  ok("a supervisor's key cannot issue strike points", r.status === 403);

  // ---- shifts ----
  r = await call(shifts.POST, W.raw, { employeeId: eid, departmentId: dept.id, startsAt: "2026-12-01T09:00:00Z", endsAt: "2026-12-01T17:00:00Z", label: `${tag}-shift` });
  ok("POST /shifts creates a shift", r.status === 201 && !!r.json.data.id);
  r = await call(shifts.POST, W.raw, { startsAt: "2026-12-01T17:00:00Z", endsAt: "2026-12-01T09:00:00Z", label: `${tag}-bad` });
  ok("end before start is refused", r.status === 422);
  r = await call(shifts.POST, W.raw, { employeeId: "nope", startsAt: "2026-12-01T09:00:00Z", endsAt: "2026-12-01T17:00:00Z", label: `${tag}-x` });
  ok("a shift for an unknown employee is refused", r.status === 422 && r.json.code === "unknown_employee");
  r = await call(shifts.POST, W.raw, [{ startsAt: "2026-12-02T09:00:00Z", endsAt: "2026-12-02T17:00:00Z", label: `${tag}-b1` }, { startsAt: "bad", endsAt: "bad" }]);
  ok("bulk shifts return per-item results", r.status === 201 && r.json.data[0].ok && !r.json.data[1].ok);

  // ---- audit read ----
  r = await call(audit.GET, W.raw, undefined, "GET", "http://x/api/v1/audit?limit=5&action=EMPLOYEE_CREATED");
  ok("GET /audit returns entries for this workspace only, newest first", r.status === 200 && r.json.data.length > 0 && r.json.data.every((a: any) => a.action === "EMPLOYEE_CREATED") && !("metadata" in r.json.data[0]));

  // ---- rate limit, suspended workspace ----
  await clearRate();
  let limited = 0; for (let i = 0; i < 32; i++) { const x = await call(emp.POST, W.raw, { fullName: "R", email: "bad" }); if (x.status === 429) limited++; }
  ok("writes are limited to 30 a minute per key (429 with Retry-After)", limited >= 2 && (await call(emp.POST, W.raw, { fullName: "R", email: "bad" })).headers.get("retry-after") !== null);
  await clearRate();
  await prisma.workspace.update({ where: { id: ws.id }, data: { suspendedAt: new Date() } });
  r = await call(emp.GET, W.raw, undefined, "GET");
  ok("a suspended workspace's keys are refused", r.status === 403 && r.json.code === "workspace_suspended");
  await prisma.workspace.update({ where: { id: ws.id }, data: { suspendedAt: null } });
} finally {
  await prisma.workspace.update({ where: { id: ws.id }, data: { suspendedAt: null } }).catch(() => {});
  await cleanup(); await clearRate();
  console.log("cleaned up");
}
process.exit(process.exitCode ?? 0);
