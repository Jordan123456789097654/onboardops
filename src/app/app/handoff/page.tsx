import { prisma } from "@/lib/prisma";
import { requirePageRoleFeature, STAFF_ROLES, MANAGEMENT_ROLES } from "@/lib/rbac";
import { HandoffFeed } from "./handoff";

export const metadata = { title: "Handoff Notes" };

export default async function HandoffPage() {
  const ctx = await requirePageRoleFeature(STAFF_ROLES, "handoff");
  const [notes, departments, checklistNotes] = await Promise.all([
    prisma.handoffNote.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.department.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { name: "asc" } }),
    prisma.shiftChecklistSubmission.findMany({
      where: { workspaceId: ctx.workspaceId, NOT: { handoffNotes: "" } },
      include: { template: true, employee: true },
      orderBy: { submittedAt: "desc" },
      take: 30,
    }),
  ]);
  const deptMap = Object.fromEntries(departments.map((d) => [d.id, d.name]));
  return (
    <HandoffFeed
      canManage={MANAGEMENT_ROLES.includes(ctx.role)}
      departments={departments.map((d) => ({ id: d.id, name: d.name }))}
      notes={notes.map((n) => ({
        id: n.id,
        author: n.authorName,
        body: n.body,
        departmentId: n.departmentId,
        department: n.departmentId ? deptMap[n.departmentId] ?? null : null,
        at: n.createdAt.toISOString(),
      }))}
      checklistNotes={checklistNotes.map((c) => ({
        id: c.id,
        author: `${c.employee.staffCode} ${c.employee.fullName}`,
        checklist: c.template.title,
        body: c.handoffNotes,
        at: c.submittedAt.toISOString(),
      }))}
    />
  );
}
