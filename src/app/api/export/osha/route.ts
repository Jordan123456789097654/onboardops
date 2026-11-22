import { prisma } from "@/lib/prisma";
import { requirePerm, AuthzError } from "@/lib/rbac";
import { csvEscape } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Injury log in the column order of OSHA Form 300 (a working export, not a substitute for the official form). */
export async function GET(req: Request) {
  try {
    const ctx = await requirePerm("incidents.review", "incidents");
    const year = Number(new URL(req.url).searchParams.get("year")) || new Date().getFullYear();
    const rows = await prisma.incidentReport.findMany({
      where: { workspaceId: ctx.workspaceId, type: "INJURY", occurredAt: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } },
      orderBy: { occurredAt: "asc" },
    });
    const head = ["Entry", "Date of injury", "Reported by", "Where it happened", "Description", "Body part", "Treatment", "Days away from work", "Status"];
    const lines = [head.join(",")].concat(rows.map((r, i) => {
      const inj = (r.injury ?? {}) as { bodyPart?: string; treatment?: string; daysAway?: number };
      return [i + 1, r.occurredAt.toISOString().slice(0, 10), r.anonymous ? "" : r.reportedByName, r.location, r.description, inj.bodyPart ?? "", inj.treatment ?? "", inj.daysAway ?? 0, r.status].map(csvEscape).join(",");
    }));
    return new Response(lines.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="injury-log-${year}.csv"`, "Cache-Control": "no-store" } });
  } catch (e) {
    return new Response(e instanceof AuthzError ? e.message : "Export failed", { status: e instanceof AuthzError ? 403 : 500 });
  }
}
