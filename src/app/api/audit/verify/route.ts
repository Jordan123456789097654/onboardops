import { requireWorkspaceRole, ADMIN_ROLES, AuthzError } from "@/lib/rbac";
import { verifyAuditChain } from "@/lib/audit-verify";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    return Response.json(await verifyAuditChain(ctx.workspaceId), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return Response.json({ error: e instanceof AuthzError ? e.message : "Verification failed" }, { status: e instanceof AuthzError ? 403 : 500 });
  }
}
