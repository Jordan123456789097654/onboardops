"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { OWNER_ONLY, requireStaff, staffAudit } from "@/lib/platform";
import { kenerConfigured, kenerCreateIncident, kenerDeleteReport, kenerEndMaintenance, kenerOverview, kenerScheduleMaintenance, kenerUpdateIncident } from "@/lib/kener";
import { MAX_OUTAGE_MINUTES, OUTAGE_SERVICES, startOutageTest, stopOutageTest } from "@/lib/maintenance";
import { notifyOpsAlert, saveIncidentOverride, saveOpsAlertWebhook } from "@/lib/incidents";
import { aiConfigured, chat } from "@/lib/ai/groq";
import { COLORS } from "@/lib/webhooks";
import { run } from "./_util";

/** The status page manager. Site owner only, because what is posted here is public. Every change is written to the staff audit log. */
async function owner() {
  const staff = await requireStaff(OWNER_ONLY);
  if (!kenerConfigured()) throw new Error("KENER_API_KEY is not set in the hosting settings, so the status page cannot be reached yet.");
  return staff;
}
const audit = (staff: { id?: string; email: string; name: string; role: string }, action: string, id: string, summary: string) =>
  prisma.$transaction((tx) => staffAudit(tx, staff as Awaited<ReturnType<typeof owner>>, { action, targetType: "StatusPage", targetId: id, summary }));

const title = z.string().trim().min(3, "Give it a title").max(160);
const message = z.string().trim().min(3, "Write a message").max(4000, "Keep the message under 4,000 characters");
const ids = z.array(z.string().trim().min(1).max(100)).min(1, "Pick at least one service").max(40);
const reportIdSchema = z.string().regex(/^(m-)?\d+$/);

/** The outage test only changes what the health checks report, so it does not need Kener to be connected. */
export async function startOutageTestAction(input: unknown) {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    const d = z.object({ services: z.array(z.enum(OUTAGE_SERVICES)).min(1, "Pick at least one service").max(7), minutes: z.number().int().min(1).max(MAX_OUTAGE_MINUTES) }).parse(input);
    const until = await startOutageTest(d.services, d.minutes, staff.email ?? "staff");
    await audit(staff, "OUTAGE_TEST_STARTED", "outage-test", `Started an outage test for ${d.services.join(", ")} for ${d.minutes} minutes`);
    revalidatePath("/admin/status");
    revalidatePath("/", "layout");
    return { until };
  });
}

export async function stopOutageTestAction() {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    await stopOutageTest();
    await audit(staff, "OUTAGE_TEST_STOPPED", "outage-test", "Stopped the outage test");
    revalidatePath("/admin/status");
    revalidatePath("/", "layout");
    return undefined;
  });
}

export async function setIncidentOverrideAction(input: unknown) {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    const d = z.object({ mode: z.enum(["auto", "banner", "muted"]) }).parse(input);
    const saved = await saveIncidentOverride(d.mode, staff.email ?? staff.name);
    await audit(staff, "OUTAGE_OVERRIDE_UPDATED", "outage-override", `Set in-app outage screen mode to "${d.mode}"`);
    revalidatePath("/admin/status");
    revalidatePath("/", "layout");
    return saved;
  });
}

export async function saveOpsAlertWebhookAction(input: unknown) {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    const d = z.object({ url: z.string().max(500).nullable() }).parse(input);
    const saved = await saveOpsAlertWebhook(d.url, staff.email ?? staff.name);
    await audit(staff, "OPS_WEBHOOK_UPDATED", "ops-webhook", d.url?.trim() ? "Configured staff incident alert webhook" : "Removed staff incident alert webhook");
    revalidatePath("/admin/status");
    return saved;
  });
}

export async function testOpsAlertWebhookAction() {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    const r = await notifyOpsAlert({
      title: "Test incident alert from OnboardOps Staff Console",
      description: `Sent by ${staff.name} (${staff.email}) to verify Discord/Slack/Teams delivery for status page outages and incident updates.`,
      color: COLORS.info,
      fields: [
        { name: "Status page", value: "https://status.onboardops.org", inline: true },
        { name: "Triggered at", value: new Date().toUTCString(), inline: true },
      ],
    });
    if (!r.ok) throw new Error(r.error ?? "Webhook test failed.");
    await audit(staff, "OPS_WEBHOOK_TESTED", "ops-webhook", "Sent a test staff incident alert");
    return { sent: true };
  });
}

export async function draftIncidentUpdateAction(input: unknown) {
  return run(async () => {
    await requireStaff(OWNER_ONLY);
    if (!aiConfigured()) throw new Error("AI is not configured (GROQ_API_KEYS is not set). Use one of the premade templates below instead.");
    const d = z.object({
      reportTitle: z.string().trim().min(1).max(200),
      stage: z.enum(["investigating", "identified", "monitoring", "resolved"]),
      affected: z.array(z.string().max(80)).max(30).default([]),
      notes: z.string().trim().max(1000).default(""),
    }).parse(input);

    const stageGuide: Record<typeof d.stage, string> = {
      investigating: "Write a thorough Investigating update acknowledging the disruption, explaining customer impact clearly, reassuring that workspace data is safe, and stating what the team is currently analyzing.",
      identified: "Write a thorough Root Cause Identified update stating we have isolated the cause, describing the remediation underway, clarifying current user impact, and giving clear expectations for the next update.",
      monitoring: "Write a clear Monitoring update stating that a fix has been deployed, key metrics are returning to normal, and we are observing stability before closing the incident.",
      resolved: "Write a thorough, calm Post-Incident Resolution summary covering what happened, how it was fixed, confirmation that all monitors are back to normal and workspace data is intact, and pointing users to https://www.onboardops.org/contact if anything still looks off.",
    };

    const res = await chat({
      tier: "smart",
      json: true,
      maxTokens: 1200,
      temperature: 0.35,
      system: [
        "You write clear, calm, transparent customer-facing status page incident updates for OnboardOps (a staff records, training, and operations SaaS platform).",
        "Return ONLY one JSON object: {\"message\": \"...\"}.",
        "Write 3 to 4 crisp paragraphs separated by blank lines (roughly 600 to 1,200 characters total). Plain text only—no markdown headings or bullet asterisks.",
        "Never invent specific technical root causes, ticket IDs, or exact recovery minutes unless explicitly provided in the staff notes. Stay truthful, reassuring, and professional.",
      ].join("\n"),
      user: [
        `Incident title: ${d.reportTitle}`,
        `Affected services: ${d.affected.length ? d.affected.join(", ") : "OnboardOps services"}`,
        `Update stage: ${d.stage}`,
        stageGuide[d.stage],
        d.notes ? `Internal staff notes to incorporate:\n${d.notes}` : "",
      ].filter(Boolean).join("\n\n"),
    });

    const parsed = z.object({ message: z.string().trim().min(20).max(3800) }).parse(JSON.parse(res.text));
    return { message: parsed.message };
  });
}

export async function testStatusConnectionAction() {
  return run(async () => {
    const staff = await owner();
    const o = await kenerOverview();
    await audit(staff, "STATUSPAGE_TESTED", "connection", `Status page connection tested (${o.resources.length} services)`);
    return { services: o.resources.length };
  });
}

export async function createIncidentAction(input: unknown) {
  return run(async () => {
    const staff = await owner();
    const d = z.object({ title, message, resourceIds: ids, status: z.enum(["degraded", "downtime"]), notify: z.boolean() }).parse(input);
    const id = await kenerCreateIncident(d);
    await audit(staff, "STATUSPAGE_INCIDENT", id, `Posted ${d.status} incident: ${d.title}`);
    await notifyOpsAlert({
      title: `Manual incident posted: ${d.title}`,
      description: d.message.slice(0, 600),
      color: d.status === "downtime" ? COLORS.danger : COLORS.warn,
      fields: [
        { name: "Severity", value: d.status, inline: true },
        { name: "Posted by", value: staff.name, inline: true },
      ],
    }).catch(() => {});
    revalidatePath("/admin/status");
    revalidatePath("/", "layout");
    return { id };
  });
}

export async function updateIncidentAction(input: unknown) {
  return run(async () => {
    const staff = await owner();
    const d = z.object({ id: reportIdSchema, message, status: z.enum(["degraded", "downtime", "resolved"]), notify: z.boolean() }).parse(input);
    await kenerUpdateIncident(d.id, d.message, d.status, d.notify);
    await audit(staff, d.status === "resolved" ? "STATUSPAGE_RESOLVED" : "STATUSPAGE_UPDATE", d.id, `Incident ${d.id}: ${d.status} (${d.message.slice(0, 80)})`);
    await notifyOpsAlert({
      title: d.status === "resolved" ? `Incident #${d.id} marked resolved` : `Incident #${d.id} updated (${d.status})`,
      description: d.message.slice(0, 600),
      color: d.status === "resolved" ? COLORS.ok : d.status === "downtime" ? COLORS.danger : COLORS.warn,
      fields: [{ name: "Updated by", value: staff.name, inline: true }],
    }).catch(() => {});
    revalidatePath("/admin/status");
    revalidatePath("/", "layout");
    return undefined;
  });
}

export async function scheduleMaintenanceAction(input: unknown) {
  return run(async () => {
    const staff = await owner();
    const d = z.object({ title, message, resourceIds: ids, startsAt: z.string().min(8), endsAt: z.string().min(8), notify: z.boolean() }).parse(input);
    const s = Date.parse(d.startsAt), e = Date.parse(d.endsAt);
    if (isNaN(s) || isNaN(e)) throw new Error("Enter a start and an end time");
    if (e <= s) throw new Error("The end must be after the start");
    const id = await kenerScheduleMaintenance({ ...d, startsAt: new Date(s).toISOString(), endsAt: new Date(e).toISOString() });
    await audit(staff, "STATUSPAGE_MAINTENANCE", id, `Scheduled maintenance: ${d.title}`);
    revalidatePath("/admin/status");
    return { id };
  });
}

export async function endMaintenanceAction(id: string) {
  return run(async () => {
    const staff = await owner();
    reportIdSchema.parse(id);
    await kenerEndMaintenance(id);
    await audit(staff, "STATUSPAGE_MAINTENANCE_ENDED", id, `Ended maintenance report ${id}`);
    revalidatePath("/admin/status");
    return undefined;
  });
}

export async function deleteStatusReportAction(id: string) {
  return run(async () => {
    const staff = await owner();
    reportIdSchema.parse(id);
    await kenerDeleteReport(id);
    await audit(staff, "STATUSPAGE_DELETED", id, `Deleted status report ${id}`);
    revalidatePath("/admin/status");
    revalidatePath("/", "layout");
    return undefined;
  });
}
