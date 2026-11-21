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
  return (
    <Settings
      isOwner={ctx.role === "OWNER"}
      domain={{ slug: w.slug, baseUrl: SITE.url, name: w.customDomain, status: w.domainStatus, details: (w.domainDetails as DomainDetails | null) ?? null, vercel: vercelConfigured() }}
      ws={{ name: w.name, ops: w.operationsWebhookUrl ?? "", conf: w.confidentialWebhookUrl ?? "", threshold: w.autoSuspendStrikeThreshold, retrain: w.autoRetrainOnWrittenInfraction, reminders: w.remindersEnabled }}
      departments={departments.map((d) => ({ id: d.id, name: d.name, colorCode: d.colorCode }))}
      roles={roles.map((r) => ({ id: r.id, title: r.title, description: r.description, requiredCourseIds: r.requiredCourseIds }))}
      courses={courses}
      members={members.map((m) => ({ id: m.id, name: m.user.name, email: m.user.email, role: m.role, customRoleId: m.customRoleId }))}
      customRoles={customRoles.map((r) => ({ id: r.id, name: r.name, description: r.description, baseRole: r.baseRole, members: r._count.members }))}
      features={(w.features as Record<string, boolean>) ?? {}}
      rolePerms={(w.rolePerms as Record<string, string[]>) ?? {}}
      customRolesOn={featureOn(w.features, "customRoles")}
    />
  );
}
