import { prisma } from "@/lib/prisma";
import { can } from "@/lib/perms";
import { requirePageRoleFeature, STAFF_ROLES, canIssueSeverity } from "@/lib/rbac";
import { featureOn } from "@/lib/features";
import { aiConfigured } from "@/lib/ai/groq";
import { careOpen } from "@/lib/ai/guard";
import { Incidents } from "./incidents";

export const metadata = { title: "Incident Reports" };
export const maxDuration = 60;

export default async function IncidentsPage() {
  const ctx = await requirePageRoleFeature(STAFF_ROLES, "incidents");
  const [rows, employees, members] = await Promise.all([
    prisma.incidentReport.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.employeeProfile.findMany({ where: { workspaceId: ctx.workspaceId, status: { not: "TERMINATED" } }, orderBy: { staffCode: "asc" } }),
    prisma.workspaceMember.findMany({ where: { workspaceId: ctx.workspaceId, role: { in: ["OWNER", "ADMIN", "MANAGER", "SUPERVISOR"] } }, include: { user: true } }),
  ]);
  const aiCare = aiConfigured() && featureOn(ctx.workspace.features, "ai") && featureOn(ctx.workspace.features, "aiPeople") && careOpen();
  return (
    <Incidents
      members={members.map((m) => ({ id: m.id, name: m.user.name }))}
      canManage={can(ctx, "incidents.review")}
      aiCare={aiCare}
      severities={(["VERBAL_WARNING", "WRITTEN_INFRACTION", "STRIKE_POINTS", "SUSPENSION", "TERMINATION"] as const).filter((s) => canIssueSeverity(ctx.role, s)) as string[]}
      employees={employees.map((e) => ({ id: e.id, label: `${e.staffCode} ${e.fullName}` }))}
      rows={rows.map((r) => ({ id: r.id, type: r.type, status: r.status, at: r.occurredAt.toISOString(), filedAt: r.createdAt.toISOString(), location: r.location, description: r.description, by: r.reportedByName, notes: r.reviewerNotes, caseNumber: r.convertedCaseNumber, anonymous: r.anonymous, photos: r.photoFileIds, investigatorId: r.investigatorMemberId ?? "", investigator: r.investigatorName ?? "", due: r.investigationDue?.toISOString().slice(0, 10) ?? "", injury: (r.injury ?? {}) as { bodyPart?: string; treatment?: string; daysAway?: number } }))}
    />
  );
}
