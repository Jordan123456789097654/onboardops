import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceRole, STAFF_ROLES, AuthzError } from "@/lib/rbac";
import { csvEscape, fmtDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ctx = await requireWorkspaceRole(STAFF_ROLES);
    const sp = new URL(req.url).searchParams;
    const where: Prisma.EmployeeProfileWhereInput = { workspaceId: ctx.workspaceId };
    const q = sp.get("q");
    if (q) where.OR = [{ fullName: { contains: q, mode: "insensitive" } }, { staffCode: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }];
    if (sp.get("dept")) where.departmentId = sp.get("dept")!;
    if (sp.get("status")) where.status = sp.get("status") as any;
    if (sp.get("readiness")) where.readiness = sp.get("readiness") as any;
    const rows = await prisma.employeeProfile.findMany({ where, include: { department: true, jobRole: true }, orderBy: { staffCode: "asc" } });
    const header = ["Staff ID", "Name", "Email", "Phone", "Department", "Job role", "Status", "Readiness", "Strike points", "Hire date"];
    const lines = [header.join(",")].concat(
      rows.map((e) => [e.staffCode, e.fullName, e.email, e.phone, e.department?.name, e.jobRole?.title, e.status, e.readiness, e.strikePoints, fmtDate(e.hireDate)].map(csvEscape).join(","))
    );
    return new Response(lines.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="staff-${fmtDate(new Date())}.csv"` } });
  } catch (e) {
    if (e instanceof AuthzError) return new Response(e.message, { status: 403 });
    return new Response("Export failed", { status: 500 });
  }
}
