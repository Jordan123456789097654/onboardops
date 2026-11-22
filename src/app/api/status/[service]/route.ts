import { maybeReconcile, syncDegraded } from "@/lib/betterstack";
import { checkApi, checkAuth, checkDatabase, checkDomains, checkEmail, checkFrontend, checkStorage } from "@/lib/status";

export const dynamic = "force-dynamic";

const CHECKS = { frontend: checkFrontend, database: checkDatabase, auth: checkAuth, api: checkApi, email: checkEmail, storage: checkStorage, domains: checkDomains } as const;
const HEADERS = { "Cache-Control": "no-store, no-cache, must-revalidate", "Access-Control-Allow-Origin": "*" };

/** One service on its own: 200 when it is healthy, 503 when it is not. Monitors can watch each service separately. */
export async function GET(_req: Request, { params }: { params: { service: string } }) {
  const check = CHECKS[params.service as keyof typeof CHECKS];
  if (!check) return Response.json({ error: "Unknown service", services: Object.keys(CHECKS) }, { status: 404, headers: HEADERS });
  const r = await check();
  // Keep the public status page in step (degraded reports, maintenance). Never let it slow or break the check.
  await Promise.race([Promise.all([syncDegraded(params.service, r), maybeReconcile()]).catch(() => {}), new Promise((res) => setTimeout(res, 6000))]);
  return Response.json({ ...r, service: params.service, timestamp: new Date().toISOString() }, { status: r.ok ? 200 : 503, headers: HEADERS });
}

export async function HEAD(req: Request, ctx: { params: { service: string } }) {
  const res = await GET(req, ctx);
  return new Response(null, { status: res.status, headers: HEADERS });
}
