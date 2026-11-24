import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { edgeLimit } from "@/lib/edge-limit";
import { cleanHost, isMainHost, MARKETING_PREFIXES } from "@/lib/host-shared";
import { getApiOrigin, isApiService, resolveApiHostPath, webRedirectPathForApi } from "@/lib/service-role";

const PROTECTED = ["/app", "/print", "/admin", "/workplaces", "/account", "/api/export", "/api/admin"];

const API_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

function applyCors(res: NextResponse) {
  for (const [k, v] of Object.entries(API_CORS)) res.headers.set(k, v);
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const host = cleanHost(req.headers.get("x-forwarded-host") || req.headers.get("host"));

  // First line of defense against floods: a cheap in-memory limit on every API route, before any database work.
  const limited = edgeLimit(req, pathname, isApiService(host));
  if (limited) return limited;

  // Dedicated API deployment (SERVICE_ROLE=api or api.onboardops.org): serve only moved API routes.
  if (isApiService(host)) {
    if (pathname === "/" || pathname === "/api") {
      if (req.method === "OPTIONS") return new NextResponse(null, { status: 204, headers: API_CORS });
      return NextResponse.json(
        {
          service: "OnboardOps API",
          status: "ok",
          docs: "https://www.onboardops.org/support/api-reference",
          statusPage: "https://status.onboardops.org",
          endpoints: { v1: "/v1", status: "/status", health: "/health" },
        },
        { headers: { ...API_CORS, "Cache-Control": "no-store" } }
      );
    }

    const resolved = resolveApiHostPath(pathname);
    if (!resolved) {
      return NextResponse.json({ error: "Not found", code: "not_found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    if (req.method === "OPTIONS" && resolved.cors) {
      return new NextResponse(null, { status: 204, headers: API_CORS });
    }
    if (pathname !== resolved.internalPath) {
      const url = req.nextUrl.clone();
      url.pathname = resolved.internalPath;
      const res = NextResponse.rewrite(url);
      return resolved.cors ? applyCors(res) : res;
    }
    const res = NextResponse.next();
    return resolved.cors ? applyCors(res) : res;
  }

  // Web deployment: permanently redirect moved API endpoints to api.onboardops.org once NEXT_PUBLIC_API_URL is set.
  const apiOrigin = getApiOrigin();
  if (apiOrigin) {
    const targetPath = webRedirectPathForApi(pathname);
    if (targetPath) {
      return NextResponse.redirect(`${apiOrigin}${targetPath}${search}`, 308);
    }
  }

  const custom = !isMainHost(host);

  // Custom domains only serve that workspace's staff login and the app. Everything else goes to the login page.
  if (custom) {
    if (pathname === "/" || pathname === "/login") {
      const url = req.nextUrl.clone();
      url.pathname = `/d/${host}`;
      return NextResponse.rewrite(url);
    }
    if (MARKETING_PREFIXES.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p.endsWith("/") ? p : p + "/"))) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const token = req.cookies.get("oo_session")?.value;
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET || "dev-only-secret-change-me-please-32chars");
    let ok = false;
    if (token) {
      try { await jwtVerify(token, secret); ok = true; } catch { ok = false; }
    }
    if (!ok) {
      const url = req.nextUrl.clone();
      url.pathname = custom ? "/" : "/login";
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|screens/|tutorial/|roleflow.png|retailnetwork.jpg|robots.txt|sitemap.xml).*)"] };
