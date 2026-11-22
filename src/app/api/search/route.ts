import { prisma } from "@/lib/prisma";
import { requireWorkspaceRole, STAFF_ROLES } from "@/lib/rbac";
import { clientIp, hit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ctx = await requireWorkspaceRole(STAFF_ROLES);
    const wait = await hit(`search:${ctx.id}`, 90, 60);
    if (wait) return Response.json({ results: [] }, { status: 429, headers: { "Retry-After": String(wait) } });
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
    if (q.length < 2) return Response.json({ results: [] });
    const [emps, cases] = await Promise.all([
      prisma.employeeProfile.findMany({
        where: { workspaceId: ctx.workspaceId, OR: [{ fullName: { contains: q, mode: "insensitive" } }, { staffCode: { contains: q, mode: "insensitive" } }] },
        take: 6,
        orderBy: { fullName: "asc" },
      }),
      prisma.infractionCase.findMany({
        where: { workspaceId: ctx.workspaceId, OR: [{ caseNumber: { contains: q, mode: "insensitive" } }, { policyViolated: { contains: q, mode: "insensitive" } }] },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return Response.json({
      results: [
        ...emps.map((e) => ({ label: `${e.staffCode} ${e.fullName}`, href: `/app/employee/${e.id}`, group: "Employee" })),
        ...cases.map((c) => ({ label: `${c.caseNumber} ${c.policyViolated}`, href: `/app/infractions`, group: "Case" })),
      ],
    });
  } catch {
    return Response.json({ results: [] }, { status: 403 });
  }
}
