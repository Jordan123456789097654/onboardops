import { prisma } from "@/lib/prisma";
import { requirePagePerm } from "@/lib/rbac";
import { Timesheets } from "./timesheets";

export const metadata = { title: "Timesheets" };

export default async function TimesheetsPage() {
  const ctx = await requirePagePerm("timesheets.view", "timeClock");
  const [entries, employees] = await Promise.all([
    prisma.timeEntry.findMany({ where: { workspaceId: ctx.workspaceId }, include: { employee: true }, orderBy: { clockIn: "desc" }, take: 200 }),
    prisma.employeeProfile.findMany({ where: { workspaceId: ctx.workspaceId, status: { not: "TERMINATED" } }, orderBy: { fullName: "asc" } }),
  ]);
  return (
    <Timesheets
      entries={entries.map((e) => ({
        id: e.id,
        employee: `${e.employee.staffCode} ${e.employee.fullName}`,
        clockIn: e.clockIn.toISOString(),
        clockOut: e.clockOut ? e.clockOut.toISOString() : null,
        note: e.note,
      }))}
      employees={employees.map((e) => ({ id: e.id, label: `${e.staffCode} ${e.fullName}` }))}
    />
  );
}
