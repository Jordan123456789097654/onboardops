import { prisma } from "@/lib/prisma";
import { can } from "@/lib/perms";
import { requirePageRole, STAFF_ROLES, MANAGEMENT_ROLES, canIssueSeverity, requirePageRoleFeature } from "@/lib/rbac";
import { Incidents } from "./incidents";

export const metadata = { title: "Incident Reports" };

export default async function IncidentsPage() {
  const ctx = await requirePageRoleFeature(STAFF_ROLES, "incidents");
  const [rows, employees] = await Promise.all([
    prisma.incidentReport.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.employeeProfile.findMany({ where: { workspaceId: ctx.workspaceId, status: { not: "TERMINATED" } }, orderBy: { staffCode: "asc" } }),
  ]);
  return (
    <Incidents
      canManage={can(ctx, "incidents.review")}
      severities={(["VERBAL_WARNING", "WRITTEN_INFRACTION", "STRIKE_POINTS", "SUSPENSION", "TERMINATION"] as const).filter((s) => canIssueSeverity(ctx.role, s)) as string[]}
      employees={employees.map((e) => ({ id: e.id, label: `${e.staffCode} ${e.fullName}` }))}
      rows={rows.map((r) => ({ id: r.id, type: r.type, status: r.status, at: r.occurredAt.toISOString(), filedAt: r.createdAt.toISOString(), location: r.location, description: r.description, by: r.reportedByName, notes: r.reviewerNotes, caseNumber: r.convertedCaseNumber }))}
    />
  );
}
