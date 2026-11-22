import { checkAllServices } from "@/lib/status";
import { maybeReconcile } from "@/lib/betterstack";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = await checkAllServices();
  await Promise.race([maybeReconcile(), new Promise((res) => setTimeout(res, 6000))]);
  return Response.json(report, {
    status: report.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "Access-Control-Allow-Origin": "*" },
  });
}

export async function HEAD() {
  const report = await checkAllServices();
  return new Response(null, {
    status: report.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "Access-Control-Allow-Origin": "*" },
  });
}
