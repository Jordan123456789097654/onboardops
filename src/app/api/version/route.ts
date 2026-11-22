import { latestHighlight } from "@/lib/changelog";

export const dynamic = "force-dynamic";

/** The deployment serving this request, and a one-line note about its newest release. Open tabs compare the id with the one they loaded. */
export async function GET() {
  return Response.json({ id: process.env.NEXT_PUBLIC_BUILD_ID ?? "local", whatsNew: latestHighlight() }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
