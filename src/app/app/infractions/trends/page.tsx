import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePageRole, MANAGEMENT_ROLES } from "@/lib/rbac";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Case trends" };

function Bars({ title, data }: { title: string; data: [string, number][] }) {
  const max = Math.max(1, ...data.map((d) => d[1]));
  return (
    <section className="card p-4 text-[13px]">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {data.length === 0 ? <p className="text-soft">No data yet.</p> : (
        <div className="space-y-1.5">{data.map(([k, v]) => (
          <div key={k} className="flex items-center gap-2"><span className="w-40 truncate" title={k}>{k}</span><div className="h-2 flex-1 rounded bg-muted"><div className="h-2 rounded bg-accent" style={{ width: `${(v / max) * 100}%` }} /></div><span className="mono w-8 text-right">{v}</span></div>
        ))}</div>
      )}
    </section>
  );
}

const top = (m: Map<string, number>, n = 8): [string, number][] => Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, n);
const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

export default async function Trends() {
  const ctx = await requirePageRole(MANAGEMENT_ROLES);
  const since = new Date(Date.now() - 365 * 86400000);
  const [cases, appeals] = await Promise.all([
    prisma.infractionCase.findMany({ where: { workspaceId: ctx.workspaceId, createdAt: { gte: since } }, include: { employee: { include: { department: true } }, issuedBy: { include: { user: true } } } }),
    prisma.appeal.findMany({ where: { workspaceId: ctx.workspaceId, createdAt: { gte: since } }, select: { status: true } }),
  ]);
  const month = new Map<string, number>(), policy = new Map<string, number>(), dept = new Map<string, number>(), sev = new Map<string, number>(), issuer = new Map<string, number>();
  for (const c of cases) {
    bump(month, c.createdAt.toISOString().slice(0, 7));
    bump(policy, c.policyViolated);
    bump(dept, c.employee.department?.name ?? "No department");
    bump(sev, c.severity.replace(/_/g, " "));
    bump(issuer, c.issuedBy.user.name);
  }
  const months = Array.from(month.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const decided = appeals.filter((a) => a.status !== "OPEN");
  const overturned = decided.filter((a) => a.status === "OVERTURNED").length;
  return (
    <>
      <PageHeader title="Case trends" sub="Last 12 months of infraction cases. Use it to spot policy gaps and uneven enforcement, not to rank people."><Link className="btn" href="/app/infractions">Back to cases</Link></PageHeader>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="card p-3"><div className="text-xs text-soft">Cases</div><div className="mono text-2xl font-semibold">{cases.length}</div></div>
        <div className="card p-3"><div className="text-xs text-soft">Appeals filed</div><div className="mono text-2xl font-semibold">{appeals.length}</div></div>
        <div className="card p-3"><div className="text-xs text-soft">Appeals overturned</div><div className="mono text-2xl font-semibold">{decided.length ? `${Math.round((overturned / decided.length) * 100)}%` : "—"}</div></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Bars title="Cases by month" data={months} />
        <Bars title="By severity" data={top(sev)} />
        <Bars title="Most cited policies" data={top(policy)} />
        <Bars title="By department" data={top(dept)} />
        <Bars title="By issuing manager" data={top(issuer)} />
      </div>
    </>
  );
}
