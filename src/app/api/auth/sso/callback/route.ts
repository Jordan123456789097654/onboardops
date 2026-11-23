import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUserId, membershipsFor } from "@/lib/auth";
import { beginSession, landingFor } from "@/lib/login";
import { getMaintenanceState } from "@/lib/maintenance";
import { OAuthError } from "@/lib/oauth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { enforceRate } from "@/lib/rate-limit";
import { SSO_COOKIE, resolveSso, ssoProfile, ssoStateMatches, verifySsoFlow } from "@/lib/sso";

export const dynamic = "force-dynamic";

/** The identity provider sends the browser back here. Every outcome is a redirect; the work is in handle() so redirect() never runs inside a try. */
export async function GET(req: Request) {
  redirect(await handle(req));
}

const audit = (workspaceId: string, actionType: string, actorName: string, summary: string, memberId?: string) =>
  prisma.$transaction((tx) => writeAudit(tx, { workspaceId, actorMemberId: memberId ?? null, actorName, actionType, targetType: "Workspace", targetId: workspaceId, summary }));

async function handle(req: Request): Promise<string> {
  const q = new URL(req.url).searchParams;
  const flow = await verifySsoFlow(cookies().get(SSO_COOKIE)?.value);
  cookies().delete({ name: SSO_COOKIE, path: "/api/auth/sso" });
  const fail = (code: string) => `${flow?.test ? "/app/settings" : "/login"}?sso_error=${code}`;
  if (!flow || !ssoStateMatches(q.get("state"), flow.state)) return fail("state");
  if (q.get("error")) return fail("denied");
  const code = q.get("code");
  if (!code) return fail("denied");
  try { await enforceRate("sso-callback", 30, 900); } catch { return fail("rate"); }

  const cfg = await prisma.workspaceSso.findUnique({ where: { workspaceId: flow.wsId } });
  if (!cfg || (!cfg.enabled && !flow.test)) return fail("not_configured");
  if (!flow.test && (await getMaintenanceState()).enabled) return fail("maintenance");

  let profile;
  try { profile = await ssoProfile(cfg, code, flow); } catch (e) { return fail(e instanceof OAuthError ? e.code : "exchange"); }

  if (flow.test) {
    // A test proves the configuration works and the owner's company account is on an allowed domain. It signs nobody in.
    if ((await getSessionUserId()) !== flow.uid) return fail("session");
    const m = await prisma.workspaceMember.findFirst({ where: { workspaceId: cfg.workspaceId, userId: flow.uid!, role: "OWNER" } });
    if (!m) return fail("session");
    await prisma.workspaceSso.update({ where: { workspaceId: cfg.workspaceId }, data: { testedAt: new Date() } });
    await audit(cfg.workspaceId, "SSO_TESTED", "Single sign-on", `A test sign-in succeeded for ${profile.email}`, m.id);
    return "/app/settings?sso=tested";
  }

  const r = await resolveSso(cfg.workspaceId, profile);
  if (r.kind === "not-member") {
    await audit(cfg.workspaceId, "SSO_LOGIN_DENIED", "Single sign-on", `${profile.email} signed in at the identity provider but is not a member of this workspace, so access was refused`);
    return fail("not_member");
  }
  if (r.linked) await audit(cfg.workspaceId, "SSO_LINKED", "Single sign-on", `${profile.email} was linked to their identity provider account on first sign-in`);
  // Same gate as every sign-in: two-factor (the person's own, or the workspace's requirement) is still asked for after SSO.
  const gate = await beginSession(r.userId, { workspaceId: cfg.workspaceId, method: "sso" });
  if (!gate.done) return gate.to;
  const first = (await membershipsFor(r.userId)).find((m) => m.workspaceId === cfg.workspaceId);
  return landingFor(r.userId, first?.workspaceId, "/workplaces");
}
