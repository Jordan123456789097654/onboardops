import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enforceRate } from "@/lib/rate-limit";
import {
  SAML_COOKIE,
  SAML_TTL_SECONDS,
  buildSamlAuthnRequestUrl,
  newSamlFlow,
  samlForEmail,
  signSamlFlow,
} from "@/lib/saml";

export const dynamic = "force-dynamic";

/**
 * Initiates an SP-initiated SAML 2.0 HTTP-Redirect AuthnRequest.
 * - ?ws=<id>&test=1: owner-only test flow before enabling SAML.
 * - ?email=<email>: looks up enabled WorkspaceSaml by email domain.
 * - ?ws=<id>: starts login for a specific workspace with SAML enabled.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const test = q.get("test") === "1";
  const fail = (code: string) => (test ? `/app/settings?saml_error=${code}` : `/login?sso_error=${code}`);

  try {
    await enforceRate("saml-start", 30, 900);
  } catch {
    redirect(fail("rate"));
  }

  let cfg = null;
  let extra: { test?: boolean; uid?: string; email?: string } = {};

  if (test) {
    const uid = await getSessionUserId();
    const wsId = (q.get("ws") ?? "").trim();
    const owner =
      uid && wsId
        ? await prisma.workspaceMember.findFirst({
            where: { userId: uid, workspaceId: wsId, role: "OWNER" },
          })
        : null;
    if (!owner) redirect(fail("session"));
    cfg = await prisma.workspaceSaml.findUnique({ where: { workspaceId: wsId } });
    extra = { test: true, uid: uid! };
  } else {
    const email = (q.get("email") ?? "").trim().toLowerCase();
    const wsId = (q.get("ws") ?? "").trim();
    if (email) {
      cfg = await samlForEmail(email);
      extra = { email };
    } else if (wsId) {
      const row = await prisma.workspaceSaml.findUnique({ where: { workspaceId: wsId } });
      cfg = row && row.enabled ? row : null;
    }
  }

  if (!cfg) redirect(fail("not_configured"));

  const flow = newSamlFlow(cfg.workspaceId, extra);
  cookies().set(SAML_COOKIE, await signSamlFlow(flow), {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/saml",
    maxAge: SAML_TTL_SECONDS,
  });

  redirect(buildSamlAuthnRequestUrl({ ssoUrl: cfg.ssoUrl, workspaceId: cfg.workspaceId }, flow.relayState));
}
