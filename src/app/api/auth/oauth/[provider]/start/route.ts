import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { OAUTH_COOKIE, OAUTH_TTL_SECONDS, authorizationUrl, isConfigured, newFlow, parseProvider, signFlow, type OAuthFlow } from "@/lib/oauth";
import { enforceRate } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Sends the browser to Google or GitHub. Sign-up needs the terms accepted (and a company name for an owner) before it starts. */
export async function GET(req: Request, { params }: { params: { provider: string } }) {
  const provider = parseProvider(params.provider);
  const q = new URL(req.url).searchParams;
  const mode = q.get("mode") === "signup" ? "signup" : q.get("mode") === "link" ? "link" : "login";
  const back = (code: string) => `${mode === "link" ? "/account" : mode === "signup" ? "/register" : "/login"}?oauth_error=${code}`;
  if (!provider || !isConfigured(provider)) redirect(back("not_configured"));
  try { await enforceRate("oauth-start", 30, 900); } catch { redirect(back("rate")); }

  const extra: Partial<OAuthFlow> = {};
  if (mode === "link") {
    const uid = await getSessionUserId();
    if (!uid) redirect("/login?oauth_error=session");
    extra.uid = uid;
  }
  if (mode === "signup") {
    if (q.get("terms") !== "1") redirect(back("terms"));
    extra.kind = q.get("kind") === "EMPLOYEE" ? "EMPLOYEE" : "OWNER";
    if (extra.kind === "OWNER") {
      const company = (q.get("company") ?? "").trim().slice(0, 80);
      if (company.length < 2) redirect(back("company"));
      extra.company = company;
    }
    const ref = q.get("ref"); if (ref && /^[a-z0-9-]{3,30}$/i.test(ref)) extra.ref = ref.toLowerCase();
    const address = q.get("address"); if (address && /^[a-z0-9-]{3,60}$/i.test(address)) extra.address = address.toLowerCase();
  }

  const flow = newFlow(provider, mode, extra);
  cookies().set(OAUTH_COOKIE, await signFlow(flow), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/auth/oauth", maxAge: OAUTH_TTL_SECONDS });
  redirect(authorizationUrl(flow));
}
