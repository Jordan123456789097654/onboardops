import { prisma } from "@/lib/prisma";
import { getStaff, staffAudit, SUPPORT_STAFF } from "@/lib/platform";
import { can, getSupportConfig } from "@/lib/support-config";
import { refOf } from "@/lib/support";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Spreadsheet programs run cells that start with = + - @ as formulas, so those get a leading apostrophe. */
function cell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

const day = (s: string | null, end = false) => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T${end ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

export async function GET(req: Request) {
  const staff = await getStaff();
  if (!staff || !SUPPORT_STAFF.includes(staff.role)) return new Response("Not found", { status: 404 });
  const cfg = await getSupportConfig();
  if (!can(cfg, staff.role, "export")) return new Response("You don't have permission to export tickets.", { status: 403 });

  const u = new URL(req.url);
  const from = day(u.searchParams.get("from"));
  const to = day(u.searchParams.get("to"), true);
  const rows = await prisma.supportRequest.findMany({
    where: { NOT: { topic: "Privacy request" }, ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) },
    include: { messages: { select: { kind: true, createdAt: true }, orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: 10000,
  });

  const head = ["ref", "created", "status", "priority", "category", "sentiment", "tags", "assignee", "inbox", "source", "topic", "spam", "name", "email", "messages", "first_response_min", "solved_at", "resolution_min", "rating"];
  const lines = [head.map(cell).join(",")];
  for (const r of rows) {
    const firstReply = r.messages.find((m) => m.kind === "REPLY");
    const fr = firstReply ? Math.round((firstReply.createdAt.getTime() - r.createdAt.getTime()) / 60000) : "";
    const rs = r.solvedAt ? Math.round((r.solvedAt.getTime() - r.createdAt.getTime()) / 60000) : "";
    lines.push([refOf(r.id), r.createdAt.toISOString(), r.status, r.priority, r.category, r.sentiment, r.tags.join(" "), r.assignee, r.inbox, r.source, r.topic, r.spam ? "yes" : "", r.name, r.email, r.messages.filter((m) => m.kind !== "NOTE").length, fr, r.solvedAt?.toISOString() ?? "", rs, r.rating ?? ""].map(cell).join(","));
  }
  await staffAudit(prisma, staff, { action: "SUPPORT_EXPORT", targetType: "SupportRequest", targetId: "export", summary: `Exported ${rows.length} support request(s) to CSV${from ? ` from ${u.searchParams.get("from")}` : ""}${to ? ` to ${u.searchParams.get("to")}` : ""}` });
  return new Response(lines.join("\r\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="support-tickets-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" },
  });
}
