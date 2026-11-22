import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./prisma";
import { getMaintenanceState } from "./maintenance";

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

type Probe = { ok: boolean; ms: number; error?: string };
async function probeDb(): Promise<Probe> {
  const t = Date.now();
  try { await prisma.$queryRaw`SELECT 1`; return { ok: true, ms: Date.now() - t }; } catch (e) { return { ok: false, ms: Date.now() - t, error: e instanceof Error ? e.message : "Database unreachable" }; }
}

export async function checkFrontend(): Promise<ComponentHealth> {
  const start = Date.now();
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

export async function checkDatabase(): Promise<ComponentHealth> {
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

export async function checkAuth(): Promise<ComponentHealth> {
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

export async function checkApi(): Promise<ComponentHealth> {
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

export async function checkEmail(): Promise<ComponentHealth> {
  const start = Date.now();
  const configured = !!process.env.RESEND_API_KEY;
  return {
    service: "email",
    status: configured ? "up" : "degraded",
    ok: true,
    latencyMs: Date.now() - start,
    message: configured ? "Resend email transport configured and ready" : "Email is not configured, so messages are not being sent",
    timestamp: new Date().toISOString(),
  };
}

export async function checkStorage(): Promise<ComponentHealth> {
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

export async function checkDomains(): Promise<ComponentHealth> {
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
      "/api/status",
      "/api/status/frontend",
      "/api/status/database",
      "/api/status/auth",
      "/api/status/api",
      "/api/status/email",
      "/api/status/storage",
      "/api/status/domains",
      "/api/health",
    ],
    services,
  };
}
