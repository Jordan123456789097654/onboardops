"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { requireWorkspaceRole, ALL_ROLES, MANAGEMENT_ROLES, ADMIN_ROLES, requirePerm, requireFeature } from "@/lib/rbac";
import { notifyEmployee, notifyRoles } from "@/lib/notify";
import { emails, sendEmail } from "@/lib/email";
import { COLORS, sendEmbed } from "@/lib/webhooks";
import { allowanceOf, daysBetween, usage } from "@/lib/timeoff";
import { textEmployee } from "@/lib/sms";
import { run } from "./_util";

const LABEL: Record<string, string> = { LOA: "leave of absence", RETIREMENT: "retirement", RESIGNATION: "resignation", TIMEOFF: "time-off" };
const dayStart = (s: string) => new Date(`${s}T00:00:00Z`);

const submitSchema = z.object({
  kind: z.enum(["LOA", "RETIREMENT", "RESIGNATION", "TIMEOFF"]),
  subtype: z.enum(["VACATION", "SICK", "PERSONAL"]).optional(),
  startDate: z.string().optional().or(z.literal("")),
  endDate: z.string().optional().or(z.literal("")),
  reason: z.string().trim().min(5, "Add a short reason").max(2000),
});

/** An employee asks for a leave of absence, or tells their employer they are retiring or resigning. */
export async function submitStaffRequestAction(input: unknown) {
  return run(async () => {
    const ctx = await requireFeature("requests");
    const me = ctx.profile;
    if (!me) throw new Error("No employee profile is linked to your login.");
    const d = submitSchema.parse(input);
    const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
    let start: Date | null = d.startDate ? dayStart(d.startDate) : null;
    const end: Date | null = d.endDate ? dayStart(d.endDate) : null;
    if (start && isNaN(start.getTime())) throw new Error("Enter a valid start date.");
    if (end && isNaN(end.getTime())) throw new Error("Enter a valid date.");
    if (d.kind === "TIMEOFF") {
      if (!d.subtype) throw new Error("Choose vacation, sick or personal.");
      if (!start || !end) throw new Error("Choose the first and last day off.");
      if (end < start) throw new Error("The last day cannot be before the first.");
    } else if (d.kind === "LOA") {
      if (!start) throw new Error("When does your leave start?");
      if (end && end < start) throw new Error("The leave cannot end before it starts.");
    } else {
      if (!end) throw new Error(d.kind === "RETIREMENT" ? "What is your last working day?" : "What is your last day?");
      if (end < today) throw new Error("The last day cannot be in the past.");
      start = null;
    }
    if (d.kind === "TIMEOFF" && d.subtype && start && end) {
      const allow = allowanceOf(me.timeOffAllowance)[d.subtype];
      if (allow > 0) {
        const mine = await prisma.staffRequest.findMany({ where: { employeeId: me.id, kind: "TIMEOFF", status: { in: ["APPROVED", "PENDING"] } }, select: { subtype: true, status: true, startDate: true, endDate: true } });
        const u = usage(mine, start.getUTCFullYear())[d.subtype];
        const need = daysBetween(start, end);
        if (u.used + u.pending + need > allow) throw new Error(`Not enough ${d.subtype.toLowerCase()} days: ${allow - u.used - u.pending} left of ${allow} this year, and you asked for ${need}.`);
      }
    }
    const dup = await prisma.staffRequest.count({ where: { employeeId: me.id, kind: d.kind, ...(d.kind === "TIMEOFF" ? { subtype: d.subtype } : {}), status: "PENDING" } });
    if (dup) throw new Error("You already have a pending request of this type. Withdraw it first to send a new one.");
    const req = await prisma.$transaction(async (tx) => {
      const r = await tx.staffRequest.create({ data: { workspaceId: ctx.workspaceId, employeeId: me.id, kind: d.kind, subtype: d.kind === "TIMEOFF" ? d.subtype : null, startDate: start, endDate: end, reason: d.reason } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "STAFF_REQUEST_SUBMITTED", targetType: "Employee", targetId: me.id, summary: `${me.staffCode} requested ${LABEL[d.kind]}` });
      await notifyRoles(tx, ctx.workspaceId, d.kind === "LOA" || d.kind === "TIMEOFF" ? ["OWNER", "ADMIN", "MANAGER"] : ["OWNER", "ADMIN"], { title: `${me.fullName} requested ${LABEL[d.kind]}`, body: d.reason.slice(0, 100), href: "/app/requests" }, ctx.id);
      return r;
    });
    await sendEmbed(ctx.workspace.confidentialWebhookUrl, { title: `Request: ${LABEL[d.kind]}`, description: `${me.fullName} (${me.staffCode})`, color: COLORS.info });
    revalidatePath("/app", "layout");
    return { id: req.id };
  });
}

export async function withdrawStaffRequestAction(id: string) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ALL_ROLES);
    if (!ctx.profile) throw new Error("No employee profile is linked to your login.");
    await prisma.$transaction(async (tx) => {
      const r = await tx.staffRequest.findFirst({ where: { id, employeeId: ctx.profile!.id, status: "PENDING" } });
      if (!r) throw new Error("Only pending requests can be withdrawn.");
      await tx.staffRequest.update({ where: { id }, data: { status: "WITHDRAWN", decidedAt: new Date() } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "STAFF_REQUEST_WITHDRAWN", targetType: "Employee", targetId: ctx.profile!.id, summary: `${ctx.profile!.staffCode} withdrew a ${LABEL[r.kind]} request` });
    });
    revalidatePath("/app", "layout");
    return undefined;
  });
}

const decideSchema = z.object({ decision: z.enum(["APPROVED", "DENIED"]), note: z.string().trim().max(1000).default("") });

/** Managers decide leave requests. Retirement and resignation can only be accepted by owners and admins. */
export async function decideStaffRequestAction(id: string, input: unknown) {
  return run(async () => {
    const ctx = await requirePerm("requests.decide", "requests");
    const d = decideSchema.parse(input);
    const out = await prisma.$transaction(async (tx) => {
      const r = await tx.staffRequest.findFirst({ where: { id, workspaceId: ctx.workspaceId }, include: { employee: true } });
      if (!r) throw new Error("Request not found.");
      if (r.status !== "PENDING") throw new Error("This request was already decided or withdrawn.");
      if (r.kind !== "LOA" && r.kind !== "TIMEOFF" && !ADMIN_ROLES.includes(ctx.role)) throw new Error("Only owners and admins can accept a retirement or resignation.");
      if (d.decision === "DENIED" && d.note.length < 3) throw new Error("Add a note explaining why it was denied.");
      const emp = r.employee;
      const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
      const effects: string[] = [];
      if (d.decision === "APPROVED") {
        if (r.kind === "LOA") {
          if (r.startDate && r.startDate <= today && emp.status === "ACTIVE") { await tx.employeeProfile.update({ where: { id: emp.id }, data: { status: "LOA" } }); effects.push("status → LOA"); }
        } else if (r.kind !== "TIMEOFF" && r.endDate) {
          await tx.employeeProfile.update({ where: { id: emp.id }, data: { separationDate: r.endDate, separationReason: r.kind === "RETIREMENT" ? "Retired" : "Resigned", ...(r.endDate <= today ? { status: "TERMINATED" } : {}) } });
          effects.push(r.endDate <= today ? "status → TERMINATED (separated)" : `separation set for ${r.endDate.toISOString().slice(0, 10)}`);
        }
      }
      await tx.staffRequest.update({ where: { id }, data: { status: d.decision, decidedByName: ctx.user.name, decisionNote: d.note, decidedAt: new Date() } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: `STAFF_REQUEST_${d.decision}`, targetType: "Employee", targetId: emp.id, summary: `${emp.staffCode} ${LABEL[r.kind]} request ${d.decision.toLowerCase()}${effects.length ? ` — ${effects.join("; ")}` : ""}${d.note ? `. Note: ${d.note}` : ""}` });
      await notifyEmployee(tx, ctx.workspaceId, emp.id, { title: `Your ${LABEL[r.kind]} request was ${d.decision.toLowerCase()}`, body: d.note, href: "/app/my-portal" });
      return { emp, kind: r.kind };
    });
    const m = emails.requestDecision(out.emp.fullName, LABEL[out.kind], d.decision, d.note);
    await sendEmail(out.emp.email, m.subject, m.text, { html: m.html, kind: "request-decision", workspaceId: ctx.workspaceId });
    await textEmployee(ctx.workspaceId, out.emp.id, `Your ${LABEL[out.kind]} request was ${d.decision.toLowerCase()}.`);
    revalidatePath("/app", "layout");
    return undefined;
  });
}
