import { prisma } from "@/lib/prisma";
import { requireWorkspaceRole, ADMIN_ROLES, AuthzError } from "@/lib/rbac";
import { csvEscape } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    const rows = await prisma.auditLog.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    const lines = [["Time (UTC)", "Actor", "Action", "Target type", "Target id", "Summary", "Hash"].join(",")].concat(rows.map((a) => [a.createdAt.toISOString(), a.actorName, a.actionType, a.targetType, a.targetId, a.summary, a.hash].map(csvEscape).join(",")));
    return new Response(lines.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
  } catch (e) {
    return new Response(e instanceof AuthzError ? e.message : "Export failed", { status: e instanceof AuthzError ? 403 : 500 });
  }
}
