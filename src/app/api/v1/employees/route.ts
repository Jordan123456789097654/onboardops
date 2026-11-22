import { prisma } from "@/lib/prisma";
import { authApiKey } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** GET /api/v1/employees?status=ACTIVE&limit=100&cursor=<id>. Read-only. No confidential HR data is exposed. */
export async function GET(req: Request) {
  const auth = await authApiKey(req);
  if (auth instanceof Response) return auth;
  const q = new URL(req.url).searchParams;
  const limit = Math.min(200, Math.max(1, Number(q.get("limit")) || 100));
  const status = q.get("status");
  const cursor = q.get("cursor");
  const rows = await prisma.employeeProfile.findMany({
    where: { workspaceId: auth.workspaceId, ...(status ? { status: status as never } : {}) },
    include: { department: true, jobRole: true },
    orderBy: { id: "asc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, limit);
  return Response.json({
    data: page.map((e) => ({ id: e.id, staffCode: e.staffCode, fullName: e.fullName, email: e.email, phone: e.phone, status: e.status, readiness: e.readiness, department: e.department?.name ?? null, jobRole: e.jobRole?.title ?? null, hireDate: e.hireDate.toISOString().slice(0, 10) })),
    nextCursor: rows.length > limit ? page[page.length - 1].id : null,
  });
}
