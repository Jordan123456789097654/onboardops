import { getMaintenanceState } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

/** Public maintenance status. The lock screen and the notice banner poll this, so the browser can switch on its own. */
export async function GET() {
  const m = await getMaintenanceState().catch(() => null);
  const body = m
    ? { enabled: m.enabled, upcoming: m.upcoming, areas: m.areas, noticeMinutes: m.noticeMinutes, message: m.message, eta: m.eta, startsAt: m.startsAt, endsAt: m.endsAt, now: Date.now() }
    : { enabled: false, upcoming: false, areas: [], noticeMinutes: 60, message: "", eta: null, startsAt: null, endsAt: null, now: Date.now() };
  return Response.json(body, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
