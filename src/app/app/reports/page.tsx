import Link from "next/link";
import { Printer } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, MANAGEMENT_ROLES, requirePagePerm } from "@/lib/rbac";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { EmailReportButton } from "./email-button";
import { HBars, StackedBars } from "@/components/charts";
import { fmtDate } from "@/lib/utils";

export const metadata = { title: "Reports" };

const monthKey = (d: Date) => d.toISOString().slice(0, 7);
function months(n: number) {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) out.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  return out;
}

export default async function Reports({ searchParams }: { searchParams: { range?: string } }) {
  const ctx = await requirePagePerm("reports.view");
  const range = [3, 6, 12].includes(Number(searchParams.range)) ? Number(searchParams.range) : 6;
  const ms = months(range);
  const since = new Date(`${ms[0]}-01T00:00:00Z`);
  const w = ctx.workspaceId;
  const soon = new Date(Date.now() + 30 * 86400000);

  const [cases, done, depts, enrollments, overdue, expiring, incidents, policies] = await Promise.all([
    prisma.infractionCase.findMany({ where: { workspaceId: w, createdAt: { gte: since } }, select: { createdAt: true, employee: { select: { department: { select: { name: true } } } } } }),
    prisma.courseEnrollment.findMany({ where: { workspaceId: w, completedAt: { gte: since } }, select: { completedAt: true } }),
    prisma.department.findMany({ where: { workspaceId: w }, orderBy: { name: "asc" } }),
    prisma.courseEnrollment.findMany({ where: { workspaceId: w, employee: { status: { not: "TERMINATED" } }, course: { isPublished: true } }, select: { status: true, employee: { select: { departmentId: true } } } }),
    prisma.courseEnrollment.findMany({ where: { workspaceId: w, status: { not: "PASSED" }, dueDate: { lt: new Date() }, employee: { status: { not: "TERMINATED" } } }, include: { employee: true, course: true }, orderBy: { dueDate: "asc" }, take: 25 }),
    prisma.courseEnrollment.findMany({ where: { workspaceId: w, status: "PASSED", expiresAt: { gt: new Date(), lte: soon }, employee: { status: { not: "TERMINATED" } } }, include: { employee: true, course: true }, orderBy: { expiresAt: "asc" }, take: 25 }),
    prisma.incidentReport.groupBy({ by: ["type"], where: { workspaceId: w, createdAt: { gte: since } }, _count: true }),
    prisma.policy.count({ where: { workspaceId: w, isPublished: true } }),
  ]);

  const deptNames = Array.from(new Set(cases.map((c) => c.employee.department?.name ?? "No department")));
  const infractionSeries = deptNames.map((name) => ({ name, values: ms.map((m) => cases.filter((c) => monthKey(c.createdAt) === m && (c.employee.department?.name ?? "No department") === name).length) }));
  const completionSeries = [{ name: "Completed courses", values: ms.map((m) => done.filter((d) => d.completedAt && monthKey(d.completedAt) === m).length) }];
  const compliance = [...depts.map((d) => ({ id: d.id as string | null, name: d.name })), { id: null, name: "No department" }].map((d) => {
    const es = enrollments.filter((e) => e.employee.departmentId === d.id);
    return { label: d.name, total: es.length, value: es.length ? Math.round((es.filter((e) => e.status === "PASSED").length / es.length) * 100) : 0 };
  }).filter((d) => d.total > 0);
  const labels = ms.map((m) => new Date(`${m}-01T00:00:00Z`).toLocaleString("en-US", { month: "short", timeZone: "UTC" }));

  return (
    <>
      <PageHeader title="Reports" sub={`Last ${range} months. Infractions and training by department, plus what needs attention.`}>
        <div className="flex rounded-md border border-line bg-muted p-0.5">{[3, 6, 12].map((r) => <Link key={r} href={`/app/reports?range=${r}`} className={`rounded px-2.5 py-1 text-xs ${r === range ? "bg-surface font-medium shadow-sm" : "text-soft"}`}>{r} mo</Link>)}</div>
        <EmailReportButton />
        <Link href="/print/compliance-report" target="_blank" className="btn"><Printer className="h-3.5 w-3.5" />Printable compliance report</Link>
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4"><h2 className="mb-3 text-sm font-semibold">Infractions by department</h2>{cases.length === 0 ? <Empty title="No infractions in this period" /> : <StackedBars labels={labels} series={infractionSeries} />}</section>
        <section className="card p-4"><h2 className="mb-3 text-sm font-semibold">Training completions</h2><StackedBars labels={labels} series={completionSeries} /></section>
        <section className="card p-4"><h2 className="mb-3 text-sm font-semibold">Training compliance by department</h2>{compliance.length === 0 ? <Empty title="No enrollments yet" /> : <HBars rows={compliance.map((c) => ({ label: c.label, value: c.value }))} />}</section>
        <section className="card p-4"><h2 className="mb-3 text-sm font-semibold">Incidents and policies</h2>
          {incidents.length === 0 ? <p className="text-[13px] text-soft">No incident reports in this period.</p> : <HBars suffix="" rows={incidents.map((i) => ({ label: i.type.replace(/_/g, " "), value: Math.min(100, i._count * 20), note: String(i._count) }))} />}
          <p className="mt-4 text-xs text-soft">{policies} published polic{policies === 1 ? "y" : "ies"}. <Link className="text-accent underline" href="/app/policies">See signature status</Link></p></section>
        <section className="card p-4"><h2 className="mb-3 text-sm font-semibold">Overdue training</h2>{overdue.length === 0 ? <p className="text-[13px] text-soft">Nothing is overdue.</p> : <ul className="divide-y divide-line">{overdue.map((e) => <li key={e.id} className="flex items-center justify-between gap-2 py-2 text-[13px]"><span><Link href={`/app/employee/${e.employeeId}`} className="font-medium">{e.employee.fullName}</Link> <span className="text-soft">{e.course.title}</span></span><span className="mono text-xs text-rose-600">due {fmtDate(e.dueDate)}</span></li>)}</ul>}</section>
        <section className="card p-4"><h2 className="mb-3 text-sm font-semibold">Certifications expiring in 30 days</h2>{expiring.length === 0 ? <p className="text-[13px] text-soft">None expiring soon.</p> : <ul className="divide-y divide-line">{expiring.map((e) => <li key={e.id} className="flex items-center justify-between gap-2 py-2 text-[13px]"><span><Link href={`/app/employee/${e.employeeId}`} className="font-medium">{e.employee.fullName}</Link> <span className="text-soft">{e.course.title}</span></span><Badge value="PENDING" label={`expires ${fmtDate(e.expiresAt)}`} /></li>)}</ul>}</section>
      </div>
    </>
  );
}
