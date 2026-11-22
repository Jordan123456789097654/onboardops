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

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requirePageRole(ADMIN_ROLES);
  const customRoles = await prisma.customRole.findMany({ where: { workspaceId: ctx.workspaceId }, include: { _count: { select: { members: true } } }, orderBy: { name: "asc" } });
  const [departments, roles, courses, members] = await Promise.all([
    prisma.department.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { name: "asc" } }),
    prisma.jobRole.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { title: "asc" } }),
    prisma.course.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
    prisma.workspaceMember.findMany({ where: { workspaceId: ctx.workspaceId }, include: { user: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const w = ctx.workspace;
  const [apiKeys, locs] = await Promise.all([
    prisma.apiKey.findMany({ where: { workspaceId: ctx.workspaceId, revokedAt: null }, orderBy: { createdAt: "desc" } }),
    prisma.location.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { name: "asc" } }),
  ]);
  const cf = await prisma.customField.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { orderIndex: "asc" } });
  return (
    <Settings
      isOwner={ctx.role === "OWNER"}
      domain={{ address: { enabled: subdomainsEnabled(), slug: w.subdomain ?? "", status: w.subdomainStatus, zone: ZONE, isOwner: ctx.role === "OWNER" }, slug: w.slug, baseUrl: SITE.url, name: w.customDomain, status: w.domainStatus, details: (w.domainDetails as DomainDetails | null) ?? null, vercel: vercelConfigured() }}
      ws={{ publicCerts: (w.features as Record<string, unknown> | null)?.__publicCerts !== false, decayDays: getStrikeDecayDays(w.features), accent: getWorkspaceBranding(w.features).accentColor, tagline: getWorkspaceBranding(w.features).tagline, name: w.name, ops: w.operationsWebhookUrl ?? "", conf: w.confidentialWebhookUrl ?? "", threshold: w.autoSuspendStrikeThreshold, retrain: w.autoRetrainOnWrittenInfraction, reminders: w.remindersEnabled }}
      departments={departments.map((d) => ({ id: d.id, name: d.name, colorCode: d.colorCode }))}
      roles={roles.map((r) => ({ id: r.id, title: r.title, description: r.description, requiredCourseIds: r.requiredCourseIds }))}
      courses={courses}
      members={members.map((m) => ({ id: m.id, name: m.user.name, email: m.user.email, role: m.role, customRoleId: m.customRoleId }))}
      customRoles={customRoles.map((r) => ({ id: r.id, name: r.name, description: r.description, baseRole: r.baseRole, members: r._count.members }))}
      integrations={{ keys: apiKeys.map((k) => ({ id: k.id, name: k.name, prefix: k.prefix, createdAt: k.createdAt.toISOString(), lastUsedAt: k.lastUsedAt?.toISOString() ?? null })), webhookUrl: w.genericWebhookUrl ?? "", bamboo: { configured: !!(w.bambooSubdomain && w.bambooKeyEnc), subdomain: w.bambooSubdomain ?? "" }, sms: { configured: hasSmsConfig(w), sid: w.smsAccountSid ?? "", from: w.smsFrom ?? "" }, locations: locs.map((l) => ({ id: l.id, name: l.name, address: l.address, timezone: l.timezone })) }}
      customFields={cf.map((f) => ({ id: f.id, label: f.label, type: f.type as "text" | "date" | "select" | "yesno", options: f.options, showToEmployee: f.showToEmployee }))}
      features={(w.features as Record<string, boolean>) ?? {}}
      rolePerms={(w.rolePerms as Record<string, string[]>) ?? {}}
      customRolesOn={featureOn(w.features, "customRoles")}
    />
  );
}
