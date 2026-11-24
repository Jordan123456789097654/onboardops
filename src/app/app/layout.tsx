import { redirect } from "next/navigation";
import { getActiveMembership, listMemberships, unauthPath } from "@/lib/auth";
import { visibleTo, hasFeature, mfaBlocked } from "@/lib/rbac";
import { can } from "@/lib/perms";
import { resolvePlatformRole } from "@/lib/platform-role";
import { Shell, type NavItem } from "@/components/shell";
import { prisma } from "@/lib/prisma";
import { LockedScreen } from "@/components/locked-screen";
import { SupportBanner } from "@/components/support-banner";
import { KeyLockedScreen } from "@/components/key-locked-screen";
import { isWorkspaceLocked } from "@/lib/cmk";
import { workspaceLogoUrl } from "@/lib/logo";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const m = await getActiveMembership();
  if (!m) redirect(await unauthPath());
  if (mfaBlocked(m)) redirect("/account?need2fa=1");
  if (await isWorkspaceLocked(m.workspace)) return <KeyLockedScreen workspace={m.workspace.name} isOwner={m.role === "OWNER" && !m.support} />;
  if (m.workspace.suspendedAt && !m.support) return <LockedScreen workspace={m.workspace.name} reason={m.workspace.suspendedReason} canExport={m.role === "OWNER" || m.role === "ADMIN"} />;
  if (m.role === "EMPLOYEE" && m.profile?.status === "TERMINATED") return <LockedScreen workspace={m.workspace.name} title="Your access has ended" message={`Your employee record at ${m.workspace.name} is closed, so you can no longer sign in to this workplace.`} reason="" canExport={false} />;
  const memberships = m.support ? [] : await listMemberships();
  const v = visibleTo(m.role);
  const [notes, unread] = await Promise.all([
    prisma.notification.findMany({ where: { memberId: m.id }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.notification.count({ where: { memberId: m.id, readAt: null } }),
  ]);
  const nav: NavItem[] = [];
  const f = (k: string) => hasFeature(m, k);
  const g = (k: string) => can(m, k);
  if (m.role === "EMPLOYEE" && !g("training.build") && !g("incidents.review") && !g("reports.view") && !g("requests.decide") && !g("schedule.manage")) {
    nav.push({ href: "/app/my-portal", label: "My Portal", group: "Me" });
  } else {
    nav.push({ href: "/app/overview", label: "Command Center", group: "Operate" });
    if (m.role !== "EMPLOYEE") nav.push({ href: "/app/directory", label: "Staff Directory", group: "Operate" });
    nav.push({ href: "/app/checklists", label: "Shift Checklists", group: "Operate" });
    if (m.role !== "EMPLOYEE" && f("requests")) nav.push({ href: "/app/requests", label: "Staff Requests", group: "Operate" });
    if (v.manageStaff) nav.push({ href: "/app/access", label: "Staff Accounts", group: "Operate" });
    if (g("roster.view") && f("roster")) nav.push({ href: "/app/roster", label: "Emergency Roster", group: "Operate" });
    if (g("credentials.manage") && f("credentials")) nav.push({ href: "/app/credentials", label: "Credentials", group: "Operate" });
    if (g("schedule.manage") && f("scheduling")) nav.push({ href: "/app/schedule", label: "Schedule", group: "Operate" });
    if (g("timesheets.view") && f("timeClock")) nav.push({ href: "/app/timesheets", label: "Timesheets", group: "Operate" });
    if (g("assets.manage") && f("assets")) nav.push({ href: "/app/assets", label: "Equipment", group: "Operate" });
    if (f("handoff") && m.role !== "EMPLOYEE") nav.push({ href: "/app/handoff", label: "Handoff Notes", group: "Operate" });
    if (g("reports.view")) nav.push({ href: "/app/reports", label: "Reports", group: "Operate" });
    nav.push({ href: "/app/training", label: "Training Academy", group: "Train" });
    nav.push({ href: "/app/training/compliance", label: "Compliance Matrix", group: "Train" });
    if (g("training.build")) nav.push({ href: "/app/training/builder", label: "Course Builder", group: "Train" });
    if (f("templates") && (g("training.build") || v.seeSettings)) nav.push({ href: "/app/templates", label: "Templates Library", group: "Train" });
    if (m.role !== "EMPLOYEE") nav.push({ href: "/app/infractions", label: "Infractions", group: "Discipline" });
    if (f("incidents") && m.role !== "EMPLOYEE") nav.push({ href: "/app/incidents", label: "Incident Reports", group: "Discipline" });
    if (f("policies") && m.role !== "EMPLOYEE") nav.push({ href: "/app/policies", label: "Policies", group: "Discipline" });
    if (v.seeAudit) nav.push({ href: "/app/audit", label: "Audit Log", group: "Discipline" });
    if (v.seeSettings) nav.push({ href: "/app/settings", label: "Settings", group: "Admin" });
    if (m.profile) nav.push({ href: "/app/my-portal", label: "My Portal", group: "Me" });
  }
  if (resolvePlatformRole(m.user)) {
    nav.push({ href: "/admin", label: "Staff Console", group: "Platform" });
  }
  return (
    <>
    {m.support && <SupportBanner workspace={m.workspace.name} until={m.support.expiresAt.toISOString()} />}
    <Shell notifications={{ unread, items: notes.map((n) => ({ id: n.id, title: n.title, body: n.body, href: n.href, read: !!n.readAt, at: n.createdAt.toISOString() })) }} nav={nav} workspaces={m.support ? [{ id: m.workspaceId, name: m.workspace.name }] : memberships.map((x) => ({ id: x.workspaceId, name: x.workspace.name }))} activeWorkspaceId={m.workspaceId} workspaceLogoUrl={workspaceLogoUrl(m.workspace)} userName={m.user.nickname || m.user.name} avatarUrl={m.user.avatarUrl} role={m.role}>
      {children}
    </Shell>
    </>
  );
}
