import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage, ALL_STAFF } from "@/lib/platform";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/utils";

export const metadata = { title: "Workspaces" };

export default async function Workspaces({ searchParams }: { searchParams: { q?: string; locked?: string } }) {
  await requireStaffPage(ALL_STAFF);
  const q = searchParams.q?.trim() ?? "";
  const rows = await prisma.workspace.findMany({
    where: { ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }, { members: { some: { user: { email: { contains: q, mode: "insensitive" } } } } }] } : {}), ...(searchParams.locked === "1" ? { suspendedAt: { not: null } } : {}) },
    include: { members: { where: { role: "OWNER" }, include: { user: true } }, _count: { select: { employees: true, members: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const last = await prisma.auditLog.groupBy({ by: ["workspaceId"], where: { workspaceId: { in: rows.map((r) => r.id) } }, _max: { createdAt: true } });
  const lastBy = new Map(last.map((l) => [l.workspaceId, l._max.createdAt]));
  return (
    <>
      <PageHeader title="Workspaces" sub={`${rows.length} shown. Account details and counts only. Employee data needs support access.`} />
      <form className="mb-3 flex flex-wrap gap-2"><input name="q" defaultValue={q} className="input !w-72" placeholder="Search name, slug or member email" /><label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="locked" value="1" defaultChecked={searchParams.locked === "1"} />Locked only</label><button className="btn">Search</button></form>
      {rows.length === 0 ? <Empty title="No workspaces match" /> : (
        <div className="card max-h-[72vh] overflow-auto"><table className="w-full min-w-[820px] border-collapse"><thead><tr>{["Workspace", "Owner", "Employees", "Members", "Created", "Last activity", "Status"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>{rows.map((w) => (
            <tr key={w.id} className="hover:bg-muted"><td className="td"><Link className="font-medium text-accent" href={`/admin/workspaces/${w.id}`}>{w.name}</Link><div className="mono text-xs text-soft">{w.slug}</div></td>
              <td className="td">{w.members[0]?.user.name ?? "—"}<div className="text-xs text-soft">{w.members[0]?.user.email}</div></td><td className="td mono">{w._count.employees}</td><td className="td mono">{w._count.members}</td><td className="td mono text-xs">{fmtDate(w.createdAt)}</td><td className="td mono text-xs">{lastBy.get(w.id) ? fmtDate(lastBy.get(w.id)) : "—"}</td>
              <td className="td">{w.suspendedAt ? <Badge value="SUSPENDED" label="Locked" /> : <Badge value="ACTIVE" label="Active" />}</td></tr>
          ))}</tbody></table></div>
      )}
    </>
  );
}
