import { subdomainsEnabled } from "@/lib/subdomain";
import { ZONE } from "@/lib/spaceship-dns";
import { hasSmsConfig } from "@/lib/sms";
import { getStrikeDecayDays, getWorkspaceBranding } from "@/lib/workspace-meta";
import { prisma } from "@/lib/prisma";
import { requirePageRole, ADMIN_ROLES } from "@/lib/rbac";
import { Settings } from "./settings";
import { vercelConfigured, type DomainDetails } from "@/lib/vercel-domains";
import { SITE } from "@/lib/site";
import { featureOn } from "@/lib/features";
import { aiConfigured } from "@/lib/ai/groq";
import { cmkState } from "@/lib/cmk";
import { SSO_ERRORS, ssoRedirectUri } from "@/lib/sso";

export const metadata = { title: "Settings" };
export const maxDuration = 60;

export default async function SettingsPage({ searchParams }: { searchParams: { sso?: string; sso_error?: string } }) {
  const ctx = await requirePageRole(ADMIN_ROLES);
  const customRoles = await prisma.customRole.findMany({ where: { workspaceId: ctx.workspaceId }, include: { _count: { select: { members: true } } }, orderBy: { name: "asc" } });
  const [departments, roles, courses, members] = await Promise.all([
    prisma.department.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { name: "asc" } }),
    prisma.jobRole.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { title: "asc" } }),
    prisma.course.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { title: "asc" }, select: { id: true, title: true, category: true } }),
    prisma.workspaceMember.findMany({ where: { workspaceId: ctx.workspaceId }, include: { user: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const w = ctx.workspace;
  const [apiKeys, locs] = await Promise.all([
    prisma.apiKey.findMany({ where: { workspaceId: ctx.workspaceId, revokedAt: null }, orderBy: { createdAt: "desc" } }),
    prisma.location.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { name: "asc" } }),
  ]);
  const cmk = await cmkState(ctx.workspaceId);
  const sso = await prisma.workspaceSso.findUnique({ where: { workspaceId: ctx.workspaceId } });
  const cf = await prisma.customField.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { orderIndex: "asc" } });
  return (
    <Settings
      isOwner={ctx.role === "OWNER"}
      encryption={{ state: cmk.state === "ACTIVE" ? "ACTIVE" : "MANAGED", version: cmk.state === "MANAGED" ? 0 : cmk.version, fingerprint: cmk.state === "MANAGED" ? "" : cmk.fingerprint, addedAt: cmk.state === "MANAGED" ? null : cmk.addedAt.toISOString(), rotatedAt: cmk.state === "MANAGED" ? null : cmk.rotatedAt?.toISOString() ?? null, needs: { password: !!ctx.user.passwordSetAt, code: !!ctx.user.totpEnabledAt } }}
      sso={{ config: sso ? { provider: sso.provider as "google" | "entra", clientId: sso.clientId, tenantId: sso.tenantId ?? "", domains: sso.domains, enabled: sso.enabled, enforce: sso.enforce, testedAt: sso.testedAt?.toISOString() ?? null } : null, redirectUri: ssoRedirectUri(), workspaceId: ctx.workspaceId, needs: { password: !!ctx.user.passwordSetAt, code: !!ctx.user.totpEnabledAt }, notice: searchParams.sso, error: searchParams.sso_error ? SSO_ERRORS[searchParams.sso_error] ?? SSO_ERRORS.exchange : undefined }}
      mfa={{ required: w.require2fa, ownerHasMfa: !!ctx.user.totpEnabledAt, members: members.map((m) => ({ id: m.id, name: m.user.name, email: m.user.email, role: m.role, enabled: !!m.user.totpEnabledAt, isSelf: m.userId === ctx.userId })) }}
      domain={{ address: { enabled: subdomainsEnabled(), slug: w.subdomain ?? "", status: w.subdomainStatus, zone: ZONE, isOwner: ctx.role === "OWNER" }, slug: w.slug, baseUrl: SITE.url, name: w.customDomain, status: w.domainStatus, details: (w.domainDetails as DomainDetails | null) ?? null, vercel: vercelConfigured() }}
      ws={{ publicCerts: (w.features as Record<string, unknown> | null)?.__publicCerts !== false, decayDays: getStrikeDecayDays(w.features), accent: getWorkspaceBranding(w.features).accentColor, tagline: getWorkspaceBranding(w.features).tagline, name: w.name, ops: w.operationsWebhookUrl ?? "", conf: w.confidentialWebhookUrl ?? "", threshold: w.autoSuspendStrikeThreshold, retrain: w.autoRetrainOnWrittenInfraction, reminders: w.remindersEnabled }}
      departments={departments.map((d) => ({ id: d.id, name: d.name, colorCode: d.colorCode }))}
      roles={roles.map((r) => ({ id: r.id, title: r.title, description: r.description, requiredCourseIds: r.requiredCourseIds, pathSequential: r.pathSequential }))}
      courses={courses}
      members={members.map((m) => ({ id: m.id, name: m.user.name, email: m.user.email, role: m.role, customRoleId: m.customRoleId }))}
      customRoles={customRoles.map((r) => ({ id: r.id, name: r.name, description: r.description, baseRole: r.baseRole, members: r._count.members }))}
      integrations={{ keys: apiKeys.map((k) => ({ id: k.id, name: k.name, prefix: k.prefix, createdAt: k.createdAt.toISOString(), lastUsedAt: k.lastUsedAt?.toISOString() ?? null, scopes: k.scopes, expiresAt: k.expiresAt?.toISOString() ?? null })), webhookUrl: w.genericWebhookUrl ?? "", bamboo: { configured: !!(w.bambooSubdomain && w.bambooKeyEnc), subdomain: w.bambooSubdomain ?? "" }, sms: { configured: hasSmsConfig(w), sid: w.smsAccountSid ?? "", from: w.smsFrom ?? "" }, locations: locs.map((l) => ({ id: l.id, name: l.name, address: l.address, timezone: l.timezone })) }}
      customFields={cf.map((f) => ({ id: f.id, label: f.label, type: f.type as "text" | "date" | "select" | "yesno", options: f.options, showToEmployee: f.showToEmployee }))}
      features={(w.features as Record<string, boolean>) ?? {}}
      rolePerms={(w.rolePerms as Record<string, string[]>) ?? {}}
      customRolesOn={featureOn(w.features, "customRoles")}
      ai={aiConfigured() && featureOn(w.features, "ai")}
    />
  );
}
