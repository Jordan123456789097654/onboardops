import { prisma } from "@/lib/prisma";
import { requirePerm, AuthzError } from "@/lib/rbac";
import { csvEscape, fmtDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await requirePerm("roster.view", "roster");
    const rows = await prisma.employeeProfile.findMany({ where: { workspaceId: ctx.workspaceId, status: { in: ["ACTIVE", "ONBOARDING", "LOA", "SUSPENDED"] } }, include: { department: true }, orderBy: { fullName: "asc" } });
    const lines = [["Staff ID", "Name", "Department", "Phone", "Email", "Emergency contact", "Status"].join(",")].concat(rows.map((e) => [e.staffCode, e.fullName, e.department?.name, e.phone, e.email, e.emergencyContact, e.status].map(csvEscape).join(",")));
    return new Response(lines.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="emergency-roster-${fmtDate(new Date())}.csv"`, "Cache-Control": "no-store" } });
  } catch (e) {
    return new Response(e instanceof AuthzError ? e.message : "Export failed", { status: e instanceof AuthzError ? 403 : 500 });
  }
}
