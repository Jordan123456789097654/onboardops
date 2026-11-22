import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePageRole, ADMIN_ROLES } from "@/lib/rbac";
import { Empty, PageHeader } from "@/components/ui";
import { AuditTools } from "./audit-tools";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Audit Log" };
const PAGE = 100;

export default async function Audit({ searchParams }: { searchParams: { q?: string; type?: string; page?: string } }) {
  const ctx = await requirePageRole(ADMIN_ROLES);
  const { q = "", type = "" } = searchParams;
  const page = Math.max(0, Number(searchParams.page ?? 0) || 0);
  const where: Prisma.AuditLogWhereInput = { workspaceId: ctx.workspaceId };
  if (q) where.OR = [{ summary: { contains: q, mode: "insensitive" } }, { actorName: { contains: q, mode: "insensitive" } }, { targetId: { contains: q } }];
  if (type) where.actionType = type;
  const [rows, total, types] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: PAGE, skip: page * PAGE }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where: { workspaceId: ctx.workspaceId }, distinct: ["actionType"], select: { actionType: true }, orderBy: { actionType: "asc" } }),
  ]);
  const qs = (p: number) => new URLSearchParams({ q, type, page: String(p) }).toString();
  return (
    <>
      <PageHeader title="Audit Log" sub={`${total} entries. Append-only: no edit or delete exists. Each hash chains over the previous entry.`} />
      <AuditTools />
      <form className="mb-3 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} className="input !w-64" placeholder="Search summary, actor or target ID" />
        <select name="type" defaultValue={type} className="input !w-56"><option value="">All actions</option>{types.map((t) => <option key={t.actionType}>{t.actionType}</option>)}</select>
        <button className="btn">Filter</button>
      </form>
      {rows.length === 0 ? <Empty title="No entries match" /> : (
        <div className="card max-h-[72vh] overflow-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead><tr>{["Time (UTC)", "Actor", "Action", "Summary", "Hash"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>{rows.map((a) => (
              <tr key={a.id} className="hover:bg-muted"><td className="td mono whitespace-nowrap text-xs">{fmtDateTime(a.createdAt)}</td><td className="td">{a.actorName}</td><td className="td mono text-xs">{a.actionType}</td><td className="td">{a.summary}</td><td className="td mono text-xs text-soft">{a.hash.slice(0, 12)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <div className="mt-3 flex gap-2">
        {page > 0 && <Link className="btn" href={`/app/audit?${qs(page - 1)}`}>Newer</Link>}
        {(page + 1) * PAGE < total && <Link className="btn" href={`/app/audit?${qs(page + 1)}`}>Older</Link>}
      </div>
    </>
  );
}
