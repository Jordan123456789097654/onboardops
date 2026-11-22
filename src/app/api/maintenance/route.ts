import { getMaintenanceState } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

/** Is the site still in maintenance mode? The maintenance screen polls this and reloads when it turns off. */
export async function GET() {
  const m = await getMaintenanceState().catch(() => null);
  return Response.json({ enabled: m ? m.enabled : true }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
