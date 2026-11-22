"use server";
import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { requireWorkspaceRole, ADMIN_ROLES, MANAGEMENT_ROLES } from "@/lib/rbac";
import { safePublicUrl, sendGenericWebhook } from "@/lib/generic-webhook";
import { emails, sendEmail } from "@/lib/email";
import { loadSmsConfig, sendSms, toE164 } from "@/lib/sms";
import { open, seal } from "@/lib/secret-box";
import { enforceRate } from "@/lib/rate-limit";
import { importEmployeesAction } from "./import";
import { run } from "./_util";

const done = () => revalidatePath("/app", "layout");
const hashKey = (k: string) => createHash("sha256").update(k).digest("hex");

/* ---------- API keys (read-only access to your own workspace data) ---------- */
export async function createApiKeyAction(input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    const d = z.object({ name: z.string().trim().min(2, "Name the key").max(60) }).parse(input);
    if ((await prisma.apiKey.count({ where: { workspaceId: ctx.workspaceId, revokedAt: null } })) >= 10) throw new Error("You can have at most 10 active keys. Revoke one first.");
    const key = `oo_live_${randomBytes(24).toString("hex")}`;
    await prisma.$transaction(async (tx) => {
      const k = await tx.apiKey.create({ data: { workspaceId: ctx.workspaceId, name: d.name, prefix: key.slice(0, 15), keyHash: hashKey(key), createdByName: ctx.user.name } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "API_KEY_CREATED", targetType: "ApiKey", targetId: k.id, summary: `API key "${d.name}" created` });
    });
    done();
    return { key };
  });
}

export async function revokeApiKeyAction(id: string) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    await prisma.$transaction(async (tx) => {
      const k = await tx.apiKey.findFirst({ where: { id, workspaceId: ctx.workspaceId, revokedAt: null } });
      if (!k) throw new Error("Key not found.");
      await tx.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "API_KEY_REVOKED", targetType: "ApiKey", targetId: id, summary: `API key "${k.name}" revoked` });
    });
    done();
    return undefined;
  });
}

/* ---------- Generic signed JSON webhook ---------- */
export async function saveGenericWebhookAction(input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    const d = z.object({ url: z.string().trim().max(500).default(""), regenerateSecret: z.boolean().default(false) }).parse(input);
    if (d.url) {
      const s = await safePublicUrl(d.url);
      if (!s.ok) throw new Error(s.error);
    }
    const secret = !d.url ? "" : d.regenerateSecret || !ctx.workspace.genericWebhookSecret ? `whsec_${randomBytes(20).toString("hex")}` : ctx.workspace.genericWebhookSecret;
    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({ where: { id: ctx.workspaceId }, data: { genericWebhookUrl: d.url || null, genericWebhookSecret: secret } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "WEBHOOK_UPDATED", targetType: "Workspace", targetId: ctx.workspaceId, summary: d.url ? "JSON webhook configured" : "JSON webhook removed" });
    });
    done();
    return { secret };
  });
}

export async function testGenericWebhookAction() {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    const w = await prisma.workspace.findUnique({ where: { id: ctx.workspaceId }, select: { genericWebhookUrl: true, genericWebhookSecret: true } });
    const r = await sendGenericWebhook(w?.genericWebhookUrl, w?.genericWebhookSecret ?? "", "test", { message: "Test event from OnboardOps", workspace: ctx.workspace.name });
    if (!r.ok) throw new Error(r.error ?? "Test failed");
    return undefined;
  });
}

/* ---------- Email a report now ---------- */
export async function emailReportNowAction() {
  return run(async () => {
    const ctx = await requireWorkspaceRole(MANAGEMENT_ROLES);
    const w = ctx.workspaceId;
    const now = new Date();
    const [active, onboarding, enrolled, passed, overdue, openIncidents, openAppeals, unacked] = await Promise.all([
      prisma.employeeProfile.count({ where: { workspaceId: w, status: "ACTIVE" } }),
      prisma.employeeProfile.count({ where: { workspaceId: w, status: "ONBOARDING" } }),
      prisma.courseEnrollment.count({ where: { workspaceId: w, employee: { status: { not: "TERMINATED" } } } }),
      prisma.courseEnrollment.count({ where: { workspaceId: w, status: "PASSED", employee: { status: { not: "TERMINATED" } } } }),
      prisma.courseEnrollment.count({ where: { workspaceId: w, status: { not: "PASSED" }, dueDate: { lt: now } } }),
      prisma.incidentReport.count({ where: { workspaceId: w, status: { in: ["NEW", "REVIEWING"] } } }),
      prisma.appeal.count({ where: { workspaceId: w, status: "OPEN" } }),
      prisma.infractionCase.count({ where: { workspaceId: w, employeeAcknowledged: false } }),
    ]);
    const pct = enrolled ? Math.round((passed / enrolled) * 100) : 100;
    const lines = [`Active staff: ${active}`, `Onboarding: ${onboarding}`, `Training compliance: ${pct}% (${overdue} overdue)`, `Open incident reports: ${openIncidents}`, `Open appeals: ${openAppeals}`, `Infractions awaiting signature: ${unacked}`];
    const m = emails.report(ctx.user.name, ctx.workspace.name, lines);
    const r = await sendEmail(ctx.user.email, m.subject, m.text, { html: m.html, kind: "report", workspaceId: ctx.workspaceId });
    if (!r.ok) throw new Error("The email could not be sent. Check the email log in the staff console.");
    return undefined;
  });
}

/* ---------- Locations ---------- */
export async function saveLocationAction(input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    const d = z.object({ id: z.string().optional(), name: z.string().trim().min(2, "Name the location").max(80), address: z.string().trim().max(200).default(""), timezone: z.string().trim().max(60).default("") }).parse(input);
    await prisma.$transaction(async (tx) => {
      if (d.id) {
        const r = await tx.location.updateMany({ where: { id: d.id, workspaceId: ctx.workspaceId }, data: { name: d.name, address: d.address, timezone: d.timezone } });
        if (!r.count) throw new Error("Location not found.");
      } else {
        if ((await tx.location.count({ where: { workspaceId: ctx.workspaceId } })) >= 50) throw new Error("A workspace can have at most 50 locations.");
        await tx.location.create({ data: { workspaceId: ctx.workspaceId, name: d.name, address: d.address, timezone: d.timezone } });
      }
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "LOCATION_SAVED", targetType: "Workspace", targetId: ctx.workspaceId, summary: `Location "${d.name}" saved` });
    });
    done();
    return undefined;
  });
}

export async function deleteLocationAction(id: string) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    await prisma.$transaction(async (tx) => {
      const l = await tx.location.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
      if (!l) throw new Error("Location not found.");
      await tx.employeeProfile.updateMany({ where: { workspaceId: ctx.workspaceId, locationId: id }, data: { locationId: null } });
      await tx.location.delete({ where: { id } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "LOCATION_DELETED", targetType: "Workspace", targetId: ctx.workspaceId, summary: `Location "${l.name}" deleted` });
    });
    done();
    return undefined;
  });
}

export async function assignLocationAction(employeeId: string, locationId: string) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(MANAGEMENT_ROLES);
    await prisma.$transaction(async (tx) => {
      const emp = await tx.employeeProfile.findFirst({ where: { id: employeeId, workspaceId: ctx.workspaceId } });
      if (!emp) throw new Error("Employee not found.");
      if (locationId && !(await tx.location.findFirst({ where: { id: locationId, workspaceId: ctx.workspaceId } }))) throw new Error("Location not found.");
      await tx.employeeProfile.update({ where: { id: employeeId }, data: { locationId: locationId || null } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "LOCATION_ASSIGNED", targetType: "Employee", targetId: employeeId, summary: `${emp.staffCode} location changed` });
    });
    done();
    return undefined;
  });
}

/* ---------- Text messages: the workspace brings its own Twilio account ---------- */
export async function saveSmsConfigAction(input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    const d = z.object({
      sid: z.string().trim().regex(/^AC[a-fA-F0-9]{32}$/, "That does not look like a Twilio Account SID (starts with AC)."),
      token: z.string().trim().max(100).default(""),
      from: z.string().trim().refine((v) => /^MG[a-fA-F0-9]{32}$/.test(v) || toE164(v) !== null, "Use your Twilio number (like +14045550142) or a Messaging Service SID (starts with MG)."),
    }).parse(input);
    const existing = ctx.workspace.smsAuthTokenEnc;
    if (!d.token && !existing) throw new Error("Paste your Twilio auth token.");
    const from = d.from.startsWith("MG") ? d.from : (toE164(d.from) as string);
    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({ where: { id: ctx.workspaceId }, data: { smsAccountSid: d.sid, smsFrom: from, ...(d.token ? { smsAuthTokenEnc: seal(d.token) } : {}) } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "SMS_CONFIGURED", targetType: "Workspace", targetId: ctx.workspaceId, summary: "Text message provider connected" });
    });
    done();
    return undefined;
  });
}

export async function removeSmsConfigAction() {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({ where: { id: ctx.workspaceId }, data: { smsAccountSid: null, smsAuthTokenEnc: null, smsFrom: null } });
      await tx.employeeProfile.updateMany({ where: { workspaceId: ctx.workspaceId }, data: { smsOptIn: false } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "SMS_REMOVED", targetType: "Workspace", targetId: ctx.workspaceId, summary: "Text message provider removed" });
    });
    done();
    return undefined;
  });
}

export async function testSmsConfigAction(input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    const d = z.object({ to: z.string().trim().min(7).max(40) }).parse(input);
    const cfg = await loadSmsConfig(ctx.workspaceId);
    if (!cfg) throw new Error("Save your Twilio details first.");
    const r = await sendSms(cfg, d.to, `OnboardOps: test text for ${ctx.workspace.name}.`);
    if (!r.ok) throw new Error(r.error ?? "The test text failed.");
    return undefined;
  });
}

/* ---------- BambooHR: the workspace brings its own API key ---------- */
export async function saveBambooAction(input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    const d = z.object({
      subdomain: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,59}$/, "Use just the name from yourcompany.bamboohr.com (for example yourcompany)."),
      key: z.string().trim().max(120).default(""),
    }).parse(input);
    if (!d.key && !ctx.workspace.bambooKeyEnc) throw new Error("Paste your BambooHR API key.");
    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({ where: { id: ctx.workspaceId }, data: { bambooSubdomain: d.subdomain, ...(d.key ? { bambooKeyEnc: seal(d.key) } : {}) } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "BAMBOO_CONNECTED", targetType: "Workspace", targetId: ctx.workspaceId, summary: "BambooHR connected" });
    });
    done();
    return undefined;
  });
}

export async function removeBambooAction() {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({ where: { id: ctx.workspaceId }, data: { bambooSubdomain: null, bambooKeyEnc: null } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "BAMBOO_REMOVED", targetType: "Workspace", targetId: ctx.workspaceId, summary: "BambooHR disconnected" });
    });
    done();
    return undefined;
  });
}

type BambooPerson = { displayName?: string; firstName?: string; lastName?: string; workEmail?: string; mobilePhone?: string; workPhone?: string; department?: string; jobTitle?: string };

/** Adds people who are in BambooHR but not in OnboardOps yet. It never updates or removes anyone. */
export async function syncBambooAction() {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    await enforceRate("bamboo-sync", 6, 3600);
    const w = ctx.workspace;
    const key = w.bambooKeyEnc ? open(w.bambooKeyEnc) : null;
    if (!w.bambooSubdomain || !key) throw new Error("Connect BambooHR first.");
    let res: Response;
    try {
      res = await fetch(`https://api.bamboohr.com/api/gateway.php/${encodeURIComponent(w.bambooSubdomain)}/v1/employees/directory`, {
        headers: { Authorization: `Basic ${Buffer.from(`${key}:x`).toString("base64")}`, Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new Error("Could not reach BambooHR. Try again in a moment.");
    }
    if (res.status === 401 || res.status === 403) throw new Error("BambooHR rejected the API key. Check the key and that its user can see the employee directory.");
    if (!res.ok) throw new Error(`BambooHR answered ${res.status}.`);
    const body = (await res.json().catch(() => null)) as { employees?: BambooPerson[] } | null;
    const people = body?.employees ?? [];
    const rows = people
      .map((p) => ({ fullName: (p.displayName || `${p.firstName ?? ""} ${p.lastName ?? ""}`).trim(), email: (p.workEmail ?? "").trim(), phone: (p.mobilePhone || p.workPhone || "").trim(), department: (p.department ?? "").trim(), jobRole: (p.jobTitle ?? "").trim() }))
      .filter((r) => r.fullName.length >= 2 && r.email);
    if (!rows.length) throw new Error("BambooHR returned no employees with a work email.");
    const r = await importEmployeesAction({ rows: rows.slice(0, 500), createMissing: true, sendWelcome: false });
    if (!r.ok) throw new Error(r.error);
    return { fetched: people.length, withEmail: rows.length, created: r.data.created, skipped: r.data.skipped.length };
  });
}
