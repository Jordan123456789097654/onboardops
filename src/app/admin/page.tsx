import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage, ALL_STAFF } from "@/lib/platform";
import { getMaintenanceState, MAINTENANCE_ROW_ID } from "@/lib/maintenance";
import { PageHeader, Badge } from "@/components/ui";
import { CountUp } from "@/components/motion";
import { StackedBars } from "@/components/charts";
import { fmtDateTime } from "@/lib/utils";
import { MaintenancePanel } from "./maintenance-panel";

export const metadata = { title: "Dashboard" };

export default async function AdminHome() {
  const staff = await requireStaffPage(ALL_STAFF);
  const now = Date.now();
  const week = new Date(now - 7 * 86400000);
  const eightWeeks = new Date(now - 56 * 86400000);
  const [workspaces, newWs, users, employees, active, openReq, privacyOpen, failedEmails, notifyFails, jobs, signups, locked, sentEmails, maintenance] = await Promise.all([
    prisma.workspace.count(),
    prisma.workspace.count({ where: { createdAt: { gte: week } } }),
    prisma.user.count(),
    prisma.employeeProfile.count({ where: { status: { not: "TERMINATED" } } }),
    prisma.auditLog.groupBy({ by: ["workspaceId"], where: { createdAt: { gte: week }, actorName: { not: "System" } } }),
    prisma.supportRequest.count({ where: { status: { not: "SOLVED" }, NOT: { topic: "Privacy request" } } }),
    prisma.supportRequest.count({ where: { status: { not: "SOLVED" }, topic: "Privacy request" } }),
    prisma.emailLog.count({ where: { status: "FAILED", createdAt: { gte: week } } }),
    prisma.auditLog.count({ where: { actionType: "NOTIFY_FAILED", createdAt: { gte: week } } }),
    prisma.jobRun.findMany({ where: { id: { not: MAINTENANCE_ROW_ID } }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.workspace.findMany({ where: { createdAt: { gte: eightWeeks } }, select: { createdAt: true } }),
    prisma.workspace.count({ where: { suspendedAt: { not: null } } }),
    prisma.emailLog.count({ where: { status: "SENT", createdAt: { gte: week } } }),
    getMaintenanceState(),
  ]);
  const buckets = Array.from({ length: 8 }, (_, i) => new Date(now - (7 - i) * 7 * 86400000));
  const weekly = buckets.map((start, i) => signups.filter((s) => s.createdAt >= start && (i === 7 || s.createdAt < buckets[i + 1])).length);
  const labels = buckets.map((d) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`);
  const kpis: [string, number, string][] = [["Workspaces", workspaces, `${newWs} new this week`], ["Active this week", active.length, "had real activity"], ["People under management", employees, `${users} user accounts`], ["Open support", openReq, `${privacyOpen} privacy requests open`]];
  return (
    <>
      <PageHeader title="Dashboard" sub="Platform health and usage. Counts only: no customer HR content is shown here." />
      <MaintenancePanel initial={maintenance} canManage={staff.role === "OWNER"} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(([l, v, n], i) => <div key={l} style={{ "--i": i } as React.CSSProperties} className="card anim-fade-up p-4"><div className="text-xs text-soft">{l}</div><div className="mono mt-1 text-3xl font-semibold"><CountUp to={v} /></div><div className="mt-1 text-xs text-soft">{n}</div></div>)}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="card p-4"><h2 className="mb-3 text-sm font-semibold">New workspaces per week</h2><StackedBars labels={labels} series={[{ name: "Signups", values: weekly }]} /></section>
        <section className="card p-4"><h2 className="mb-3 text-sm font-semibold">Health (last 7 days)</h2>
          <dl className="divide-y divide-line text-[13px]">
            {[["Emails sent", sentEmails, false], ["Emails failed", failedEmails, failedEmails > 0], ["Webhook or email delivery failures inside workspaces", notifyFails, notifyFails > 0], ["Locked workspaces", locked, locked > 0]].map(([l, v, bad]) => <div key={String(l)} className="flex items-center justify-between py-2"><dt className="text-soft">{l}</dt><dd className={`mono ${bad ? "text-rose-600" : ""}`}>{String(v)}</dd></div>)}
          </dl>
          <h3 className="mb-1 mt-4 text-xs font-semibold text-soft">Recent job runs</h3>
          {jobs.length === 0 ? <p className="text-[13px] text-soft">No runs recorded yet. The daily reminders job logs here after it runs.</p> : <ul className="space-y-1 text-[13px]">{jobs.map((j) => <li key={j.id} className="flex items-center justify-between gap-2"><span>{j.name} <span className="mono text-xs text-soft">{fmtDateTime(j.createdAt)} · {j.durationMs}ms</span></span><Badge value={j.ok ? "PASSED" : "FAILED"} label={j.ok ? "OK" : "Failed"} /></li>)}</ul>}
        </section>
      </div>
      {staff.role !== "VIEWER" && (openReq + privacyOpen > 0) && <p className="mt-6 text-[13px]"><Link className="text-accent underline" href="/admin/inbox">Open the support inbox</Link> · <Link className="text-accent underline" href="/admin/privacy">Privacy requests</Link></p>}
    </>
  );
}
