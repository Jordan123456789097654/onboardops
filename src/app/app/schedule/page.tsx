import { prisma } from "@/lib/prisma";
import { requirePagePerm } from "@/lib/rbac";
import { Schedule } from "./schedule";

export const metadata = { title: "Schedule" };

export default async function SchedulePage() {
  const ctx = await requirePagePerm("schedule.manage", "scheduling");
  const [shifts, employees, departments] = await Promise.all([
    prisma.shift.findMany({ where: { workspaceId: ctx.workspaceId }, include: { employee: true }, orderBy: { startsAt: "asc" }, take: 200 }),
    prisma.employeeProfile.findMany({ where: { workspaceId: ctx.workspaceId, status: { not: "TERMINATED" } }, orderBy: { fullName: "asc" } }),
    prisma.department.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { name: "asc" } }),
  ]);
  const deptMap = Object.fromEntries(departments.map((d) => [d.id, d.name]));
  return (
    <Schedule
      shifts={shifts.map((s) => ({
        id: s.id,
        employee: s.employee ? `${s.employee.staffCode} ${s.employee.fullName}` : "Open shift",
        department: s.departmentId ? deptMap[s.departmentId] ?? null : null,
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
        label: s.label,
        notes: s.notes,
      }))}
      employees={employees.map((e) => ({ id: e.id, label: `${e.staffCode} ${e.fullName}` }))}
      departments={departments.map((d) => ({ id: d.id, name: d.name }))}
    />
  );
}
