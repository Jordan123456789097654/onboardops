import { prisma } from "@/lib/prisma";
import { clientIp, hit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const day = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 73) { out.push(rest.slice(0, 73)); rest = " " + rest.slice(73); }
  out.push(rest);
  return out.join("\r\n");
}

/** Private calendar feed: /api/calendar/<token>.ics. Subscribe from Google, Apple or Outlook calendar. Shows only this employee's shifts and approved time off. */
export async function GET(req: Request, { params }: { params: { token: string } }) {
  if (await hit(`cal:${clientIp(req.headers)}`, 120, 3600)) return new Response("Too many requests", { status: 429 });
  const token = params.token.replace(/\.ics$/i, "");
  if (!/^[a-f0-9]{40}$/.test(token)) return new Response("Not found", { status: 404 });
  const emp = await prisma.employeeProfile.findUnique({ where: { calendarToken: token }, include: { workspace: { select: { name: true } } } });
  if (!emp || emp.status === "TERMINATED") return new Response("Not found", { status: 404 });
  const [shifts, off] = await Promise.all([
    prisma.shift.findMany({ where: { workspaceId: emp.workspaceId, employeeId: emp.id, endsAt: { gt: new Date(Date.now() - 7 * 86400000) }, startsAt: { lt: new Date(Date.now() + 90 * 86400000) } }, orderBy: { startsAt: "asc" } }),
    prisma.staffRequest.findMany({ where: { employeeId: emp.id, kind: { in: ["TIMEOFF", "LOA"] }, status: "APPROVED", startDate: { not: null } }, take: 100 }),
  ]);
  const now = stamp(new Date());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//OnboardOps//Calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(`${emp.workspace.name} shifts`)}`, "REFRESH-INTERVAL;VALUE=DURATION:PT1H"];
  for (const s of shifts) lines.push("BEGIN:VEVENT", `UID:shift-${s.id}@onboardops.org`, `DTSTAMP:${now}`, `DTSTART:${stamp(s.startsAt)}`, `DTEND:${stamp(s.endsAt)}`, `SUMMARY:${esc(s.label || "Shift")}`, ...(s.notes ? [`DESCRIPTION:${esc(s.notes)}`] : []), "END:VEVENT");
  for (const r of off) {
    const start = r.startDate!;
    const end = new Date((r.endDate ?? r.startDate!).getTime() + 86400000);
    lines.push("BEGIN:VEVENT", `UID:leave-${r.id}@onboardops.org`, `DTSTAMP:${now}`, `DTSTART;VALUE=DATE:${day(start)}`, `DTEND;VALUE=DATE:${day(end)}`, `SUMMARY:${r.kind === "TIMEOFF" ? `Time off${r.subtype ? ` (${r.subtype.toLowerCase()})` : ""}` : "Leave of absence"}`, "TRANSP:TRANSPARENT", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.map(fold).join("\r\n") + "\r\n", { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=300", "Content-Disposition": 'inline; filename="shifts.ics"' } });
}
