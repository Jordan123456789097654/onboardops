import { prisma } from "@/lib/prisma";
import { getOpenIncidents } from "@/lib/incidents";
import { getMaintenanceState } from "@/lib/maintenance";
import { actorFor, authBot, noLink } from "@/lib/staff-bot";

export const dynamic = "force-dynamic";

/** A snapshot for /status in Discord: counts only, no customer data. Any linked staff member can read it. */
export async function GET(req: Request) {
  const a = await authBot(req, { needsUser: true });
  if (!a.ok) return a.res;
  if (!(await actorFor(a.call.discordId!))) return noLink();
  let database = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = false;
  }
  const [openTickets, incidents, maintenance, failedEmails] = await Promise.all([
    prisma.supportRequest.count({ where: { status: { not: "SOLVED" } } }).catch(() => null),
    getOpenIncidents().catch(() => []),
    getMaintenanceState().catch(() => null),
    prisma.emailLog.count({ where: { status: "FAILED", createdAt: { gte: new Date(Date.now() - 3600_000) } } }).catch(() => null),
  ]);
  return Response.json({ database, openTickets, openIncidents: incidents.length, maintenance: !!maintenance?.enabled, failedEmailsLastHour: failedEmails }, { headers: { "Cache-Control": "no-store" } });
}
