import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage, ALL_STAFF } from "@/lib/platform";
import { getAnnouncementState, getMaintenanceState, getSiteVisits, PLATFORM_META_IDS } from "@/lib/maintenance";
import { PageHeader, Badge } from "@/components/ui";
import { CountUp } from "@/components/motion";
import { StackedBars } from "@/components/charts";
import { fmtDateTime } from "@/lib/utils";
import { MaintenancePanel } from "./maintenance-panel";
import { AnnouncementPanel } from "./announcement-panel";

export const metadata = { title: "Dashboard" };

export default async function AdminHome() {
  const staff = await requireStaffPage(ALL_STAFF);
  const now = Date.now();
  const week = new Date(now - 7 * 86400000);
  const d30 = new Date(now - 30 * 86400000);
  const d90 = new Date(now - 90 * 86400000);
  const eightWeeks = new Date(now - 56 * 86400000);

  const [
    workspaces,
    newWs,
    users,
    employees,
    active7,
    active30,
    active90,
    openReq,
    privacyOpen,
    failedEmails,
    notifyFails,
    jobs,
    signups,
    locked,
    sentEmails7,
    sentEmails30,
    sentEmails90,
    quizzesGraded,
    quizzesPassed,
    checklistsDone,
    topAuditWs,
    maintenance,
    announcement,
    visits,
  ] = await Promise.all([
    prisma.workspace.count(),
    prisma.workspace.count({ where: { createdAt: { gte: week } } }),
    prisma.user.count(),
    prisma.employeeProfile.count({ where: { status: { not: "TERMINATED" } } }),
    prisma.auditLog.groupBy({ by: ["workspaceId"], where: { createdAt: { gte: week }, actorName: { not: "System" } } }),
    prisma.auditLog.groupBy({ by: ["workspaceId"], where: { createdAt: { gte: d30 }, actorName: { not: "System" } } }),
    prisma.auditLog.groupBy({ by: ["workspaceId"], where: { createdAt: { gte: d90 }, actorName: { not: "System" } } }),
    prisma.supportRequest.count({ where: { status: { not: "SOLVED" }, NOT: { topic: "Privacy request" } } }),
    prisma.supportRequest.count({ where: { status: { not: "SOLVED" }, topic: "Privacy request" } }),
    prisma.emailLog.count({ where: { status: "FAILED", createdAt: { gte: week } } }),
    prisma.auditLog.count({ where: { actionType: "NOTIFY_FAILED", createdAt: { gte: week } } }),
    prisma.jobRun.findMany({ where: { id: { notIn: PLATFORM_META_IDS } }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.workspace.findMany({ where: { createdAt: { gte: eightWeeks } }, select: { createdAt: true } }),
    prisma.workspace.count({ where: { suspendedAt: { not: null } } }),
    prisma.emailLog.count({ where: { status: "SENT", createdAt: { gte: week } } }),
    prisma.emailLog.count({ where: { status: "SENT", createdAt: { gte: d30 } } }),
    prisma.emailLog.count({ where: { status: "SENT", createdAt: { gte: d90 } } }),
    prisma.courseEnrollment.aggregate({ _sum: { attemptsCount: true } }),
    prisma.courseEnrollment.count({ where: { status: "PASSED" } }),
    prisma.shiftChecklistSubmission.count(),
    prisma.auditLog.groupBy({
      by: ["workspaceId"],
      where: { createdAt: { gte: d30 }, actorName: { not: "System" } },
      _count: { _all: true },
      orderBy: { _count: { workspaceId: "desc" } },
      take: 6,
    }),
    getMaintenanceState(),
    getAnnouncementState(),
    getSiteVisits(),
  ]);

  const topWsIds = topAuditWs.map((x) => x.workspaceId);
  const topWsRows = topWsIds.length
    ? await prisma.workspace.findMany({
        where: { id: { in: topWsIds } },
        select: { id: true, name: true, slug: true, _count: { select: { employees: true } } },
      })
    : [];
  const topWsMap = new Map(topWsRows.map((w) => [w.id, w]));
  const topActive = topAuditWs
    .map((x) => {
      const w = topWsMap.get(x.workspaceId);
      return w ? { id: w.id, name: w.name, slug: w.slug, employees: w._count.employees, events: x._count._all } : null;
    })
    .filter(Boolean) as { id: string; name: string; slug: string; employees: number; events: number }[];

  const retention30 = workspaces ? Math.round((active30.length / workspaces) * 100) : 0;
  const retention90 = workspaces ? Math.round((active90.length / workspaces) * 100) : 0;
  const totalQuizAttempts = quizzesGraded._sum.attemptsCount ?? 0;

  const buckets = Array.from({ length: 8 }, (_, i) => new Date(now - (7 - i) * 7 * 86400000));
  const weekly = buckets.map((start, i) => signups.filter((s) => s.createdAt >= start && (i === 7 || s.createdAt < buckets[i + 1])).length);
  const labels = buckets.map((d) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`);

  const kpis: [string, number, string, string?][] = [
    ["Site Visits", visits.total, `${visits.today} today · ${visits.last7d} (7d) · ${visits.last30d} (30d)`],
    ["Workspaces", workspaces, `${newWs} new this week · ${active7.length} active (7d)`],
    ["People Under Management", employees, `${users} user accounts`],
    ["30d / 90d Retention", retention30, `${active30.length}/${workspaces} (30d) · ${retention90}% (90d)`, "%"],
  ];

  const usageKpis: [string, number, string][] = [
    ["Quizzes Graded", totalQuizAttempts, `${quizzesPassed} courses passed`],
    ["Checklists Completed", checklistsDone, "across all workspaces"],
    ["Emails Sent (30d / 90d)", sentEmails30, `${sentEmails90} in last 90d · ${sentEmails7} in 7d`],
    ["Open Support", openReq, `${privacyOpen} privacy requests open`],
  ];

  return (
    <>
      <PageHeader title="Dashboard" sub="Platform health, site visits, growth analytics and site-wide controls." />
      <MaintenancePanel initial={maintenance} canManage={staff.role === "OWNER"} />
      <AnnouncementPanel initial={announcement} canManage={staff.role === "OWNER"} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(([l, v, n, sfx], i) => (
          <div key={l} style={{ "--i": i } as React.CSSProperties} className="card anim-fade-up p-4">
            <div className="text-xs text-soft">{l}</div>
            <div className="mono mt-1 text-3xl font-semibold"><CountUp to={v} suffix={sfx ?? ""} /></div>
            <div className="mt-1 text-xs text-soft">{n}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {usageKpis.map(([l, v, n], i) => (
          <div key={l} style={{ "--i": i + 4 } as React.CSSProperties} className="card anim-fade-up p-4">
            <div className="text-xs text-soft">{l}</div>
            <div className="mono mt-1 text-2xl font-semibold"><CountUp to={v} /></div>
            <div className="mt-1 text-xs text-soft">{n}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-3 text-sm font-semibold">Daily Site Visits (Last 14 Days)</h2>
          <StackedBars labels={visits.dailyLabels} series={[{ name: "Visits", values: visits.dailyCounts }]} />
          {visits.topPaths.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <h3 className="mb-2 text-xs font-semibold text-soft">Top visited pages</h3>
              <div className="grid gap-1.5 sm:grid-cols-2 text-xs">
                {visits.topPaths.map((tp) => (
                  <div key={tp.path} className="flex items-center justify-between rounded border border-line bg-muted/40 px-2.5 py-1">
                    <span className="mono truncate">{tp.path}</span>
                    <span className="mono ml-2 font-semibold">{tp.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="card p-4">
          <h2 className="mb-3 text-sm font-semibold">New Workspaces Per Week</h2>
          <StackedBars labels={labels} series={[{ name: "Signups", values: weekly }]} />
          <div className="mt-4 border-t border-line pt-3">
            <h3 className="mb-2 text-xs font-semibold text-soft">Top Active Workspaces (Last 30 Days)</h3>
            {topActive.length === 0 ? (
              <p className="text-xs text-soft">No workspace activity recorded in the last 30 days.</p>
            ) : (
              <div className="divide-y divide-line text-[13px]">
                {topActive.map((w) => (
                  <div key={w.id} className="flex items-center justify-between py-1.5">
                    <div>
                      <Link href={`/admin/workspaces/${w.id}`} className="font-medium text-accent hover:underline">{w.name}</Link>
                      <span className="mono ml-2 text-xs text-soft">{w.employees} staff</span>
                    </div>
                    <span className="mono text-xs">{w.events} actions</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-3 text-sm font-semibold">Health (Last 7 Days)</h2>
          <dl className="divide-y divide-line text-[13px]">
            {[
              ["Emails sent", sentEmails7, false],
              ["Emails failed", failedEmails, failedEmails > 0],
              ["Webhook or email delivery failures inside workspaces", notifyFails, notifyFails > 0],
              ["Locked workspaces", locked, locked > 0],
            ].map(([l, v, bad]) => (
              <div key={String(l)} className="flex items-center justify-between py-2">
                <dt className="text-soft">{l}</dt>
                <dd className={`mono ${bad ? "text-rose-600" : ""}`}>{String(v)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="card p-4">
          <h2 className="mb-3 text-sm font-semibold">Recent Job Runs</h2>
          {jobs.length === 0 ? (
            <p className="text-[13px] text-soft">No job runs recorded yet.</p>
          ) : (
            <ul className="space-y-1.5 text-[13px]">
              {jobs.map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-2">
                  <span>{j.name} <span className="mono text-xs text-soft">{fmtDateTime(j.createdAt)} · {j.durationMs}ms</span></span>
                  <Badge value={j.ok ? "PASSED" : "FAILED"} label={j.ok ? "OK" : "Failed"} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {staff.role !== "VIEWER" && (openReq + privacyOpen > 0) && (
        <p className="mt-6 text-[13px]">
          <Link className="text-accent underline" href="/admin/inbox">Open the support inbox</Link> · <Link className="text-accent underline" href="/admin/privacy">Privacy requests</Link>
        </p>
      )}
    </>
  );
}
