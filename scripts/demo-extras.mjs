// Adds fake demo data for newer features to the seeded Northside workspace, so marketing screenshots show them.
// LOCAL DEMO DATABASE ONLY. Usage: node scripts/demo-extras.mjs
import { PrismaClient } from "@prisma/client";

if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) {
  console.error("Refusing to run: DATABASE_URL is not a local database.");
  process.exit(1);
}
const prisma = new PrismaClient();
const dana = await prisma.user.findUnique({ where: { email: "dana@northside.example" }, include: { memberships: true } });
const wsId = dana.memberships[0].workspaceId;
const ws = await prisma.workspace.findUnique({ where: { id: wsId } });
await prisma.workspace.update({ where: { id: wsId }, data: { features: { ...(ws.features ?? {}), scheduling: true, timeClock: true, appeals: true, evidence: true, progressive: true, timeOff: true, recurring: true, caseTemplates: true, safetyLog: true, incidents: true } } });

await prisma.employeeProfile.deleteMany({ where: { workspaceId: wsId, fullName: { contains: "Import Tester" } } });
const emps = await prisma.employeeProfile.findMany({ where: { workspaceId: wsId, status: "ACTIVE" }, orderBy: { staffCode: "asc" }, take: 6 });
const tomas = await prisma.employeeProfile.findFirst({ where: { workspaceId: wsId, email: "tomas@northside.example" } });
await prisma.employeeProfile.updateMany({ where: { workspaceId: wsId }, data: { timeOffAllowance: { VACATION: 10, SICK: 5, PERSONAL: 3 } } });

// Appeal, evidence and employee response on Tomas's newest case
const kase = await prisma.infractionCase.findFirst({ where: { workspaceId: wsId, employeeId: tomas.id }, orderBy: { createdAt: "desc" } });
if (kase && !(await prisma.appeal.count({ where: { caseId: kase.id } }))) {
  await prisma.infractionCase.update({ where: { id: kase.id }, data: { createdAt: new Date() } });
  await prisma.caseAttachment.createMany({ data: [
    { caseId: kase.id, kind: "WITNESS", title: "Statement: Priya Nair (shift supervisor)", statement: "I saw the pallet jack left in the aisle at about 2:10 PM and asked Tomas to move it. He did right away.", authorName: "Marcus Reyes" },
    { caseId: kase.id, kind: "EMPLOYEE_RESPONSE", title: "Employee response", statement: "The aisle was blocked by a delivery that was not mine. I moved the jack as soon as I was asked.", authorName: tomas.fullName },
  ] });
  await prisma.appeal.create({ data: { workspaceId: wsId, caseId: kase.id, filedByName: tomas.fullName, reason: "I believe this should be a verbal warning, because the aisle was blocked by someone else's delivery and I moved it right away." } });
}

// Shifts for this week, one with a pending swap
const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
if (!(await prisma.shift.count({ where: { workspaceId: wsId, startsAt: { gte: monday } } }))) {
  for (let d = 0; d < 5; d++) {
    for (let i = 0; i < Math.min(4, emps.length); i++) {
      const start = new Date(monday); start.setDate(monday.getDate() + d); start.setHours(i % 2 ? 13 : 6, 0, 0, 0);
      const end = new Date(start); end.setHours(start.getHours() + 8);
      await prisma.shift.create({ data: { workspaceId: wsId, employeeId: emps[i].id, startsAt: start, endsAt: end, label: i % 2 ? "Closing Shift" : "Opening Shift", swapStatus: d === 2 && i === 1 ? "PENDING" : null, swapNote: d === 2 && i === 1 ? "Doctor appointment" : "" } });
    }
  }
  const open = new Date(monday); open.setDate(monday.getDate() + 3); open.setHours(9, 0, 0, 0);
  await prisma.shift.create({ data: { workspaceId: wsId, startsAt: open, endsAt: new Date(open.getTime() + 8 * 3600000), label: "Dock Shift" } });
}

// Time off: one approved, two pending on the same days in the same department
await prisma.staffRequest.deleteMany({ where: { workspaceId: wsId, kind: "TIMEOFF" } });
{
  const next = (n) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + n); return d; };
  const base = emps.filter((e) => e.departmentId === tomas.departmentId).slice(0, 3);
  const [a, b, c] = [base[0] ?? emps[0], base[1] ?? emps[1], base[2] ?? emps[2]];
  await prisma.staffRequest.createMany({ data: [
    { workspaceId: wsId, employeeId: a.id, kind: "TIMEOFF", subtype: "VACATION", startDate: next(2), endDate: next(4), reason: "Family trip", status: "APPROVED", decidedByName: "Marcus Reyes", decidedAt: new Date() },
    { workspaceId: wsId, employeeId: b.id, kind: "TIMEOFF", subtype: "VACATION", startDate: next(3), endDate: next(5), reason: "Long weekend", status: "PENDING" },
    { workspaceId: wsId, employeeId: c.id, kind: "TIMEOFF", subtype: "PERSONAL", startDate: next(6), endDate: next(6), reason: "Appointment", status: "PENDING" },
  ] });
}

// Coaching note
if (!(await prisma.coachingNote.count({ where: { employeeId: tomas.id } }))) {
  await prisma.coachingNote.create({ data: { workspaceId: wsId, employeeId: tomas.id, authorName: "Marcus Reyes", note: "Talked through keeping aisles clear. Tomas agreed to flag blocked aisles to the supervisor right away." } });
}
console.log("Demo extras added.");
await prisma.$disconnect();
