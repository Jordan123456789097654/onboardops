import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUserId, membershipsFor } from "@/lib/auth";
import { beginSession, landingFor } from "@/lib/login";
import { auditUser } from "@/lib/mfa";
import { getMaintenanceState } from "@/lib/maintenance";
import { resolvePlatformRole } from "@/lib/platform-role";
import { prisma } from "@/lib/prisma";
import { autoClaimSubdomain } from "@/lib/subdomain";
import { enforceRate } from "@/lib/rate-limit";
import { OAUTH_COOKIE, OAuthError, fetchProfile, parseProvider, providerLabel, resolveOAuth, stateMatches, verifyFlow, type OAuthFlow } from "@/lib/oauth";

export const dynamic = "force-dynamic";

/**
 * The provider sends the browser back here. Every outcome ends in a redirect to a page; the work happens in handle()
 * so that redirect() is never called inside a try block.
 */
export async function GET(req: Request, { params }: { params: { provider: string } }) {
  redirect(await handle(req, params.provider));
}

async function handle(req: Request, providerParam: string): Promise<string> {
  const provider = parseProvider(providerParam);
  const q = new URL(req.url).searchParams;
  const flow = await verifyFlow(cookies().get(OAUTH_COOKIE)?.value);
  cookies().delete({ name: OAUTH_COOKIE, path: "/api/auth/oauth" });
  const fail = (code: string) => `${flow?.mode === "link" ? "/account" : flow?.mode === "signup" ? "/register" : "/login"}?oauth_error=${code}`;

  // CSRF: the state in the URL must be the one we stored in the signed cookie when the flow began.
  if (!provider || !flow || flow.provider !== provider || !stateMatches(q.get("state"), flow.state)) return fail("state");
  if (q.get("error")) return fail("denied");
  const code = q.get("code");
  if (!code) return fail("denied");
  try { await enforceRate("oauth-callback", 30, 900); } catch { return fail("rate"); }

  const maint = await getMaintenanceState();
  if (maint.enabled && flow.mode === "signup") return fail("maintenance");

  let profile;
  try { profile = await fetchProfile(provider, code, flow); } catch (e) { return fail(e instanceof OAuthError ? e.code : "exchange"); }

  if (flow.mode === "link") {
    // The person must still be the signed-in user who started the link.
    if ((await getSessionUserId()) !== flow.uid) return fail("session");
  }

  const r = await resolveOAuth(profile, flow);
  switch (r.kind) {
    case "no-account": return fail("no_account");
    case "unverified-conflict": return fail("unverified_conflict");
    case "link-conflict": return fail("link_conflict");
    case "already-linked": return fail("already_linked");
    case "linked": {
      const u = await prisma.user.findUnique({ where: { id: flow.uid! }, select: { name: true } });
      await auditUser(flow.uid!, u?.name ?? "User", "OAUTH_LINKED", `${u?.name ?? "A member"} connected ${providerLabel[provider]}`);
      return "/account?oauth=linked";
    }
  }

  const userId = r.userId;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (maint.enabled && resolvePlatformRole(user) !== "OWNER") return fail("maintenance");

  if (r.kind === "linked-signin") await auditUser(userId, user.name, "OAUTH_LINKED", `${user.name} connected ${providerLabel[provider]} (matched by verified email)`);
  if (r.kind === "created") {
    await auditUser(userId, user.name, "OAUTH_SIGNUP", `${user.name} created an account with ${providerLabel[provider]}`);
    if (r.workspaceId) {
      if (flow.ref) {
        const partner = await prisma.partner.findUnique({ where: { code: flow.ref } });
        if (partner) await prisma.workspace.update({ where: { id: r.workspaceId }, data: { referralCode: partner.code } }).catch(() => {});
      }
      const claimed = flow.address ? await autoClaimSubdomain(r.workspaceId, flow.address) : null;
      if (!claimed && r.slug) await autoClaimSubdomain(r.workspaceId, r.slug);
    }
  }

  // Same gate as every other sign-in: someone with two-factor on (or a workspace that requires it) still has to pass it after Google or GitHub.
  const first = (await membershipsFor(userId))[0];
  const gate = await beginSession(userId, { workspaceId: first?.workspaceId, method: "sso" });
  if (!gate.done) return gate.to;
  return landingFor(userId, first?.workspaceId, "/workplaces");
}
