import { getStaff, SUPPORT_STAFF } from "@/lib/platform";
import { verifyStaffAuditChain } from "@/lib/audit-verify";

export const dynamic = "force-dynamic";

export async function GET() {
  const staff = await getStaff();
  if (!staff || !SUPPORT_STAFF.includes(staff.role)) return new Response("Forbidden", { status: 403 });
  return Response.json(await verifyStaffAuditChain(), { headers: { "Cache-Control": "no-store" } });
}
