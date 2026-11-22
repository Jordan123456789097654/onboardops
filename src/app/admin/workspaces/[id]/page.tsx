import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffPage, ALL_STAFF } from "@/lib/platform";
import { isPartnerWorkspace } from "@/lib/workspace-meta";
import { Badge, PageHeader } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import { WorkspaceActions } from "./actions";

export const metadata = { title: "Workspace" };

export default async function WorkspaceDetail({ params }: { params: { id: string } }) {
  const staff = await requireStaffPage(ALL_STAFF);
  const ws = await prisma.workspace.findUnique({ where: { id: params.id }, include: { members: { include: { user: true }, orderBy: { createdAt: "asc" } }, _count: { select: { employees: true, courses: true, infractions: true, policies: true, incidents: true } } } });
  if (!ws) notFound();
  const [grants, requests, staffLog, emailFails] = await Promise.all([
    prisma.supportAccessGrant.findMany({ where: { workspaceId: ws.id }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.supportRequest.findMany({ where: { workspaceId: ws.id }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.staffAudit.findMany({ where: { workspaceId: ws.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.emailLog.count({ where: { workspaceId: ws.id, status: "FAILED" } }),
  ]);
  const partner = isPartnerWorkspace(ws.features);
  const canSupport = staff.role !== "VIEWER";
  const facts: [string, string | number][] = [["Created", fmtDate(ws.createdAt)], ["Plan", partner ? "PARTNER" : ws.plan], ["Employees", ws._count.employees], ["Courses", ws._count.courses], ["Infraction cases", ws._count.infractions], ["Policies", ws._count.policies], ["Incident reports", ws._count.incidents], ["Failed emails", emailFails]];
  return (
    <>
      <PageHeader title={ws.name} sub={`${ws.slug} · ${ws.members.length} members`}>
        {partner && <Badge value="PASSED" label="Official Partner" />}
        {ws.legalHold && <Badge value="PENDING" label="Legal Hold" />}
        {ws.suspendedAt ? <Badge value="SUSPENDED" label="Locked" /> : <Badge value="ACTIVE" label="Active" />}
      </PageHeader>
      {ws.suspendedAt && <p className="mb-4 rounded-md border border-rose-300 bg-rose-50 p-3 text-[13px] text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">Locked {fmtDateTime(ws.suspendedAt)}. Reason shown to the owner: {ws.suspendedReason}</p>}
      {ws.legalHold && <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">Legal Hold is active{ws.legalHoldReason ? `: ${ws.legalHoldReason}` : ""}. Record deletions and workspace closure are frozen.</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{facts.map(([l, v]) => <div key={l} className="card p-3"><div className="text-xs text-soft">{l}</div><div className="mono mt-0.5 text-lg font-semibold">{v}</div></div>)}</div>
      <WorkspaceActions
        workspaceId={ws.id}
        workspaceName={ws.name}
        workspaceSlug={ws.slug}
        customDomain={ws.customDomain}
        domainStatus={ws.domainStatus}
        partner={partner}
        legalHold={ws.legalHold}
        legalHoldReason={ws.legalHoldReason}
        locked={!!ws.suspendedAt}
        role={staff.role}
        members={ws.members.map((m) => ({ id: m.id, userId: m.userId, name: m.user.name, email: m.user.email, role: m.role, locked: !!(m.user.lockedUntil && m.user.lockedUntil > new Date()) }))}
      />
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="card p-4"><h2 className="mb-2 text-sm font-semibold">Support access history</h2>{grants.length === 0 ? <p className="text-[13px] text-soft">None yet.</p> : <ul className="divide-y divide-line text-[13px]">{grants.map((g) => <li key={g.id} className="py-2"><div className="flex justify-between gap-2"><span className="font-medium">{g.staffName}</span><span className="mono text-xs text-soft">{fmtDateTime(g.createdAt)}</span></div><div className="text-soft">{g.reason}</div><div className="mono text-xs text-soft">{g.endedAt ? `ended ${fmtDateTime(g.endedAt)}` : g.expiresAt > new Date() ? `active until ${fmtDateTime(g.expiresAt)}` : `expired ${fmtDateTime(g.expiresAt)}`}</div></li>)}</ul>}</section>
        <section className="card p-4"><h2 className="mb-2 text-sm font-semibold">Support requests</h2>{requests.length === 0 ? <p className="text-[13px] text-soft">None linked.</p> : <ul className="divide-y divide-line text-[13px]">{requests.map((r) => <li key={r.id} className="flex items-center justify-between gap-2 py-2"><Link className="text-accent" href={`/admin/inbox?open=${r.id}`}>{r.topic}: {r.message.slice(0, 60)}</Link><Badge value={r.status === "SOLVED" ? "PASSED" : "PENDING"} label={r.status} /></li>)}</ul>}</section>
      </div>
      {canSupport && <section className="card mt-4 p-4"><h2 className="mb-2 text-sm font-semibold">Staff activity on this workspace</h2>{staffLog.length === 0 ? <p className="text-[13px] text-soft">None.</p> : <ul className="divide-y divide-line text-[13px]">{staffLog.map((a) => <li key={a.id} className="py-1.5"><span className="mono text-xs text-soft">{fmtDateTime(a.createdAt)}</span> · {a.staffName}: {a.summary}</li>)}</ul>}</section>}
    </>
  );
}
