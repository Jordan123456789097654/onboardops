import { prisma } from "@/lib/prisma";
import { requirePerm, AuthzError } from "@/lib/rbac";
import { csvEscape } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Hours per employee per day for a pay period, as CSV that most payroll tools can import. ?from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function GET(req: Request) {
  try {
    const ctx = await requirePerm("timesheets.view", "timeClock");
    const q = new URL(req.url).searchParams;
    const to = q.get("to") ? new Date(`${q.get("to")}T23:59:59Z`) : new Date();
    const from = q.get("from") ? new Date(`${q.get("from")}T00:00:00Z`) : new Date(to.getTime() - 14 * 86400000);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) return new Response("Use dates like 2026-11-01.", { status: 400 });
    const rows = await prisma.timeEntry.findMany({ where: { workspaceId: ctx.workspaceId, clockIn: { gte: from, lte: to }, clockOut: { not: null } }, include: { employee: true }, orderBy: [{ clockIn: "asc" }] });
    const totals = new Map<string, { code: string; name: string; email: string; date: string; ms: number }>();
    for (const r of rows) {
      const date = r.clockIn.toISOString().slice(0, 10);
      const k = `${r.employeeId}|${date}`;
      const t = totals.get(k) ?? { code: r.employee.staffCode, name: r.employee.fullName, email: r.employee.email, date, ms: 0 };
      t.ms += r.clockOut!.getTime() - r.clockIn.getTime();
      totals.set(k, t);
    }
    const lines = [["Staff ID", "Name", "Email", "Date", "Hours"].join(",")].concat(Array.from(totals.values()).map((t) => [t.code, t.name, t.email, t.date, (t.ms / 3600000).toFixed(2)].map(csvEscape).join(",")));
    return new Response(lines.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="payroll-hours-${from.toISOString().slice(0, 10)}-to-${to.toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
  } catch (e) {
    return new Response(e instanceof AuthzError ? e.message : "Export failed", { status: e instanceof AuthzError ? 403 : 500 });
  }
}
