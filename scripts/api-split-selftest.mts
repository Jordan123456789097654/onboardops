/**
 * Self-test for dual-deployment (web vs api.onboardops.org) routing rules and middleware.
 * Run with: npx tsx scripts/api-split-selftest.mts
 */
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

const unwrap = <T,>(m: T & { default?: T }): T => (m && typeof m === "object" && "default" in m && m.default ? m.default : m);
const { middleware } = unwrap(await import("../src/middleware.ts"));
const { apiUrl, isApiService, resolveApiHostPath, webRedirectPathForApi } = unwrap(await import("../src/lib/service-role.ts"));
const { isMainHost } = unwrap(await import("../src/lib/host-shared.ts"));

function mkReq(url: string, opts?: { method?: string; host?: string }) {
  const headers = new Headers();
  if (opts?.host) headers.set("host", opts.host);
  return new NextRequest(url, { method: opts?.method ?? "GET", headers });
}

async function run() {
  // 1. Host classification
  assert.equal(isMainHost("api.onboardops.org"), true, "api.onboardops.org must be recognized as a platform host");
  assert.equal(isMainHost("www.onboardops.org"), true);
  assert.equal(isMainHost("retailnexus.onboardops.org"), false, "workspace subdomain must remain a custom host");

  // 2. Local single-server dev mode (SERVICE_ROLE unset, NEXT_PUBLIC_API_URL unset)
  delete process.env.SERVICE_ROLE;
  delete process.env.NEXT_PUBLIC_API_URL;
  assert.equal(isApiService("localhost:3000"), false);
  assert.equal(apiUrl("/api/v1/employees"), "/api/v1/employees");
  assert.equal(apiUrl("/v1/employees"), "/api/v1/employees");
  assert.equal(apiUrl("/api/track"), "/api/track");
  {
    const r = await middleware(mkReq("http://localhost:3000/api/v1/employees", { host: "localhost:3000" }));
    assert.equal(r.status, 200, "local dev should not redirect /api/v1/employees");
    assert.equal(r.headers.get("location"), null);
  }

  // 3. Production WEB mode (SERVICE_ROLE=web, NEXT_PUBLIC_API_URL=https://api.onboardops.org)
  process.env.SERVICE_ROLE = "web";
  process.env.NEXT_PUBLIC_API_URL = "https://api.onboardops.org";
  assert.equal(apiUrl("/api/v1/employees"), "https://api.onboardops.org/v1/employees");
  assert.equal(apiUrl("/api/track"), "https://api.onboardops.org/track");
  assert.equal(apiUrl("/api/testimonial-photo/abc?v=1"), "https://api.onboardops.org/testimonial-photo/abc?v=1");
  assert.equal(apiUrl("/api/calendar/tok.ics"), "https://api.onboardops.org/calendar/tok.ics");

  const shouldRedirect: [string, string][] = [
    ["/api/v1/employees?status=ACTIVE", "https://api.onboardops.org/v1/employees?status=ACTIVE"],
    ["/api/v1/employees/emp_1", "https://api.onboardops.org/v1/employees/emp_1"],
    ["/api/v1/infractions", "https://api.onboardops.org/v1/infractions"],
    ["/api/v1/shifts?from=2026-11-01", "https://api.onboardops.org/v1/shifts?from=2026-11-01"],
    ["/api/v1/assignments", "https://api.onboardops.org/v1/assignments"],
    ["/api/v1/audit", "https://api.onboardops.org/v1/audit"],
    ["/api/status", "https://api.onboardops.org/status"],
    ["/api/status/database", "https://api.onboardops.org/status/database"],
    ["/api/status/auth", "https://api.onboardops.org/status/auth"],
    ["/api/status/api", "https://api.onboardops.org/status/api"],
    ["/api/status/email", "https://api.onboardops.org/status/email"],
    ["/api/status/storage", "https://api.onboardops.org/status/storage"],
    ["/api/status/domains", "https://api.onboardops.org/status/domains"],
    ["/api/health", "https://api.onboardops.org/health"],
    ["/api/betterstack/secret123", "https://api.onboardops.org/betterstack/secret123"],
    ["/api/cron/daily", "https://api.onboardops.org/cron/daily"],
    ["/api/calendar/abc123.ics", "https://api.onboardops.org/calendar/abc123.ics"],
    ["/api/testimonial-photo/t1?v=5", "https://api.onboardops.org/testimonial-photo/t1?v=5"],
    ["/api/track", "https://api.onboardops.org/track"],
  ];
  for (const [path, expectedLoc] of shouldRedirect) {
    const r = await middleware(mkReq(`https://www.onboardops.org${path}`, { host: "www.onboardops.org" }));
    assert.equal(r.status, 308, `web should 308-redirect ${path}`);
    assert.equal(r.headers.get("location"), expectedLoc, `wrong redirect location for ${path}`);
  }

  const stayOnWeb = [
    "/api/status/frontend",
    "/api/version",
    "/api/maintenance",
    "/api/avatar/user_1",
    "/api/files/file_1",
    "/api/search?q=test",
    "/api/audit/verify",
    "/api/auth/oauth/google/start",
    "/api/auth/sso/callback",
  ];
  for (const path of stayOnWeb) {
    assert.equal(webRedirectPathForApi(path.split("?")[0]), null, `${path} must stay on web`);
    const r = await middleware(mkReq(`https://www.onboardops.org${path}`, { host: "www.onboardops.org" }));
    assert.notEqual(r.status, 308, `${path} must not 308-redirect to api host`);
  }

  // Protected web APIs still redirect unauthenticated users to /login (307), not to api.onboardops.org (308)
  for (const path of ["/api/export/employees", "/api/admin/audit-verify"]) {
    assert.equal(webRedirectPathForApi(path), null, `${path} must stay on web`);
    const r = await middleware(mkReq(`https://www.onboardops.org${path}`, { host: "www.onboardops.org" }));
    assert.equal(r.status, 307);
    assert.equal(r.headers.get("location"), "https://www.onboardops.org/login");
  }

  // 4. Production API mode (SERVICE_ROLE=api)
  process.env.SERVICE_ROLE = "api";
  {
    const r = await middleware(mkReq("https://api.onboardops.org/", { host: "api.onboardops.org" }));
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(body.service, "OnboardOps API");
    assert.equal(r.headers.get("access-control-allow-origin"), "*");
  }
  {
    const r = await middleware(mkReq("https://api.onboardops.org/track", { method: "OPTIONS", host: "api.onboardops.org" }));
    assert.equal(r.status, 204);
    assert.equal(r.headers.get("access-control-allow-origin"), "*");
  }

  const apiRewrites: [string, string, boolean][] = [
    ["/v1/employees?limit=10", "https://api.onboardops.org/api/v1/employees?limit=10", true],
    ["/status", "https://api.onboardops.org/api/status", true],
    ["/status/database", "https://api.onboardops.org/api/status/database", true],
    ["/status/frontend", "https://api.onboardops.org/api/status/frontend", true],
    ["/health", "https://api.onboardops.org/api/health", true],
    ["/betterstack/tok", "https://api.onboardops.org/api/betterstack/tok", false],
    ["/cron/daily", "https://api.onboardops.org/api/cron/daily", false],
    ["/calendar/abc.ics", "https://api.onboardops.org/api/calendar/abc.ics", false],
    ["/testimonial-photo/t1?v=9", "https://api.onboardops.org/api/testimonial-photo/t1?v=9", true],
    ["/track", "https://api.onboardops.org/api/track", true],
  ];
  for (const [path, expectedRewrite, expectCors] of apiRewrites) {
    const r = await middleware(mkReq(`https://api.onboardops.org${path}`, { host: "api.onboardops.org" }));
    assert.equal(r.headers.get("x-middleware-rewrite"), expectedRewrite, `API rewrite mismatch for ${path}`);
    assert.equal(r.headers.get("access-control-allow-origin"), expectCors ? "*" : null, `CORS mismatch for ${path}`);
  }

  // /api/* aliases on api.onboardops.org pass through without rewriting
  {
    const r = await middleware(mkReq("https://api.onboardops.org/api/v1/employees", { host: "api.onboardops.org" }));
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("x-middleware-rewrite"), null);
    assert.equal(r.headers.get("access-control-allow-origin"), "*");
  }

  // UI routes and web-only APIs must return 404 JSON on api.onboardops.org
  const blockedOnApi = [
    "/login",
    "/register",
    "/app/overview",
    "/admin",
    "/api/auth/oauth/google/start",
    "/api/auth/sso/start",
    "/api/export/employees",
    "/api/files/f1",
    "/api/search",
    "/api/avatar/u1",
    "/api/admin/audit-verify",
    "/api/version",
    "/api/maintenance",
  ];
  for (const path of blockedOnApi) {
    assert.equal(resolveApiHostPath(path), null, `${path} must be blocked on api host`);
    const r = await middleware(mkReq(`https://api.onboardops.org${path}`, { host: "api.onboardops.org" }));
    assert.equal(r.status, 404, `api host should return 404 for ${path}`);
    const body = await r.json();
    assert.equal(body.code, "not_found");
  }

  console.log("All api-split routing checks passed!");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
