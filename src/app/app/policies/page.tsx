import { prisma } from "@/lib/prisma";
import { can } from "@/lib/perms";
import { requirePageRoleFeature, STAFF_ROLES } from "@/lib/rbac";
import { featureOn } from "@/lib/features";
import { aiConfigured } from "@/lib/ai/groq";
import { Policies } from "./policies";

export const metadata = { title: "Policies" };
export const maxDuration = 60;

export default async function PoliciesPage() {
  const ctx = await requirePageRoleFeature(STAFF_ROLES, "policies");
  const [policies, roles, employees] = await Promise.all([
    prisma.policy.findMany({ where: { workspaceId: ctx.workspaceId }, include: { acks: true }, orderBy: { createdAt: "desc" } }),
    prisma.jobRole.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { title: "asc" } }),
    prisma.employeeProfile.findMany({ where: { workspaceId: ctx.workspaceId, status: { not: "TERMINATED" } }, select: { id: true, fullName: true, staffCode: true, jobRoleId: true } }),
  ]);
  const rows = policies.map((p) => {
    const scope = employees.filter((e) => p.appliesToAll || (e.jobRoleId && p.requiredJobRoleIds.includes(e.jobRoleId)));
    const signedIds = new Set(p.acks.filter((a) => a.version === p.version).map((a) => a.employeeId));
    return {
      id: p.id, title: p.title, description: p.description, contentMarkdown: p.contentMarkdown, fileId: p.fileId, externalUrl: p.externalUrl ?? "", fileName: p.fileName, version: p.version, appliesToAll: p.appliesToAll,
      requiredJobRoleIds: p.requiredJobRoleIds, isPublished: p.isPublished,
      total: scope.length, signed: scope.filter((e) => signedIds.has(e.id)).length,
      unsigned: scope.filter((e) => !signedIds.has(e.id)).map((e) => `${e.staffCode} ${e.fullName}`),
    };
  });
  return <Policies rows={rows} roles={roles.map((r) => ({ id: r.id, title: r.title }))} canEdit={can(ctx, "policies.manage")} ai={aiConfigured() && featureOn(ctx.workspace.features, "ai")} />;
}
