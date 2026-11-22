import { latestRelease } from "@/lib/changelog";

export const dynamic = "force-dynamic";

/** The deployment serving this request and a few lines about its newest release. Open tabs compare the id with the one they loaded. */
export async function GET() {
  const r = latestRelease();
  return Response.json({ id: process.env.NEXT_PUBLIC_BUILD_ID ?? "local", version: r.version, whatsNew: r.highlight, bullets: r.bullets, required: r.required }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
