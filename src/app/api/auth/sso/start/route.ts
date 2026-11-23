import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enforceRate } from "@/lib/rate-limit";
import { SSO_COOKIE, SSO_TTL_SECONDS, newSsoFlow, signSsoFlow, ssoAuthUrl, ssoForEmail } from "@/lib/sso";

export const dynamic = "force-dynamic";

/**
 * Sends the browser to the company's identity provider.
 * ?email=name@company.com finds the workspace by the email's domain (SSO must be enabled).
 * ?test=1&ws=<id> lets the workspace owner try a configuration before enabling it.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const test = q.get("test") === "1";
  const fail = (code: string) => `${test ? "/app/settings" : "/login"}?sso_error=${code}`;
  try { await enforceRate("sso-start", 30, 900); } catch { redirect(fail("rate")); }

  let cfg = null; let extra: { test?: boolean; uid?: string; hint?: string } = {};
  if (test) {
    const uid = await getSessionUserId();
    const wsId = q.get("ws") ?? "";
    const owner = uid && wsId ? await prisma.workspaceMember.findFirst({ where: { userId: uid, workspaceId: wsId, role: "OWNER" } }) : null;
    if (!owner) redirect(fail("session"));
    cfg = await prisma.workspaceSso.findUnique({ where: { workspaceId: wsId } });
    extra = { test: true, uid: uid! };
  } else {
    const email = (q.get("email") ?? "").trim().toLowerCase();
    cfg = email ? await ssoForEmail(email) : null;
    extra = { hint: email || undefined };
  }
  if (!cfg) redirect(fail("not_configured"));
  const flow = newSsoFlow(cfg.workspaceId, extra);
  cookies().set(SSO_COOKIE, await signSsoFlow(flow), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/auth/sso", maxAge: SSO_TTL_SECONDS });
  redirect(ssoAuthUrl(cfg, flow));
}
