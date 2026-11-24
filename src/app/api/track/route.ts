import { recordSiteVisit } from "@/lib/maintenance";
import { clientIp } from "@/lib/rate-limit";
import { memHit } from "@/lib/mem-limit";
import { trustedCountry } from "@/lib/client-ip";

export const dynamic = "force-dynamic";

const CORS = { "Access-Control-Allow-Origin": "*" };
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);

export async function POST(req: Request) {
  try {
    // In-memory, so a flood of tracking pings never turns into database writes.
    if (memHit(`track:${clientIp(req.headers)}`, 120, 60_000)) return new Response(null, { status: 429, headers: CORS });
    if (Number(req.headers.get("content-length") ?? 0) > 4000) return new Response(null, { status: 413, headers: CORS });
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
        country: trustedCountry((n) => req.headers.get(n)),
      }
    );
  } catch {
    // ignore
  }
  return new Response(null, { status: 204, headers: CORS });
}
