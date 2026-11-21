import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage, SUPPORT_STAFF } from "@/lib/platform";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Email log" };

export default async function EmailLogPage({ searchParams }: { searchParams: { status?: string } }) {
  await requireStaffPage(SUPPORT_STAFF);
  const status = ["SENT", "FAILED", "SKIPPED"].includes(searchParams.status ?? "") ? searchParams.status! : "";
  const [rows, counts] = await Promise.all([
    prisma.emailLog.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.emailLog.groupBy({ by: ["status"], where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } }, _count: true }),
  ]);
  const c = Object.fromEntries(counts.map((x) => [x.status, x._count]));
  const redirected = process.env.EMAIL_REDIRECT_TO;
  return (
    <>
      <PageHeader title="Email log" sub={`Last 7 days: ${c.SENT ?? 0} sent, ${c.FAILED ?? 0} failed, ${c.SKIPPED ?? 0} skipped. Message bodies are not stored.`} />
      {redirected && <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">Test mode is on: every email is redirected to <span className="mono">{redirected}</span> (EMAIL_REDIRECT_TO). Unset it in production.</p>}
      <div className="mb-3 flex gap-2">{["", "SENT", "FAILED", "SKIPPED"].map((s) => <Link key={s} href={s ? `/admin/email?status=${s}` : "/admin/email"} className={`btn ${s === status ? "!border-accent text-accent" : ""}`}>{s || "All"}</Link>)}</div>
      {rows.length === 0 ? <Empty title="No emails logged yet" /> : (
        <div className="card max-h-[72vh] overflow-auto"><table className="w-full min-w-[820px] border-collapse"><thead><tr>{["Time (UTC)", "Status", "Kind", "To", "Subject", "Detail"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id} className="hover:bg-muted"><td className="td mono text-xs">{fmtDateTime(r.createdAt)}</td><td className="td"><Badge value={r.status === "SENT" ? "PASSED" : r.status === "FAILED" ? "FAILED" : "LOA"} label={r.status} /></td><td className="td mono text-xs">{r.kind || "—"}</td><td className="td">{r.redirectedFrom ? <><div>{r.to}</div><div className="text-xs text-soft">for {r.redirectedFrom}</div></> : r.to}</td><td className="td max-w-xs truncate">{r.subject}</td><td className="td max-w-xs truncate text-xs text-rose-600">{r.error ?? ""}</td></tr>)}</tbody></table></div>
      )}
    </>
  );
}
