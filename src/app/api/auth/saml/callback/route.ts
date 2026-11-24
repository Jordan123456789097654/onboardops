import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { getSessionUserId, membershipsFor } from "@/lib/auth";
import { beginSession, landingFor } from "@/lib/login";
import { getMaintenanceState } from "@/lib/maintenance";
import { prisma } from "@/lib/prisma";
import { enforceRate } from "@/lib/rate-limit";
import {
  SAML_COOKIE,
  SamlError,
  peekSamlIssuer,
  samlStateMatches,
  verifySamlFlow,
  verifySamlResponse,
} from "@/lib/saml";
import { SSO_ERRORS, resolveSso } from "@/lib/sso";

export const dynamic = "force-dynamic";

const audit = (
  workspaceId: string,
  actionType: string,
  actorName: string,
  summary: string,
  memberId?: string,
) =>
  prisma.$transaction((tx) =>
    writeAudit(tx, {
      workspaceId,
      actorMemberId: memberId ?? null,
      actorName,
      actionType,
      targetType: "Workspace",
      targetId: workspaceId,
      summary,
    }),
  );

function redirectBase(req: Request): string {
  return (process.env.APP_URL || new URL(req.url).origin).replace(/\/$/, "");
}

function toLoginError(code: string): string {
  return code in SSO_ERRORS ? code : "exchange";
}

/**
 * SAML 2.0 Assertion Consumer Service (HTTP-POST binding).
 * Supports both SP-initiated flows (signed oo_saml cookie + RelayState) and IdP-initiated flows (Issuer match).
 * Always responds with HTTP 303 See Other so the browser follows up with a GET request.
 */
export async function POST(req: Request) {
  const dest = await handle(req);
  return NextResponse.redirect(new URL(dest, redirectBase(req)), 303);
}

async function handle(req: Request): Promise<string> {
  const flow = await verifySamlFlow(cookies().get(SAML_COOKIE)?.value);
  cookies().delete({ name: SAML_COOKIE, path: "/api/auth/saml" });

  const isTest = !!flow?.test;
  const fail = (code: string) =>
    isTest ? `/app/settings?saml_error=${code}` : `/login?sso_error=${toLoginError(code)}`;

  try {
    await enforceRate("saml-callback", 30, 900);
  } catch {
    return fail("rate");
  }

  let bodyText = "";
  try {
    bodyText = await req.text();
  } catch {
    return fail("xml");
  }
  const form = new URLSearchParams(bodyText);
  const samlResponse = (form.get("SAMLResponse") ?? "").trim();
  const relayState = (form.get("RelayState") ?? "").trim();
  if (!samlResponse) return fail("denied");

  let cfg = null;
  if (flow) {
    if (!samlStateMatches(relayState, flow.relayState)) return fail("state");
    cfg = await prisma.workspaceSaml.findUnique({ where: { workspaceId: flow.wsId } });
    if (!cfg || (!cfg.enabled && !flow.test)) return fail("not_configured");
  } else {
    // IdP-initiated SAML POST: match Issuer against enabled WorkspaceSaml
    const issuer = peekSamlIssuer(samlResponse);
    if (!issuer) return fail("state");
    cfg = await prisma.workspaceSaml.findFirst({ where: { entityId: issuer, enabled: true } });
    if (!cfg) return fail("not_configured");
  }

  if (!isTest && (await getMaintenanceState()).enabled) return fail("maintenance");

  let profile;
  try {
    profile = verifySamlResponse(samlResponse, {
      workspaceId: cfg.workspaceId,
      entityId: cfg.entityId,
      certPem: cfg.certPem,
      prevCertPem: cfg.prevCertPem,
      domains: cfg.domains,
      roleAttr: cfg.roleAttr,
    });
  } catch (e) {
    return fail(e instanceof SamlError ? e.code : "exchange");
  }

  if (flow?.test) {
    if (!flow.uid) return fail("session");
    const sessionUid = await getSessionUserId();
    // If the session cookie accompanied the POST (same-site), ensure it matches the owner who started the test.
    if (sessionUid && sessionUid !== flow.uid) return fail("session");
    const ownerMember = await prisma.workspaceMember.findFirst({
      where: { workspaceId: cfg.workspaceId, userId: flow.uid, role: "OWNER" },
    });
    if (!ownerMember) return fail("session");
    await prisma.workspaceSaml.update({
      where: { workspaceId: cfg.workspaceId },
      data: { testedAt: new Date() },
    });
    await audit(
      cfg.workspaceId,
      "SAML_TESTED",
      "SAML SSO",
      `A test SAML 2.0 sign-in succeeded for ${profile.email}`,
      ownerMember.id,
    );
    return "/app/settings?saml=tested";
  }

  const r = await resolveSso(cfg.workspaceId, {
    issuer: profile.issuer,
    subject: profile.subject,
    email: profile.email,
    name: profile.name,
  });

  if (r.kind === "not-member") {
    await audit(
      cfg.workspaceId,
      "SAML_LOGIN_DENIED",
      "SAML SSO",
      `${profile.email} authenticated via SAML 2.0 but is not a member of this workspace, so access was refused`,
    );
    return fail("not_member");
  }

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: cfg.workspaceId, userId: r.userId } },
    select: { id: true },
  });

  if (r.linked) {
    await audit(
      cfg.workspaceId,
      "SAML_LINKED",
      "SAML SSO",
      `${profile.email} was linked to their SAML 2.0 identity on first sign-in`,
      member?.id,
    );
  }

  await audit(
    cfg.workspaceId,
    "SAML_SIGN_IN",
    profile.name || profile.email,
    `${profile.email} signed in via SAML 2.0 (${flow ? "SP-initiated" : "IdP-initiated"})`,
    member?.id,
  );

  const gate = await beginSession(r.userId, { workspaceId: cfg.workspaceId, method: "sso" });
  if (!gate.done) return gate.to;
  const first = (await membershipsFor(r.userId)).find((m) => m.workspaceId === cfg.workspaceId);
  return landingFor(r.userId, first?.workspaceId, "/workplaces");
}
