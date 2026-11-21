import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { cleanHost, isMainHost, MARKETING_PREFIXES } from "@/lib/host-shared";

const PROTECTED = ["/app", "/print", "/admin", "/workplaces", "/account", "/api/export", "/api/admin"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = cleanHost(req.headers.get("x-forwarded-host") || req.headers.get("host"));
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

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|screens/|roleflow.png|robots.txt|sitemap.xml).*)"] };
