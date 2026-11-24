import Link from "next/link";
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, Mail, ShieldAlert, Wrench } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireStaffPage, ALL_STAFF } from "@/lib/platform";
import { getAnnouncementState, getMaintenanceState, getOutageTest, getSiteVisits, PLATFORM_META_IDS } from "@/lib/maintenance";
import { getIncidentSettings, getOpenIncidents } from "@/lib/incidents";
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
    openIncidents,
    outageTest,
    incidentSettings,
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
    getOpenIncidents(),
    getOutageTest(),
    getIncidentSettings(),
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

  const growthKpis: [string, number, string, string?][] = [
    ["Unique Visitors", visits.total, `${visits.today} today · ${visits.last7d} (7d) · ${visits.last30d} (30d). Each browser counts once a day.`],
    ["Workspaces", workspaces, `${newWs} new this week · ${active7.length} active (7d)`],
    ["People Managed", employees, `${users} user accounts`],
    ["30d Retention", retention30, `${active30.length}/${workspaces} (30d) · ${retention90}% (90d)`, "%"],
  ];

  const usageKpis: [string, number, string][] = [
    ["Quizzes Graded", totalQuizAttempts, `${quizzesPassed} courses passed`],
    ["Checklists Done", checklistsDone, "across all workspaces"],
    ["Emails Sent (30d)", sentEmails30, `${sentEmails90} in 90d · ${sentEmails7} in 7d`],
    ["Open Queue", openReq + privacyOpen, `${openReq} support · ${privacyOpen} privacy`],
  ];

  const hasIncident = openIncidents.length > 0 || outageTest.active;

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" sub="Platform status, site-wide controls, growth analytics, and operational health." />

      {/* 1. Needs Attention / Live Status Strip */}
      <section aria-label="Platform status">
        <div className="grid gap-3 md:grid-cols-3">
          <Link
            href="/admin/status"
            className={`card flex items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/40 ${
              hasIncident ? "border-rose-400/60 bg-rose-500/5" : ""
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${hasIncident ? "border-rose-400/50 bg-rose-500/15 text-rose-600 dark:text-rose-400" : "border-emerald-400/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"}`}>
                {hasIncident ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Incidents &amp; Status</span>
                  <Badge value={hasIncident ? "SUSPENDED" : "ACTIVE"} label={outageTest.active ? "TEST ACTIVE" : openIncidents.length ? `${openIncidents.length} OPEN` : "OPERATIONAL"} />
                </div>
                <p className="mt-0.5 truncate text-xs text-soft">
                  {openIncidents[0]?.name ?? (outageTest.active ? "Outage simulator running" : `In-app gate: ${incidentSettings.overrideMode}`)}
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-soft" />
          </Link>

          <Link
            href="/admin/inbox"
            className={`card flex items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/40 ${
              openReq + privacyOpen > 0 ? "border-amber-400/50 bg-amber-500/5" : ""
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-muted text-soft">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Support &amp; Privacy</span>
                  <Badge value={openReq + privacyOpen > 0 ? "PENDING" : "ACTIVE"} label={openReq + privacyOpen > 0 ? `${openReq + privacyOpen} OPEN` : "CLEAR"} />
                </div>
                <p className="mt-0.5 text-xs text-soft">{openReq} support tickets · {privacyOpen} privacy requests</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-soft" />
          </Link>

          <Link
            href="/admin/email"
            className={`card flex items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/40 ${
              failedEmails > 0 ? "border-rose-400/50 bg-rose-500/5" : ""
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-muted text-soft">
                <Mail className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Email Delivery (7d)</span>
                  <Badge value={failedEmails > 0 ? "SUSPENDED" : "ACTIVE"} label={failedEmails > 0 ? `${failedEmails} FAILED` : "HEALTHY"} />
                </div>
                <p className="mt-0.5 text-xs text-soft">{sentEmails7} delivered · {failedEmails} failed · {locked} locked ws</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-soft" />
          </Link>
        </div>
      </section>

      {/* 2. Site-Wide Controls */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-soft">
          <Wrench className="h-3.5 w-3.5" />
          Site-Wide Controls
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <MaintenancePanel initial={maintenance} canManage={staff.role === "OWNER"} />
          <AnnouncementPanel initial={announcement} canManage={staff.role === "OWNER"} />
        </div>
      </section>

      {/* 3. Platform Metrics */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-soft">
          <Activity className="h-3.5 w-3.5" />
          Growth &amp; Usage
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {growthKpis.map(([l, v, n, sfx], i) => (
            <div key={l} style={{ "--i": i } as React.CSSProperties} className="card anim-fade-up p-4">
              <div className="text-xs text-soft">{l}</div>
              <div className="mono mt-1 text-3xl font-semibold"><CountUp to={v} suffix={sfx ?? ""} /></div>
              <div className="mt-1 text-xs text-soft">{n}</div>
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {usageKpis.map(([l, v, n], i) => (
            <div key={l} style={{ "--i": i + 4 } as React.CSSProperties} className="card anim-fade-up p-4">
              <div className="text-xs text-soft">{l}</div>
              <div className="mono mt-1 text-2xl font-semibold"><CountUp to={v} /></div>
              <div className="mt-1 text-xs text-soft">{n}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Analytics & System Health */}
      <section className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-4">
            <h2 className="mb-3 text-sm font-semibold">Unique Visitors Per Day (Last 14 Days)</h2>
            <StackedBars labels={visits.dailyLabels} series={[{ name: "Visitors", values: visits.dailyCounts }]} />
            {visits.topPaths.length > 0 && (
              <div className="mt-4 border-t border-line pt-3">
                <h3 className="mb-2 text-xs font-semibold text-soft">Top visited pages</h3>
                <div className="grid gap-1.5 text-xs sm:grid-cols-2">
                  {visits.topPaths.map((tp) => (
                    <div key={tp.path} className="flex items-center justify-between rounded border border-line bg-muted/40 px-2.5 py-1">
                      <span className="mono truncate">{tp.path}</span>
                      <span className="mono ml-2 font-semibold">{tp.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card p-4">
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
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-4">
            <h2 className="mb-3 text-sm font-semibold">System Health (Last 7 Days)</h2>
            <dl className="divide-y divide-line text-[13px]">
              {[
                ["Emails sent", sentEmails7, false],
                ["Emails failed", failedEmails, failedEmails > 0],
                ["Workspace webhook / email delivery failures", notifyFails, notifyFails > 0],
                ["Locked workspaces", locked, locked > 0],
              ].map(([l, v, bad]) => (
                <div key={String(l)} className="flex items-center justify-between py-2">
                  <dt className="text-soft">{l}</dt>
                  <dd className={`mono ${bad ? "font-semibold text-rose-600" : ""}`}>{String(v)}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="card p-4">
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
          </div>
        </div>
      </section>
    </div>
  );
}
