import { buildOutageView } from "@/lib/incidents";

export const dynamic = "force-dynamic";

/** Lightweight live outage + Better Stack status feed polled by OutageGate so already-open tabs react immediately. */
export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  const view = await buildOutageView({ forceSync: force });
  return Response.json(view, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
