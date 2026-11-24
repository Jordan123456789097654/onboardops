import { recordSiteVisit } from "@/lib/maintenance";
import { clientIp, hit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const CORS = { "Access-Control-Allow-Origin": "*" };
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);

export async function POST(req: Request) {
  try {
    if (await hit(`track:${clientIp(req.headers)}`, 120, 60)) return new Response(null, { status: 429, headers: CORS });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    await recordSiteVisit(
      typeof body.path === "string" ? body.path : "/",
      { ip: clientIp(req.headers), ua: req.headers.get("user-agent") ?? "" },
      {
        ref: str(body.ref, 300),
        utmSource: str(body.utm_source, 60),
        utmMedium: str(body.utm_medium, 60),
        utmCampaign: str(body.utm_campaign, 80),
        width: typeof body.w === "number" && body.w > 0 && body.w < 10000 ? body.w : undefined,
        country: req.headers.get("x-vercel-ip-country") ?? undefined,
      }
    );
  } catch {
    // ignore
  }
  return new Response(null, { status: 204, headers: CORS });
}
