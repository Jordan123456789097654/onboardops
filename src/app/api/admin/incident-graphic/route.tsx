import { getStaff, SUPPORT_STAFF } from "@/lib/platform";
import { betterstackConfigured, bsOverview, type BsReport } from "@/lib/betterstack";
import { STYLE_LIST, renderIncidentGraphic, type Style } from "@/lib/incident-graphic";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Staff only. Draws a 1080x1080 status graphic for one incident from Better Stack: an auto-generated incident number, the affected services,
 * when it started and (if over) how long it lasted. The style is chosen from the incident, or forced with ?style=.
 */
export async function GET(req: Request) {
  const staff = await getStaff();
  if (!staff || !SUPPORT_STAFF.includes(staff.role)) return new Response("Forbidden", { status: 403 });
  if (!betterstackConfigured()) return new Response("Better Stack is not connected.", { status: 400 });
  const u = new URL(req.url);
  const id = u.searchParams.get("id") ?? "";
  const s = u.searchParams.get("style") as Style | null;
  let r: BsReport | undefined;
  try { r = (await bsOverview()).reports.find((x) => x.id === id); } catch { return new Response("Could not reach Better Stack.", { status: 502 }); }
  if (!r) return new Response("Incident not found.", { status: 404 });
  const { img, num, style } = renderIncidentGraphic(r, s && STYLE_LIST.includes(s) ? s : null);
  const headers = new Headers(img.headers);
  headers.set("Content-Disposition", `attachment; filename="${num}-${style}.png"`);
  headers.set("Cache-Control", "no-store");
  return new Response(img.body, { headers });
}
