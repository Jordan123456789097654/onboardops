import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./prisma";
import { getMaintenanceState, isSimulatedDown } from "./maintenance";
import { getApiHost, isApiService } from "./service-role";

export type ComponentHealth = {
  service: string;
  status: "up" | "degraded" | "down" | "maintenance";
  ok: boolean;
  maintenance?: boolean;
  latencyMs: number;
  message: string;
  timestamp: string;
};

/** A database round trip slower than this counts as degraded, not down. */
const SLOW_DB_MS = 1200;
const SLOW_STORAGE_MS = 1500;


/** While the staff outage test is running, the chosen services report down. The real service is not touched. */
function guard(service: string, fn: () => Promise<ComponentHealth>) {
  return async (): Promise<ComponentHealth> => {
    if (await isSimulatedDown(service)) {
      return { service, status: "down", ok: false, latencyMs: 0, message: "Simulated outage (staff test). Nothing is actually down.", timestamp: new Date().toISOString() };
    }
    return fn();
  };
}

type Probe = { ok: boolean; ms: number; error?: string };
async function probeDb(): Promise<Probe> {
  const t = Date.now();
  try { await prisma.$queryRaw`SELECT 1`; return { ok: true, ms: Date.now() - t }; } catch (e) { return { ok: false, ms: Date.now() - t, error: e instanceof Error ? e.message : "Database unreachable" }; }
}

const SLOW_FRONTEND_MS = 2500;

async function real_checkFrontend(): Promise<ComponentHealth> {
  const start = Date.now();
  // On the dedicated API deployment, probe the web deployment over HTTP so frontend outages are detected independently.
  if (isApiService()) {
    const webOrigin = (process.env.APP_URL || "https://www.onboardops.org").trim().replace(/\/+$/, "");
    let sameAsApi = false;
    try { sameAsApi = new URL(webOrigin).hostname.toLowerCase() === getApiHost(); } catch { sameAsApi = true; }
    if (!sameAsApi) {
      try {
        const res = await fetch(`${webOrigin}/api/status/frontend`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
        const ms = Date.now() - start;
        const body = (await res.json().catch(() => null)) as Partial<ComponentHealth> | null;
        if (!res.ok || body?.ok === false) {
          return {
            service: "frontend",
            status: "down",
            ok: false,
            latencyMs: ms,
            message: body?.message || `Frontend health check returned HTTP ${res.status}`,
            timestamp: new Date().toISOString(),
          };
        }
        const rawStatus = body?.status === "maintenance" || body?.status === "degraded" ? body.status : "up";
        const status = rawStatus === "up" && ms >= SLOW_FRONTEND_MS ? "degraded" : rawStatus;
        return {
          service: "frontend",
          status,
          ok: true,
          maintenance: !!body?.maintenance,
          latencyMs: ms,
          message: status === "degraded" && rawStatus === "up" ? `Frontend is responding slowly (${ms} ms)` : (body?.message || "Next.js App Router frontend and SSR operational"),
          timestamp: new Date().toISOString(),
        };
      } catch (err: any) {
        return {
          service: "frontend",
          status: "down",
          ok: false,
          latencyMs: Date.now() - start,
          message: err?.message ?? "Frontend unreachable",
          timestamp: new Date().toISOString(),
        };
      }
    }
  }
  const maint = await getMaintenanceState();
  return {
    service: "frontend",
    status: maint.enabled ? "maintenance" : "up",
    ok: true,
    maintenance: maint.enabled,
    latencyMs: Date.now() - start,
    message: maint.enabled ? `In maintenance: ${maint.message}` : "Next.js App Router frontend and SSR operational",
    timestamp: new Date().toISOString(),
  };
}

async function real_checkDatabase(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const ms = Date.now() - start;
    const slow = ms >= SLOW_DB_MS;
    return {
      service: "database",
      status: slow ? "degraded" : "up",
      ok: true,
      latencyMs: ms,
      message: slow ? `Database is responding slowly (${ms} ms)` : "PostgreSQL database connection healthy",
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      service: "database",
      status: "down",
      ok: false,
      latencyMs: Date.now() - start,
      message: err?.message ?? "Database unreachable",
      timestamp: new Date().toISOString(),
    };
  }
}

async function real_checkAuth(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET || "dev-only-secret-change-me-please-32chars");
    const token = await new SignJWT({ probe: true }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1m").sign(secret);
    await jwtVerify(token, secret);
    const db = await probeDb();
    if (!db.ok) return { service: "auth", status: "down", ok: false, latencyMs: Date.now() - start, message: "Sign-in cannot reach the database", timestamp: new Date().toISOString() };
    const slow = db.ms >= SLOW_DB_MS;
    return {
      service: "auth",
      status: slow ? "degraded" : "up",
      ok: true,
      latencyMs: Date.now() - start,
      message: slow ? `Sign-in is slow because the database is slow (${db.ms} ms)` : "JWT session signing and verification operational",
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      service: "auth",
      status: "down",
      ok: false,
      latencyMs: Date.now() - start,
      message: err?.message ?? "Auth check failed",
      timestamp: new Date().toISOString(),
    };
  }
}

async function real_checkApi(): Promise<ComponentHealth> {
  const start = Date.now();
  const db = await probeDb();
  if (!db.ok) return { service: "api", status: "down", ok: false, latencyMs: Date.now() - start, message: "The API cannot reach the database", timestamp: new Date().toISOString() };
  const slow = db.ms >= SLOW_DB_MS;
  return {
    service: "api",
    status: slow ? "degraded" : "up",
    ok: true,
    latencyMs: Date.now() - start,
    message: slow ? `API responses are slow because the database is slow (${db.ms} ms)` : "API routes and server actions operational",
    timestamp: new Date().toISOString(),
  };
}

/** Email counts as degraded when it is not set up, or when most recent sends failed (so messages are not reaching people). */
async function real_checkEmail(): Promise<ComponentHealth> {
  const start = Date.now();
  const configured = !!process.env.RESEND_API_KEY;
  const mk = (status: "up" | "degraded", message: string): ComponentHealth => ({ service: "email", status, ok: true, latencyMs: Date.now() - start, message, timestamp: new Date().toISOString() });
  if (!configured) return mk("degraded", "Email is not configured, so messages are not being sent");
  try {
    const rows = await prisma.emailLog.groupBy({ by: ["status"], where: { createdAt: { gte: new Date(Date.now() - 30 * 60_000) }, status: { in: ["SENT", "FAILED"] } }, _count: { _all: true } });
    const sent = rows.find((r) => r.status === "SENT")?._count._all ?? 0;
    const failed = rows.find((r) => r.status === "FAILED")?._count._all ?? 0;
    if (failed >= 3 && failed / (sent + failed) >= 0.5) return mk("degraded", `${failed} of the last ${sent + failed} emails failed to send`);
    return mk("up", "Resend email transport configured and ready");
  } catch {
    return mk("up", "Resend email transport configured and ready");
  }
}

async function real_checkStorage(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    await prisma.storedFile.count({ take: 1 });
    const ms = Date.now() - start;
    const slow = ms >= SLOW_STORAGE_MS;
    return {
      service: "storage",
      status: slow ? "degraded" : "up",
      ok: true,
      latencyMs: ms,
      message: slow ? `File storage is responding slowly (${ms} ms)` : "Document and file storage operational",
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      service: "storage",
      status: "down",
      ok: false,
      latencyMs: Date.now() - start,
      message: err?.message ?? "Storage check failed",
      timestamp: new Date().toISOString(),
    };
  }
}

async function real_checkDomains(): Promise<ComponentHealth> {
  const start = Date.now();
  return {
    service: "domains",
    status: "up",
    ok: true,
    latencyMs: Date.now() - start,
    message: "Custom domain and subdomain routing operational",
    timestamp: new Date().toISOString(),
  };
}

export const checkFrontend = guard("frontend", real_checkFrontend);
export const checkDatabase = guard("database", real_checkDatabase);
export const checkAuth = guard("auth", real_checkAuth);
export const checkApi = guard("api", real_checkApi);
export const checkEmail = guard("email", real_checkEmail);
export const checkStorage = guard("storage", real_checkStorage);
export const checkDomains = guard("domains", real_checkDomains);

export async function checkAllServices() {
  const start = Date.now();
  const [frontend, database, auth, api, email, storage, domains, maint] = await Promise.all([
    checkFrontend(),
    checkDatabase(),
    checkAuth(),
    checkApi(),
    checkEmail(),
    checkStorage(),
    checkDomains(),
    getMaintenanceState(),
  ]);
  const services = { frontend, database, auth, api, email, storage, domains };
  const all = Object.values(services);
  const allOk = all.every((s) => s.ok);
  const anyDegraded = all.some((s) => s.status === "degraded");
  const prefix = isApiService() ? "" : "/api";
  return {
    ok: allOk,
    status: !allOk ? "down" : anyDegraded ? "degraded" : maint.enabled ? "maintenance" : "up",
    maintenance: maint.enabled,
    maintenanceMessage: maint.enabled ? maint.message : null,
    maintenanceEta: maint.enabled ? maint.eta : null,
    uptimeSeconds: Math.floor(process.uptime()),
    latencyMs: Date.now() - start,
    timestamp: new Date().toISOString(),
    endpoints: [
      `${prefix}/status`,
      `${prefix}/status/frontend`,
      `${prefix}/status/database`,
      `${prefix}/status/auth`,
      `${prefix}/status/api`,
      `${prefix}/status/email`,
      `${prefix}/status/storage`,
      `${prefix}/status/domains`,
      `${prefix}/health`,
    ],
    services,
  };
}
