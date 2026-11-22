"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { OWNER_ONLY, requireStaff, staffAudit } from "@/lib/platform";
import { bsCreateIncident, bsDeleteReport, bsEndMaintenance, bsOverview, bsScheduleMaintenance, bsUpdateIncident, betterstackConfigured } from "@/lib/betterstack";
import { run } from "./_util";

/** The status page manager. Site owner only, because what is posted here is public. Every change is written to the staff audit log. */
async function owner() {
  const staff = await requireStaff(OWNER_ONLY);
  if (!betterstackConfigured()) throw new Error("BETTERSTACK_API_TOKEN is not set in the hosting settings, so the status page cannot be reached yet.");
  return staff;
}
const audit = (staff: Awaited<ReturnType<typeof owner>>, action: string, id: string, summary: string) =>
  prisma.$transaction((tx) => staffAudit(tx, staff, { action, targetType: "StatusPage", targetId: id, summary }));

const title = z.string().trim().min(3, "Give it a title").max(120);
const message = z.string().trim().min(3, "Write a short message").max(1000);
const ids = z.array(z.string().regex(/^\d+$/)).min(1, "Pick at least one service").max(40);

export async function testStatusConnectionAction() {
  return run(async () => {
    const staff = await owner();
    const o = await bsOverview();
    await audit(staff, "STATUSPAGE_TESTED", "connection", `Status page connection tested (${o.resources.length} services)`);
    return { services: o.resources.length };
  });
}

export async function createIncidentAction(input: unknown) {
  return run(async () => {
    const staff = await owner();
    const d = z.object({ title, message, resourceIds: ids, status: z.enum(["degraded", "downtime"]), notify: z.boolean() }).parse(input);
    const id = await bsCreateIncident(d);
    await audit(staff, "STATUSPAGE_INCIDENT", id, `Posted ${d.status} incident: ${d.title}`);
    revalidatePath("/admin/status");
    return { id };
  });
}

export async function updateIncidentAction(input: unknown) {
  return run(async () => {
    const staff = await owner();
    const d = z.object({ id: z.string().regex(/^\d+$/), message, status: z.enum(["degraded", "downtime", "resolved"]), notify: z.boolean() }).parse(input);
    await bsUpdateIncident(d.id, d.message, d.status, d.notify);
    await audit(staff, d.status === "resolved" ? "STATUSPAGE_RESOLVED" : "STATUSPAGE_UPDATE", d.id, `Incident ${d.id}: ${d.status} (${d.message.slice(0, 80)})`);
    revalidatePath("/admin/status");
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
    const id = await bsScheduleMaintenance({ ...d, startsAt: new Date(s).toISOString(), endsAt: new Date(e).toISOString() });
    await audit(staff, "STATUSPAGE_MAINTENANCE", id, `Scheduled maintenance: ${d.title}`);
    revalidatePath("/admin/status");
    return { id };
  });
}

export async function endMaintenanceAction(id: string) {
  return run(async () => {
    const staff = await owner();
    z.string().regex(/^\d+$/).parse(id);
    await bsEndMaintenance(id);
    await audit(staff, "STATUSPAGE_MAINTENANCE_ENDED", id, `Ended maintenance report ${id}`);
    revalidatePath("/admin/status");
    return undefined;
  });
}

export async function deleteStatusReportAction(id: string) {
  return run(async () => {
    const staff = await owner();
    z.string().regex(/^\d+$/).parse(id);
    await bsDeleteReport(id);
    await audit(staff, "STATUSPAGE_DELETED", id, `Deleted status report ${id}`);
    revalidatePath("/admin/status");
    return undefined;
  });
}
