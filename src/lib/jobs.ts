import { prisma } from "./prisma";
import { writeAudit } from "./audit";
import { sendEmail, emails } from "./email";
import { notifyEmployee, notifyRoles } from "./notify";

const DAY = 86400000;

export type JobSummary = { workspaces: number; expired: number; expiringNotices: number; dueReminders: number; overdueReminders: number; leaveStarted?: number; leaveEnded?: number; separated?: number };

/**
 * Daily housekeeping: expire certifications (and re-enroll), warn before they lapse, and remind about due and overdue training.
 * Runs for one workspace, or for all of them when workspaceId is omitted (the cron job).
 */
export async function runDailyJobs(workspaceId?: string): Promise<JobSummary> {
  const now = new Date();
  const out: JobSummary = { workspaces: 0, expired: 0, expiringNotices: 0, dueReminders: 0, overdueReminders: 0, leaveStarted: 0, leaveEnded: 0, separated: 0 };
  const workspaces = await prisma.workspace.findMany({ where: { ...(workspaceId ? { id: workspaceId } : {}), remindersEnabled: true, NOT: { cmk: { is: { status: "REVOKED" } } } }, select: { id: true, name: true } });

  for (const ws of workspaces) {
    out.workspaces++;
    const live = { workspaceId: ws.id, employee: { status: { not: "TERMINATED" as const } } };

    // 0. Approved leave starting or ending today, and approved separations whose last day has passed
    const today = new Date(now.toISOString().slice(0, 10) + "T00:00:00Z");
    const leaves = await prisma.staffRequest.findMany({ where: { workspaceId: ws.id, kind: "LOA", status: "APPROVED" }, include: { employee: true } });
    for (const r of leaves) {
      if (r.startDate && r.startDate <= today && (!r.endDate || r.endDate >= today) && r.employee.status === "ACTIVE") {
        await prisma.$transaction(async (tx) => { await tx.employeeProfile.update({ where: { id: r.employeeId }, data: { status: "LOA" } }); await writeAudit(tx, { workspaceId: ws.id, actorName: "System", actionType: "LOA_STARTED", targetType: "Employee", targetId: r.employeeId, summary: `${r.employee.staffCode} started approved leave of absence` }); });
        out.leaveStarted!++;
      } else if (r.endDate && r.endDate < today && r.employee.status === "LOA") {
        await prisma.$transaction(async (tx) => { await tx.employeeProfile.update({ where: { id: r.employeeId }, data: { status: "ACTIVE" } }); await tx.staffRequest.update({ where: { id: r.id }, data: { status: "COMPLETED" } }); await writeAudit(tx, { workspaceId: ws.id, actorName: "System", actionType: "LOA_ENDED", targetType: "Employee", targetId: r.employeeId, summary: `${r.employee.staffCode} returned from leave of absence` }); await notifyRoles(tx, ws.id, ["OWNER", "ADMIN", "MANAGER"], { title: `${r.employee.fullName} returned from leave`, href: `/app/employee/${r.employeeId}` }); });
        out.leaveEnded!++;
      }
    }
    const leaving = await prisma.employeeProfile.findMany({ where: { workspaceId: ws.id, separationDate: { lt: today }, status: { not: "TERMINATED" } } });
    for (const e of leaving) {
      await prisma.$transaction(async (tx) => { await tx.employeeProfile.update({ where: { id: e.id }, data: { status: "TERMINATED" } }); await writeAudit(tx, { workspaceId: ws.id, actorName: "System", actionType: "SEPARATION_COMPLETED", targetType: "Employee", targetId: e.id, summary: `${e.staffCode} separated (${e.separationReason ?? "separation"}); status → TERMINATED` }); });
      out.separated!++;
    }

    // 1. Expire lapsed certifications and re-enroll
    const lapsed = await prisma.courseEnrollment.findMany({ where: { ...live, status: "PASSED", expiresAt: { lte: now } }, include: { course: true, employee: true } });
    for (const e of lapsed) {
      const oldCode = e.certificateCode;
      await prisma.$transaction(async (tx) => {
        await tx.courseEnrollment.update({
          where: { id: e.id },
          data: { status: "ASSIGNED", completedAt: null, certificateCode: null, expiresAt: null, assignedReason: `Certification expired${oldCode ? ` (${oldCode})` : ""}`, dueDate: new Date(now.getTime() + e.course.defaultDueDays * DAY), reminderStage: 0, reminderSentAt: null },
        });
        if (e.employee.readiness === "CERTIFIED") await tx.employeeProfile.update({ where: { id: e.employeeId }, data: { readiness: "PENDING" } });
        await writeAudit(tx, { workspaceId: ws.id, actorName: "System", actionType: "CERT_EXPIRED", targetType: "Employee", targetId: e.employeeId, summary: `${e.employee.staffCode} certification for "${e.course.title}" expired${oldCode ? ` (${oldCode})` : ""}; re-enrolled`, metadata: { courseId: e.courseId } });
        await notifyEmployee(tx, ws.id, e.employeeId, { title: `Recertify: ${e.course.title}`, body: "Your certification expired. Retake the course to renew it.", href: `/app/training/course/${e.courseId}` });
        await notifyRoles(tx, ws.id, ["OWNER", "ADMIN", "MANAGER"], { title: `${e.employee.fullName}'s certification expired`, body: e.course.title, href: `/app/employee/${e.employeeId}` });
      });
      const m = emails.reminder(e.employee.fullName, e.course.title, "has expired and needs to be retaken");
      await sendEmail(e.employee.email, m.subject, m.text, { html: m.html });
      out.expired++;
    }

    // 2. Warn before certifications lapse (30 days, then 7 days)
    const expiring = await prisma.courseEnrollment.findMany({ where: { ...live, status: "PASSED", expiresAt: { gt: now, lte: new Date(now.getTime() + 30 * DAY) } }, include: { course: true, employee: true } });
    for (const e of expiring) {
      const days = Math.ceil((e.expiresAt!.getTime() - now.getTime()) / DAY);
      const want = days <= 7 ? 2 : 1;
      if (e.reminderStage >= want) continue;
      await prisma.courseEnrollment.update({ where: { id: e.id }, data: { reminderStage: want, reminderSentAt: now } });
      await notifyEmployee(prisma, ws.id, e.employeeId, { title: `Certification expires in ${days} day${days === 1 ? "" : "s"}`, body: e.course.title, href: `/app/training/course/${e.courseId}` });
      const m = emails.reminder(e.employee.fullName, e.course.title, `certification expires in ${days} day${days === 1 ? "" : "s"}`);
      await sendEmail(e.employee.email, m.subject, m.text, { html: m.html });
      out.expiringNotices++;
    }

    // 3. Due and overdue reminders for open training
    const open = await prisma.courseEnrollment.findMany({ where: { ...live, status: { in: ["ASSIGNED", "IN_PROGRESS", "FAILED"] }, dueDate: { not: null, lte: new Date(now.getTime() + 3 * DAY) }, course: { isPublished: true } }, include: { course: true, employee: true } });
    for (const e of open) {
      const overdue = e.dueDate! < now;
      const stale = e.reminderSentAt && now.getTime() - e.reminderSentAt.getTime() > 7 * DAY;
      if (overdue ? !(e.reminderStage < 2 || stale) : e.reminderStage >= 1) continue;
      await prisma.courseEnrollment.update({ where: { id: e.id }, data: { reminderStage: overdue ? 2 : 1, reminderSentAt: now } });
      const when = overdue ? "is overdue" : "is due within 3 days";
      await notifyEmployee(prisma, ws.id, e.employeeId, { title: overdue ? `Overdue: ${e.course.title}` : `Due soon: ${e.course.title}`, body: when, href: `/app/training/course/${e.courseId}` });
      const m = emails.reminder(e.employee.fullName, e.course.title, when);
      await sendEmail(e.employee.email, m.subject, m.text, { html: m.html });
      overdue ? out.overdueReminders++ : out.dueReminders++;
    }
  }
  return out;
}

/** Runs the daily job and records the outcome in JobRun so staff can see it on the dashboard. */
export async function runLoggedDailyJobs(name: string, workspaceId?: string) {
  const t0 = Date.now();
  try {
    const r = await runDailyJobs(workspaceId);
    await prisma.jobRun.create({ data: { name, ok: true, summary: r, durationMs: Date.now() - t0 } });
    return r;
  } catch (e) {
    await prisma.jobRun.create({ data: { name, ok: false, summary: { error: e instanceof Error ? e.message : "failed" }, durationMs: Date.now() - t0 } });
    throw e;
  }
}
