import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage, SUPPORT_STAFF } from "@/lib/platform";
import { PageHeader } from "@/components/ui";
import { ModerationPanel, type AccountRow, type WorkspaceRow, type AppealRow, type CaseRow } from "./panel";
import { fmtDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Moderation" };

export default async function ModerationPage({ searchParams }: { searchParams: { q?: string; status?: string } }) {
  const staff = await requireStaffPage(SUPPORT_STAFF);
  const q = (searchParams.q ?? "").trim().slice(0, 100);
  const status = searchParams.status ?? "";
  const accountWhere = {
    ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" as const } }, { name: { contains: q, mode: "insensitive" as const } }] } : {}),
    ...(status === "banned" ? { bannedAt: { not: null } } : {}),
  };
  const [users, workspaces, appeals, cases] = await Promise.all([
    prisma.user.findMany({ where: accountWhere, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, name: true, email: true, bannedAt: true, banReason: true, lockedUntil: true, createdAt: true } }).catch(() => []),
    prisma.workspace.findMany({ where: status === "suspended" ? { suspendedAt: { not: null } } : q ? { name: { contains: q, mode: "insensitive" } } : {}, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, name: true, slug: true, suspendedAt: true, suspendedReason: true } }).catch(() => []),
    prisma.moderationAppeal.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 50, include: { case: { select: { action: true, reason: true, targetType: true, createdAt: true } } } }).catch(() => []),
    prisma.moderationCase.findMany({ orderBy: { createdAt: "desc" }, take: 50, select: { id: true, action: true, targetType: true, reason: true, actorName: true, createdAt: true } }).catch(() => []),
  ]);
  const accounts: AccountRow[] = users.map((u) => ({ id: u.id, name: u.name, email: u.email, banned: !!u.bannedAt, banReason: u.banReason, createdAt: u.createdAt.toISOString() }));
  const wss: WorkspaceRow[] = workspaces.map((w) => ({ id: w.id, name: w.name, slug: w.slug, suspended: !!w.suspendedAt, reason: w.suspendedReason }));
  const pending: AppealRow[] = appeals.map((a) => ({ id: a.id, email: a.email, message: a.message, createdAt: a.createdAt.toISOString(), action: a.case.action, targetType: a.case.targetType, caseReason: a.case.reason }));
  const log: CaseRow[] = cases.map((c) => ({ id: c.id, action: c.action, targetType: c.targetType, reason: c.reason, actorName: c.actorName, at: fmtDateTime(c.createdAt) }));
  return (
    <>
      <PageHeader title="Moderation" sub="Find an account or workspace, warn, ban or suspend it, and decide appeals. Every action is recorded. Bans and suspensions take effect immediately." />
      <form className="mb-4 flex flex-wrap items-center gap-2" action="/admin/moderation">
        <input className="input !w-72" name="q" defaultValue={q} placeholder="Search by name or email" aria-label="Search accounts and workspaces" />
        <select className="input !w-44" name="status" defaultValue={status} aria-label="Filter">
          <option value="">Everything</option>
          <option value="banned">Banned accounts</option>
          <option value="suspended">Suspended workspaces</option>
        </select>
        <button className="btn">Search</button>
        <Link className="text-[12px] text-accent underline" href="/admin/moderation">Clear</Link>
      </form>
      <ModerationPanel canBan={staff.role === "OWNER"} accounts={accounts} workspaces={wss} appeals={pending} log={log} />
    </>
  );
}
