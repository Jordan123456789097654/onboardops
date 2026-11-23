import { recordSiteVisit } from "@/lib/maintenance";
import { clientIp, hit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const CORS = { "Access-Control-Allow-Origin": "*" };

export async function POST(req: Request) {
  try {
    if (await hit(`track:${clientIp(req.headers)}`, 120, 60)) return new Response(null, { status: 429, headers: CORS });
    const body = (await req.json().catch(() => ({}))) as { path?: string };
    await recordSiteVisit(typeof body.path === "string" ? body.path : "/");
  } catch {
    // ignore
  }
  return new Response(null, { status: 204, headers: CORS });
}
