import Link from "next/link";
import { AlertTriangle, BookOpen, ShieldAlert, UserPlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, STAFF_ROLES, ADMIN_ROLES } from "@/lib/rbac";
import { Badge, PageHeader } from "@/components/ui";
import { Bar, CountUp } from "@/components/motion";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Command Center" };

export default async function Overview() {
  const ctx = await requirePageRole(STAFF_ROLES);
  const w = ctx.workspaceId;
  const [active, onboarding, enrollTotal, enrollPassed, unacked, audit, courses, attention, overdue] = await Promise.all([
    prisma.employeeProfile.count({ where: { workspaceId: w, status: "ACTIVE" } }),
    prisma.employeeProfile.count({ where: { workspaceId: w, status: "ONBOARDING" } }),
    prisma.courseEnrollment.count({ where: { workspaceId: w, employee: { status: { not: "TERMINATED" } } } }),
    prisma.courseEnrollment.count({ where: { workspaceId: w, status: "PASSED", employee: { status: { not: "TERMINATED" } } } }),
    prisma.infractionCase.count({ where: { workspaceId: w, employeeAcknowledged: false } }),
    ADMIN_ROLES.includes(ctx.role) ? prisma.auditLog.findMany({ where: { workspaceId: w }, orderBy: { createdAt: "desc" }, take: 8 }) : Promise.resolve([]),
    prisma.course.findMany({ where: { workspaceId: w, isPublished: true }, include: { enrollments: { select: { status: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.employeeProfile.findMany({ where: { workspaceId: w, OR: [{ readiness: "RETRAINING_REQUIRED" }, { status: "SUSPENDED" }] }, orderBy: { staffCode: "asc" }, take: 6 }),
    prisma.courseEnrollment.count({ where: { workspaceId: w, status: { not: "PASSED" }, dueDate: { lt: new Date() } } }),
  ]);
  const compliance = enrollTotal ? Math.round((enrollPassed / enrollTotal) * 100) : 100;
  const kpis = [
    { label: "Active staff", value: active, suffix: "", href: "/app/directory?status=ACTIVE", note: "currently working" },
    { label: "Pending onboarding", value: onboarding, suffix: "", href: "/app/directory?status=ONBOARDING", note: "not yet certified" },
    { label: "Training compliance", value: compliance, suffix: "%", href: "/app/training/compliance", note: `${overdue} overdue` },
    { label: "Unacknowledged infractions", value: unacked, suffix: "", href: "/app/infractions", note: "awaiting signature" },
  ];
  const actions = [
    { href: "/app/directory?add=1", label: "Add employee", Icon: UserPlus },
    { href: "/app/infractions?log=1", label: "Log infraction", Icon: ShieldAlert },
    { href: "/app/training", label: "Assign training", Icon: BookOpen },
  ];
  return (
    <>
      <PageHeader title="Command Center" sub={ctx.workspace.name}>
        {actions.map(({ href, label, Icon }, i) => <Link key={href} href={href} className={i === 0 ? "btn-primary" : "btn"}><Icon className="h-3.5 w-3.5" />{label}</Link>)}
      </PageHeader>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k, i) => (
          <Link key={k.label} href={k.href} style={{ "--i": i } as React.CSSProperties} className="card lift anim-fade-up block p-4">
            <div className="text-xs text-soft">{k.label}</div>
            <div className="mono mt-1 text-3xl font-semibold"><CountUp to={k.value} suffix={k.suffix} /></div>
            <div className="mt-1 text-xs text-soft">{k.note}</div>
          </Link>
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="card p-4 xl:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Completion by course</h2>
          {courses.length === 0 ? <p className="text-[13px] text-soft">No published courses yet.</p> : (
            <div className="space-y-3">{courses.map((c, ci) => {
              const total = c.enrollments.length;
              const passed = c.enrollments.filter((e) => e.status === "PASSED").length;
              const pct = total ? Math.round((passed / total) * 100) : 0;
              return (
                <div key={c.id}>
                  <div className="mb-1 flex justify-between text-[13px]"><Link href={`/app/training/course/${c.id}`} className="font-medium">{c.title}</Link><span className="mono text-soft">{passed}/{total} · {pct}%</span></div>
                  <Bar pct={pct} index={ci} />
                </div>
              );
            })}</div>
          )}
        </section>
        <section className="card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-amber-600" />Needs attention</h2>
          {attention.length === 0 ? <p className="text-[13px] text-soft">Nobody is flagged right now.</p> : (
            <ul className="divide-y divide-line">{attention.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 py-2 text-[13px]"><Link href={`/app/employee/${e.id}`}><span className="font-medium">{e.fullName}</span> <span className="mono text-xs text-soft">{e.staffCode}</span></Link>{e.status === "SUSPENDED" ? <Badge value="SUSPENDED" /> : <Badge value={e.readiness} />}</li>
            ))}</ul>
          )}
        </section>
      </div>
      {audit.length > 0 && (
        <section className="mt-6">
          <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">Recent activity</h2><Link href="/app/audit" className="text-[13px] text-accent">Full audit log</Link></div>
          <div className="card divide-y divide-line">
            {audit.map((a) => (
              <div key={a.id} className="flex flex-wrap items-baseline gap-x-3 px-3 py-2 text-[13px]">
                <span className="mono w-36 shrink-0 text-xs text-soft">{fmtDateTime(a.createdAt)}</span>
                <span className="min-w-0 flex-1">{a.summary}</span>
                <span className="text-xs text-soft">{a.actorName}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
