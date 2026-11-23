/**
 * Edge- and client-safe helpers for splitting OnboardOps across two Vercel projects:
 *  - web (www.onboardops.org, *.onboardops.org, custom domains): SERVICE_ROLE=web (default)
 *  - api (api.onboardops.org): SERVICE_ROLE=api
 *
 * Moved route groups on api.onboardops.org:
 *  - A: Public API v1 (/v1/*)
 *  - B (API probes only): /status, /status/*, /health  (note: /api/status/frontend stays live on web too)
 *  - C: Webhooks & cron (/betterstack/*, /cron/*)
 *  - D (unauthenticated public feeds/media): /calendar/*, /testimonial-photo/*, /track
 */

export const DEFAULT_API_HOST = "api.onboardops.org";

/** Normalized origin for the API deployment (e.g. "https://api.onboardops.org"), or "" in single-server local dev. */
export function getApiOrigin(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  try {
    const u = new URL(raw);
    if (u.protocol === "http:" || u.protocol === "https:") return u.origin;
  } catch {
    // ignore invalid URL
  }
  return "";
}

/** Hostname of the API deployment (defaults to api.onboardops.org). */
export function getApiHost(): string {
  const origin = getApiOrigin();
  if (origin) {
    try {
      return new URL(origin).hostname.toLowerCase();
    } catch {
      // fall through
    }
  }
  return DEFAULT_API_HOST;
}

/** True when this process or incoming host is serving the dedicated API deployment. */
export function isApiService(host?: string | null): boolean {
  if ((process.env.SERVICE_ROLE || "").trim().toLowerCase() === "api") return true;
  if (!host) return false;
  const h = host.split(",")[0].toLowerCase().split(":")[0].trim();
  if (!h || h === "localhost" || h === "127.0.0.1" || h === "::1") return false;
  return h === DEFAULT_API_HOST || h === getApiHost();
}

/**
 * Builds a URL for an endpoint that runs on api.onboardops.org.
 * When NEXT_PUBLIC_API_URL is set, strips any leading "/api" prefix and prepends the API origin:
 *   apiUrl("/api/v1/employees") -> "https://api.onboardops.org/v1/employees"
 * When NEXT_PUBLIC_API_URL is unset (local dev), keeps same-origin "/api/...".
 */
export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const origin = getApiOrigin();
  if (!origin) {
    return normalized.startsWith("/api/") || normalized === "/api" ? normalized : `/api${normalized}`;
  }
  const clean = normalized === "/api" ? "/" : normalized.startsWith("/api/") ? normalized.slice(4) : normalized;
  return `${origin}${clean}`;
}

type MatchResult = { cleanPath: string; internalPath: string; cors: boolean };

function matchMovedCleanPath(clean: string): { cors: boolean } | null {
  if (clean === "/v1" || clean.startsWith("/v1/")) return { cors: true };
  if (clean === "/status" || clean.startsWith("/status/")) return { cors: true };
  if (clean === "/health") return { cors: true };
  if (clean === "/track") return { cors: true };
  if (clean.startsWith("/testimonial-photo/")) return { cors: true };
  if (clean.startsWith("/betterstack/")) return { cors: false };
  if (clean.startsWith("/cron/")) return { cors: false };
  if (clean.startsWith("/calendar/")) return { cors: false };
  return null;
}

/**
 * Resolves an incoming pathname on api.onboardops.org (accepts both "/v1/..." and "/api/v1/...").
 * Returns null for UI routes and web-only API routes so the API host rejects them with 404 JSON.
 */
export function resolveApiHostPath(pathname: string): MatchResult | null {
  const clean = pathname === "/api" ? "/" : pathname.startsWith("/api/") ? pathname.slice(4) : pathname;
  const hit = matchMovedCleanPath(clean);
  if (!hit) return null;
  return { cleanPath: clean, internalPath: `/api${clean}`, cors: hit.cors };
}

/**
 * Given a pathname on the web deployment, returns the clean target path on api.onboardops.org
 * if it should 308-redirect, or null if web should handle it directly.
 *
 * Keeps /api/status/frontend, /api/version, /api/maintenance, /api/avatar/*, /api/export/*,
 * /api/files/*, /api/search, /api/audit/verify, /api/admin/*, and /api/auth/* on web.
 */
export function webRedirectPathForApi(pathname: string): string | null {
  if (!pathname.startsWith("/api/")) return null;
  const clean = pathname.slice(4);
  if (clean === "/status/frontend") return null;
  return matchMovedCleanPath(clean) ? clean : null;
}
