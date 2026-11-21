import { prisma } from "@/lib/prisma";
import { requirePagePerm } from "@/lib/rbac";
import { Credentials } from "./credentials";

export const metadata = { title: "Credentials" };

export default async function CredentialsPage() {
  const ctx = await requirePagePerm("credentials.manage", "credentials");
  const [rows, employees] = await Promise.all([
    prisma.credential.findMany({ where: { workspaceId: ctx.workspaceId }, include: { employee: true }, orderBy: { expiresAt: "asc" } }),
    prisma.employeeProfile.findMany({ where: { workspaceId: ctx.workspaceId, status: { not: "TERMINATED" } }, orderBy: { fullName: "asc" } }),
  ]);
  return (
    <Credentials
      rows={rows.map((c) => ({
        id: c.id,
        employee: `${c.employee.staffCode} ${c.employee.fullName}`,
        name: c.name,
        number: c.number,
        issuer: c.issuer,
        expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
      }))}
      employees={employees.map((e) => ({ id: e.id, label: `${e.staffCode} ${e.fullName}` }))}
    />
  );
}
