import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { verifiedEmails } from "@/lib/user-emails";
import { Brand, ThemeToggle } from "@/components/ui";
import { logoutAction } from "@/actions/auth";
import { Workplaces } from "./workplaces";

export const dynamic = "force-dynamic";
export const metadata = { title: "My workplaces" };

export default async function WorkplacesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const mine = await verifiedEmails(user);
  const [memberships, claimable] = await Promise.all([
    prisma.workspaceMember.findMany({ where: { userId: user.id }, include: { workspace: true, profile: true }, orderBy: { createdAt: "asc" } }),
    mine.length ? prisma.employeeProfile.findMany({ where: { email: { in: mine }, memberId: null, status: { not: "TERMINATED" }, workspace: { suspendedAt: null } }, include: { workspace: true, jobRole: true, department: true } }) : Promise.resolve([]),
  ]);
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-4">
      <div className="flex items-center justify-between"><Link href="/" aria-label="OnboardOps home"><Brand /></Link><div className="flex items-center gap-2"><ThemeToggle /><Link href="/account" className="btn">Account</Link><form action={logoutAction}><button className="btn">Sign out</button></form></div></div>
      <div className="flex-1 py-10">
        <h1 className="text-2xl font-semibold">Workplaces I&apos;m employed in</h1>
        <p className="mt-1 text-[13px] text-soft">Signed in as {user.name} ({user.email}).</p>
        <Workplaces
          verified={!!user.emailVerifiedAt}
          mine={memberships.map((m) => ({ id: m.workspaceId, name: m.workspace.name, role: m.role, staffCode: m.profile?.staffCode ?? null, locked: !!m.workspace.suspendedAt, domain: m.workspace.customDomain && m.workspace.domainStatus === "VERIFIED" ? m.workspace.customDomain : null, slug: m.workspace.slug }))}
          claimable={claimable.map((c) => ({ id: c.id, workspace: c.workspace.name, staffCode: c.staffCode, role: c.jobRole?.title ?? null, department: c.department?.name ?? null }))}
        />
        <p className="mt-10 text-[13px] text-soft">Setting up a company yourself? <Link className="text-accent underline" href="/register">Create a workspace</Link>. Don&apos;t see your employer? Ask them to add you with <b>{user.email}</b>, or to send you an invite.</p>
      </div>
    </div>
  );
}
