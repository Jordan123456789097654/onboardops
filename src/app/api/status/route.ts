import { checkAllServices } from "@/lib/status";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = await checkAllServices();
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
