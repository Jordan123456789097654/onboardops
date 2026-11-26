import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { currentSessionId, getCurrentUser, getActiveMembership } from "@/lib/auth";
import { Brand, ThemeToggle } from "@/components/ui";
import { backupCodesLeft } from "@/lib/mfa";
import { OAUTH_ERRORS, PROVIDERS, isConfigured, providerLabel } from "@/lib/oauth";
import { Account } from "./account";
import { NotifyPrefs } from "./notify-prefs";
import { DeleteAccountCard, PersonalKeysCard, PreferencesCard } from "./extras";
import { DELETION_GRACE_DAYS } from "@/lib/account-deletion";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account settings", robots: { index: false, follow: false } };

export default async function AccountPage({ searchParams }: { searchParams: { need2fa?: string; oauth?: string; oauth_error?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [extras, m, sessions, sid] = await Promise.all([prisma.userEmail.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }), getActiveMembership(), prisma.userSession.findMany({ where: { userId: user.id, revokedAt: null, createdAt: { gt: new Date(Date.now() - 14 * 86400000) } }, orderBy: { lastSeenAt: "desc" }, take: 10 }), currentSessionId()]);
  const [backupLeft, required] = await Promise.all([user.totpEnabledAt ? backupCodesLeft(user.id) : Promise.resolve(0), prisma.workspaceMember.findFirst({ where: { userId: user.id, workspace: { require2fa: true } }, include: { workspace: { select: { name: true } } } })]);
  const passkeys = await prisma.passkey.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  const linked = await prisma.oAuthAccount.findMany({ where: { userId: user.id } });
  const memberships = await prisma.workspaceMember.findMany({ where: { userId: user.id }, include: { workspace: { select: { name: true } } }, orderBy: { createdAt: "asc" } });
  const personalKeys = await prisma.apiKey.findMany({ where: { revokedAt: null, createdByMemberId: { in: memberships.map((x) => x.id) } }, include: { workspace: { select: { name: true } } }, orderBy: { createdAt: "desc" } });
  const back = m && !m.support ? (m.role === "EMPLOYEE" ? "/app/my-portal" : "/app/overview") : "/workplaces";
  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 py-4">
      <div className="flex items-center justify-between"><Link href="/" aria-label="OnboardOps home"><Brand /></Link><ThemeToggle /></div>
      <div className="py-8">
        <Link href={back} className="inline-flex items-center gap-1 text-[13px] text-soft hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" />Back</Link>
        <h1 className="mt-3 text-2xl font-semibold">Account settings</h1>
        <p className="mt-1 text-[13px] text-soft">Your profile, sign-in details and email addresses. These follow you across every workplace.</p>
        <Account
          me={{ id: user.id, name: user.name, nickname: user.nickname ?? "", email: user.email, verified: !!user.emailVerifiedAt, avatarUrl: user.avatarUrl, hasPassword: !!user.passwordSetAt, createdAt: user.createdAt.toISOString() }}
          sessions={sessions.map((s) => ({ id: s.id, device: s.device, ip: s.ip, at: s.lastSeenAt.toISOString(), current: s.id === sid }))}
          extras={extras.map((e) => ({ id: e.id, email: e.email, verified: !!e.verifiedAt }))}
          mfa={{ enabled: !!user.totpEnabledAt, backupLeft, hasPassword: !!user.passwordSetAt, requiredBy: searchParams.need2fa === "staff" ? "The staff console" : required?.workspace.name ?? null }}
          passkeys={passkeys.map((k) => ({ id: k.id, name: k.name, createdAt: k.createdAt.toISOString().slice(0, 10), lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString().slice(0, 10) : null }))}
          need2fa={searchParams.need2fa === "1" || searchParams.need2fa === "staff"}
          oauth={{ providers: PROVIDERS.map((p) => { const l = linked.find((x) => x.provider === p); return { provider: p, label: providerLabel[p], configured: isConfigured(p), connected: l ? { email: l.email, since: l.createdAt.toISOString() } : null }; }), canUnlink: !!user.passwordSetAt || linked.length > 1, notice: searchParams.oauth, error: searchParams.oauth_error ? OAUTH_ERRORS[searchParams.oauth_error] ?? OAUTH_ERRORS.exchange : undefined }}
        />
        <NotifyPrefs quietStart={user.quietStart ?? null} quietEnd={user.quietEnd ?? null} timezone={user.timezone ?? ""} prefs={(user.emailPrefs ?? {}) as Record<string, boolean>} />
        <PreferencesCard dateFormat={user.dateFormat ?? null} clock24={user.clock24 ?? null} />
        <PersonalKeysCard
          keys={personalKeys.map((k) => ({ id: k.id, name: k.name.replace(/ \(personal\)$/, ""), prefix: k.prefix, workspace: k.workspace.name, scopes: k.scopes, createdAt: k.createdAt.toISOString(), lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null, expiresAt: k.expiresAt ? k.expiresAt.toISOString() : null }))}
          workspaces={memberships.map((x) => ({ id: x.workspaceId, name: x.workspace.name }))}
        />
        <DeleteAccountCard email={user.email} scheduledFor={user.deletionRequestedAt ? new Date(user.deletionRequestedAt.getTime() + DELETION_GRACE_DAYS * 86400000).toISOString().slice(0, 10) : null} />
      </div>
    </div>
  );
}
