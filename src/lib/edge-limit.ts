import { NextResponse, type NextRequest } from "next/server";
import { memHit } from "./mem-limit";
import { trustedClientIp } from "./client-ip";

type Rule = { prefix: string; limit: number };

/** Requests per minute per IP, by route group. The first matching prefix wins, so put narrow ones first. */
export const RULES: Rule[] = [
  { prefix: "/api/ai/chat", limit: 20 },
  { prefix: "/api/support/upload", limit: 10 },
  { prefix: "/api/track", limit: 60 },
  { prefix: "/api/export", limit: 20 },
  { prefix: "/api/admin", limit: 20 },
  { prefix: "/api/certificate", limit: 30 },
  { prefix: "/api/auth", limit: 40 },
  { prefix: "/api/search", limit: 60 },
  // Callers that are machines, from few addresses: allow bursts but still cap them.
  { prefix: "/api/scim", limit: 1200 },
  { prefix: "/api/support/inbound", limit: 600 },
  { prefix: "/api/betterstack", limit: 600 },
  { prefix: "/api/cron", limit: 60 },
  { prefix: "/api/v1", limit: 300 },
  { prefix: "/v1", limit: 300 },
  // Pictures and files that pages load many of at once.
  { prefix: "/api/avatar", limit: 300 },
  { prefix: "/api/workspace-logo", limit: 300 },
  { prefix: "/api/testimonial-photo", limit: 300 },
  { prefix: "/api/files", limit: 240 },
  { prefix: "/api/support/file", limit: 240 },
  { prefix: "/api/health", limit: 300 },
  { prefix: "/api/status", limit: 300 },
  { prefix: "/api/maintenance", limit: 300 },
  { prefix: "/api/incidents", limit: 300 },
  { prefix: "/api/version", limit: 300 },
];
const DEFAULT_LIMIT = 120;
/** Ordinary page loads. High enough for a whole office sharing one address, low enough to stop one machine hammering pages. */
const PAGE_LIMIT = 600;

export function ruleFor(pathname: string): Rule {
  const hit = RULES.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  if (hit) return hit;
  return pathname.startsWith("/api/") || pathname === "/api" ? { prefix: "/api", limit: DEFAULT_LIMIT } : { prefix: "/pages", limit: PAGE_LIMIT };
}

const ipOf = (req: NextRequest) => trustedClientIp((n) => req.headers.get(n));

/** Returns a 429 response when this address has made too many requests to this group of routes, otherwise null. */
export function edgeLimit(req: NextRequest, pathname: string, apiHost: boolean): NextResponse | null {
  if (req.method === "OPTIONS") return null;
  if (apiHost && pathname === "/") return null;
  const rule = ruleFor(apiHost && !pathname.startsWith("/api") ? `/api${pathname}` : pathname);
  const wait = memHit(`${ipOf(req)}|${rule.prefix}`, rule.limit, 60_000);
  if (!wait) return null;
  return NextResponse.json({ error: "Too many requests. Please slow down and try again shortly.", code: "rate_limited" }, { status: 429, headers: { "Retry-After": String(wait), "Cache-Control": "no-store" } });
}
