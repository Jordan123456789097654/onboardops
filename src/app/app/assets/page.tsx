import { prisma } from "@/lib/prisma";
import { requirePagePerm } from "@/lib/rbac";
import { Assets } from "./assets";

export const metadata = { title: "Equipment" };

export default async function AssetsPage() {
  const ctx = await requirePagePerm("assets.manage", "assets");
  const [assets, employees] = await Promise.all([
    prisma.asset.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: {
        checkouts: {
          where: { inAt: null },
          include: { employee: true },
          orderBy: { outAt: "desc" },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.employeeProfile.findMany({ where: { workspaceId: ctx.workspaceId, status: { not: "TERMINATED" } }, orderBy: { fullName: "asc" } }),
  ]);
  return (
    <Assets
      assets={assets.map((a) => {
        const cur = a.checkouts[0] ?? null;
        return {
          id: a.id,
          name: a.name,
          tag: a.tag,
          category: a.category,
          checkoutId: cur?.id ?? null,
          holder: cur ? `${cur.employee.staffCode} ${cur.employee.fullName}` : null,
          outAt: cur ? cur.outAt.toISOString() : null,
          condition: cur?.condition ?? "",
        };
      })}
      employees={employees.map((e) => ({ id: e.id, label: `${e.staffCode} ${e.fullName}` }))}
    />
  );
}
