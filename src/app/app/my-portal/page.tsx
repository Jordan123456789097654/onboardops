import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole, ALL_ROLES, serializeInfraction, hasFeature } from "@/lib/rbac";
import { allowanceOf, usage, TIMEOFF_TYPES } from "@/lib/timeoff";
import { hasSmsConfig } from "@/lib/sms";
import { apiUrl, getApiOrigin } from "@/lib/service-role";
import { Empty } from "@/components/ui";
import { Portal } from "./portal";

export const metadata = { title: "My Portal" };

export default async function MyPortal() {
  const ctx = await requirePageRole(ALL_ROLES);
  if (!ctx.profile) {
    return <Empty title="No employee profile is linked to your login" hint="Ask a manager to link your account to an employee record." />;
  }
  const p = ctx.profile;
  const [enrollments, cases, templates, subs, policies, myIncidents, sharedReviews, myDocs, myRequests, openEntry, myAppeals] = await Promise.all([
    prisma.courseEnrollment.findMany({ where: { employeeId: p.id, workspaceId: ctx.workspaceId, course: { isPublished: true } }, include: { course: true }, orderBy: { dueDate: "asc" } }),
    prisma.infractionCase.findMany({ where: { employeeId: p.id, workspaceId: ctx.workspaceId }, include: { timeline: true, attachments: true }, orderBy: { createdAt: "desc" } }),
    prisma.shiftChecklistTemplate.findMany({ where: { workspaceId: ctx.workspaceId, OR: [{ departmentId: p.departmentId }, { departmentId: null }] }, orderBy: { shiftType: "asc" } }),
    prisma.shiftChecklistSubmission.findMany({ where: { completedByEmployeeId: p.id }, include: { template: true }, orderBy: { submittedAt: "desc" }, take: 5 }),
    prisma.policy.findMany({ where: { workspaceId: ctx.workspaceId, isPublished: true, OR: [{ appliesToAll: true }, ...(p.jobRoleId ? [{ requiredJobRoleIds: { has: p.jobRoleId } }] : [])] }, include: { acks: { where: { employeeId: p.id } } }, orderBy: { createdAt: "desc" } }),
    prisma.incidentReport.findMany({ where: { workspaceId: ctx.workspaceId, reporterEmployeeId: p.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.review.findMany({ where: { workspaceId: ctx.workspaceId, employeeId: p.id, status: "SHARED" }, orderBy: { sharedAt: "desc" } }),
    prisma.employeeDocument.findMany({ where: { workspaceId: ctx.workspaceId, employeeId: p.id, visibleToEmployee: true, restricted: false }, orderBy: { createdAt: "desc" } }),
    prisma.staffRequest.findMany({ where: { employeeId: p.id }, orderBy: { createdAt: "desc" }, take: 15 }),
    prisma.timeEntry.findFirst({ where: { workspaceId: ctx.workspaceId, employeeId: p.id, clockOut: null } }),
    prisma.appeal.findMany({ where: { workspaceId: ctx.workspaceId, case: { employeeId: p.id } }, orderBy: { createdAt: "desc" } }),
  ]);
  const yearReqs = await prisma.staffRequest.findMany({ where: { employeeId: p.id, kind: "TIMEOFF" }, select: { subtype: true, status: true, startDate: true, endDate: true } });
  const use = usage(yearReqs);
  const allow = allowanceOf(p.timeOffAllowance);
  const sched = hasFeature(ctx, "scheduling");
  const [myShifts, coworkers] = sched
    ? await Promise.all([
        prisma.shift.findMany({ where: { workspaceId: ctx.workspaceId, employeeId: p.id, endsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" }, take: 8 }),
        prisma.employeeProfile.findMany({ where: { workspaceId: ctx.workspaceId, status: "ACTIVE", id: { not: p.id } }, orderBy: { fullName: "asc" } }),
      ])
    : [[], []];
  const [teamShifts, weekEntries, creds, location] = await Promise.all([
    sched ? prisma.shift.findMany({ where: { workspaceId: ctx.workspaceId, employeeId: { not: null, notIn: [p.id] }, endsAt: { gt: new Date(Date.now() - 12 * 3600000) }, startsAt: { lt: new Date(Date.now() + 8 * 86400000) } }, include: { employee: true }, orderBy: { startsAt: "asc" }, take: 80 }) : Promise.resolve([]),
    prisma.timeEntry.findMany({ where: { workspaceId: ctx.workspaceId, employeeId: p.id, clockIn: { gte: new Date(Date.now() - 14 * 86400000) } }, orderBy: { clockIn: "desc" }, take: 60 }),
    prisma.credential.findMany({ where: { workspaceId: ctx.workspaceId, employeeId: p.id, expiresAt: { not: null, lte: new Date(Date.now() + 30 * 86400000) } }, orderBy: { expiresAt: "asc" }, take: 10 }),
    p.locationId ? prisma.location.findFirst({ where: { id: p.locationId, workspaceId: ctx.workspaceId } }) : Promise.resolve(null),
  ]);
  const short = (n: string) => { const [f, ...r] = n.split(" "); return r.length ? `${f} ${r[r.length - 1][0]}.` : f; };
  return (
    <Portal
      locationName={location?.name ?? null}
      teamShifts={teamShifts.map((s) => ({ id: s.id, name: short(s.employee!.fullName), label: s.label, startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString() }))}
      weekEntries={weekEntries.map((e) => ({ clockIn: e.clockIn.toISOString(), clockOut: e.clockOut?.toISOString() ?? null }))}
      credentials={creds.map((c) => ({ id: c.id, name: c.name, expires: c.expiresAt!.toISOString() }))}
      submittedTemplates={subs.map((s) => ({ id: s.templateId, at: s.submittedAt.toISOString() }))}
      calendarUrl={p.calendarToken ? (getApiOrigin() ? apiUrl(`/api/calendar/${p.calendarToken}.ics`) : `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/api/calendar/${p.calendarToken}.ics`) : ""}
      sms={{ configured: hasSmsConfig(ctx.workspace), optIn: p.smsOptIn, phone: p.phone ?? "" }}
      balances={TIMEOFF_TYPES.map((t) => ({ type: t, allowance: allow[t], used: use[t].used, pending: use[t].pending }))}
      shifts={myShifts.map((s) => ({ id: s.id, label: s.label, startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString(), swap: s.swapStatus }))}
      coworkers={coworkers.map((c) => ({ id: c.id, name: c.fullName }))}
      phone={p.phone ?? ""} emergencyContact={p.emergencyContact ?? ""} openEntry={openEntry ? { id: openEntry.id, since: openEntry.clockIn.toISOString() } : null}
      appeals={myAppeals.map((a) => ({ caseId: a.caseId, status: a.status, note: a.decisionNote }))}
      name={p.fullName} staffCode={p.staffCode} status={p.status} readiness={p.readiness} points={p.strikePoints}
      enrollments={enrollments.map((e) => ({ id: e.id, courseId: e.courseId, title: e.course.title, status: e.status, best: e.bestScore, cert: e.certificateCode, due: e.dueDate?.toISOString() ?? null, reason: e.assignedReason, remedial: e.course.isRemedial }))}
      cases={cases.map((c) => {
        const s = serializeInfraction("EMPLOYEE", c);
        return { id: s.id, caseNumber: s.caseNumber, severity: s.severity, points: s.pointsAdded, policy: s.policyViolated, summary: s.summary, acknowledged: s.employeeAcknowledged, at: s.createdAt.toISOString(), responded: c.attachments.some((a) => a.kind === "EMPLOYEE_RESPONSE") };
      })}
      templates={templates.map((t) => ({ id: t.id, title: t.title, shiftType: t.shiftType, items: t.items as { id: string; label: string; required: boolean }[], dueToday: t.scheduleDays.includes(new Date().getDay()), dueTime: t.dueTime ?? "" }))}
      policies={policies.map((x) => ({ id: x.id, title: x.title, description: x.description, md: x.contentMarkdown, fileId: x.fileId, link: x.externalUrl ?? "", version: x.version, signed: x.acks.some((a) => a.version === x.version) }))}
      documents={myDocs.map((d) => ({ id: d.id, title: d.title, category: d.category, href: d.externalUrl ?? `/api/files/${d.fileId}`, expires: d.expiresAt?.toISOString() ?? null }))}
      requests={myRequests.map((r) => ({ id: r.id, subtype: r.subtype, kind: r.kind, status: r.status, start: r.startDate?.toISOString() ?? null, end: r.endDate?.toISOString() ?? null, note: r.decisionNote, by: r.decidedByName }))}
      incidents={myIncidents.map((i) => ({ id: i.id, type: i.type, status: i.status, at: i.occurredAt.toISOString(), description: i.description }))}
      reviews={sharedReviews.map((r) => ({ id: r.id, kind: r.kind, period: r.periodLabel, rating: r.rating, summary: r.summary, strengths: r.strengths, improvements: r.improvements, goals: r.goals, author: r.authorName, at: (r.sharedAt ?? r.createdAt).toISOString() }))}
      submissions={subs.map((s) => ({ id: s.id, title: s.template.title, at: s.submittedAt.toISOString(), verified: !!s.verifiedAt }))}
    />
  );
}
