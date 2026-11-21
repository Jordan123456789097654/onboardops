import { prisma } from "@/lib/prisma";
import { requireStaffPage, SUPPORT_STAFF } from "@/lib/platform";
import { Empty, PageHeader } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Staff activity" };

export default async function Activity({ searchParams }: { searchParams: { q?: string } }) {
  await requireStaffPage(SUPPORT_STAFF);
  const q = searchParams.q?.trim() ?? "";
  const rows = await prisma.staffAudit.findMany({ where: q ? { OR: [{ summary: { contains: q, mode: "insensitive" } }, { staffName: { contains: q, mode: "insensitive" } }, { action: { contains: q, mode: "insensitive" } }] } : {}, orderBy: { createdAt: "desc" }, take: 300 });
  return (
    <>
      <PageHeader title="Staff activity" sub="Every action taken in this console. Append-only, with each entry's hash chained to the one before it." />
      <form className="mb-3"><input name="q" defaultValue={q} className="input !w-72" placeholder="Search staff, action or summary" /></form>
      {rows.length === 0 ? <Empty title="No staff activity yet" /> : (
        <div className="card max-h-[72vh] overflow-auto"><table className="w-full min-w-[860px] border-collapse"><thead><tr>{["Time (UTC)", "Staff", "Action", "Summary", "Hash"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id} className="hover:bg-muted"><td className="td mono whitespace-nowrap text-xs">{fmtDateTime(r.createdAt)}</td><td className="td">{r.staffName}</td><td className="td mono text-xs">{r.action}</td><td className="td">{r.summary}</td><td className="td mono text-xs text-soft">{r.hash.slice(0, 12)}</td></tr>)}</tbody></table></div>
      )}
    </>
  );
}
