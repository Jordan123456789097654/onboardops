import { prisma } from "@/lib/prisma";
import { apiError, authApiKey } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** GET /api/v1/audit?limit=100&cursor=<id>&action=<TYPE>. Scope: audit:read. Newest first. */
export async function GET(req: Request) {
  const auth = await authApiKey(req, { scope: "audit:read" });
  if (auth instanceof Response) return auth;
  const q = new URL(req.url).searchParams;
  const limit = Math.min(500, Math.max(1, Number(q.get("limit")) || 100));
  const cursor = q.get("cursor"), action = q.get("action");
  if (cursor && !(await prisma.auditLog.findFirst({ where: { id: cursor, workspaceId: auth.workspaceId }, select: { id: true } }))) return apiError(400, "invalid_cursor", "Unknown cursor.", auth.requestId);
  const rows = await prisma.auditLog.findMany({ where: { workspaceId: auth.workspaceId, ...(action ? { actionType: action } : {}) }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
  const page = rows.slice(0, limit);
  return Response.json({ data: page.map((r) => ({ id: r.id, time: r.createdAt.toISOString(), actor: r.actorName, action: r.actionType, targetType: r.targetType, targetId: r.targetId, summary: r.summary, hash: r.hash })), nextCursor: rows.length > limit ? page[page.length - 1].id : null, requestId: auth.requestId });
}
