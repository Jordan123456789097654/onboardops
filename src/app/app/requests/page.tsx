import { prisma } from "@/lib/prisma";
import { can } from "@/lib/perms";
import { requirePageRole, STAFF_ROLES, MANAGEMENT_ROLES, ADMIN_ROLES, requirePageRoleFeature } from "@/lib/rbac";
import { Requests } from "./requests";

export const metadata = { title: "Staff requests" };

export default async function RequestsPage() {
  const ctx = await requirePageRoleFeature(STAFF_ROLES, "requests");
  const rows = await prisma.staffRequest.findMany({ where: { workspaceId: ctx.workspaceId }, include: { employee: { include: { department: true } } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 200 });
  return (
    <Requests
      canDecide={can(ctx, "requests.decide")}
      isAdmin={ADMIN_ROLES.includes(ctx.role)}
      rows={rows.map((r) => ({ id: r.id, kind: r.kind, status: r.status, employeeId: r.employeeId, employee: `${r.employee.staffCode} ${r.employee.fullName}`, department: r.employee.department?.name ?? null, start: r.startDate?.toISOString() ?? null, end: r.endDate?.toISOString() ?? null, reason: r.reason, by: r.decidedByName, note: r.decisionNote, at: r.createdAt.toISOString(), decidedAt: r.decidedAt?.toISOString() ?? null }))}
    />
  );
}
