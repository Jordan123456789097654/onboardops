import { prisma } from "@/lib/prisma";
import { can } from "@/lib/perms";
import { requirePageRole, STAFF_ROLES, MANAGEMENT_ROLES } from "@/lib/rbac";
import { Checklists } from "./checklists";

export const metadata = { title: "Shift Checklists" };

export default async function ChecklistsPage() {
  const ctx = await requirePageRole(STAFF_ROLES);
  const [templates, subs, departments] = await Promise.all([
    prisma.shiftChecklistTemplate.findMany({ where: { workspaceId: ctx.workspaceId }, include: { department: true }, orderBy: { title: "asc" } }),
    prisma.shiftChecklistSubmission.findMany({ where: { workspaceId: ctx.workspaceId }, include: { template: true, employee: true, photos: true }, orderBy: { submittedAt: "desc" }, take: 50 }),
    prisma.department.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { name: "asc" } }),
  ]);
  return (
    <Checklists
      canEdit={can(ctx, "checklists.manage")}
      departments={departments.map((d) => ({ id: d.id, name: d.name }))}
      templates={templates.map((t) => ({ id: t.id, title: t.title, shiftType: t.shiftType, departmentId: t.departmentId ?? "", scheduleDays: t.scheduleDays, dueTime: t.dueTime ?? "", department: t.department?.name ?? "All departments", items: t.items as { id: string; label: string; required: boolean }[] }))}
      submissions={subs.map((s) => {
        const items = s.template.items as { id: string; label: string; required: boolean }[];
        const done = s.completedItems as string[];
        return { id: s.id, title: s.template.title, by: `${s.employee.staffCode} ${s.employee.fullName}`, at: s.submittedAt.toISOString(), done: done.length, total: items.length, notes: s.handoffNotes, verifiedBy: s.verifiedByName, photos: s.photos.map((p) => ({ id: p.id, fileId: p.fileId, caption: p.caption })) };
      })}
    />
  );
}
