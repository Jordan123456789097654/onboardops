import { prisma } from "@/lib/prisma";
import { authApiKey } from "@/lib/api-auth";
import { apiWrite, createShift, maybeBulk } from "@/lib/api-write";

export const dynamic = "force-dynamic";

/** GET /api/v1/shifts?from=2026-11-01&to=2026-11-30. Read-only. */
export async function GET(req: Request) {
  const auth = await authApiKey(req, { scope: "shifts:read" });
  if (auth instanceof Response) return auth;
  const q = new URL(req.url).searchParams;
  const from = q.get("from") ? new Date(`${q.get("from")}T00:00:00Z`) : new Date(Date.now() - 7 * 86400000);
  const to = q.get("to") ? new Date(`${q.get("to")}T23:59:59Z`) : new Date(Date.now() + 30 * 86400000);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return Response.json({ error: "Use dates like 2026-11-01." }, { status: 400 });
  const rows = await prisma.shift.findMany({ where: { workspaceId: auth.workspaceId, startsAt: { gte: from, lte: to } }, include: { employee: true }, orderBy: { startsAt: "asc" }, take: 1000 });
  return Response.json({ data: rows.map((s) => ({ id: s.id, label: s.label, startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString(), employeeId: s.employeeId, staffCode: s.employee?.staffCode ?? null, employeeName: s.employee?.fullName ?? null })) });
}

/** POST /api/v1/shifts. Scope: shifts:write. One object or an array of up to 100. */
export async function POST(req: Request) {
  return apiWrite(req, "shifts:write", (a, body) => maybeBulk(body, (item) => createShift(a, item)), 201);
}
