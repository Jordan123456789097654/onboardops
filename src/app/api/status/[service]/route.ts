import { checkApi, checkAuth, checkDatabase, checkDomains, checkEmail, checkFrontend, checkStorage, type ComponentHealth } from "@/lib/status";

export const dynamic = "force-dynamic";

const CHECKERS: Record<string, () => Promise<ComponentHealth>> = {
  frontend: checkFrontend,
  web: checkFrontend,
  app: checkFrontend,
  database: checkDatabase,
  db: checkDatabase,
  postgres: checkDatabase,
  auth: checkAuth,
  login: checkAuth,
  api: checkApi,
  backend: checkApi,
  email: checkEmail,
  mail: checkEmail,
  storage: checkStorage,
  files: checkStorage,
  domains: checkDomains,
};

export async function GET(_req: Request, { params }: { params: { service: string } }) {
  const key = (params.service || "").toLowerCase();
  const checker = CHECKERS[key];
  if (!checker) {
    return Response.json(
      { ok: false, status: "unknown", error: `Unknown service "${key}". Available: ${Object.keys(CHECKERS).join(", ")}` },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }
  const res = await checker();
  return Response.json(res, {
    status: res.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "Access-Control-Allow-Origin": "*" },
  });
}

export async function HEAD(_req: Request, { params }: { params: { service: string } }) {
  const key = (params.service || "").toLowerCase();
  const checker = CHECKERS[key];
  if (!checker) return new Response(null, { status: 404 });
  const res = await checker();
  return new Response(null, {
    status: res.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "Access-Control-Allow-Origin": "*" },
  });
}
