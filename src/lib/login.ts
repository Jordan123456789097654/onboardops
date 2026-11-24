import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { createSession, membershipsFor, setActiveWorkspace } from "./auth";
import { resolvePlatformRole } from "./platform-role";
import { loginRequirement } from "./mfa";
import { isDuoEnabled } from "./duo";
import { MFA_COOKIE, MFA_TTL_SECONDS, signMfaPending, verifyMfaPending, type MfaPending } from "./mfa-token";

/**
 * The single gate every sign-in path goes through once the first factor (password, magic link, reset link or SSO) has been checked.
 * If a second factor is needed it sets a short-lived pending cookie instead of a session and says where to send the person.
 */
export async function beginSession(userId: string, opts: { workspaceId?: string | null; method: MfaPending["method"] }): Promise<{ done: true } | { done: false; to: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { totpEnabledAt: true } });
  const ws = opts.workspaceId ? await prisma.workspace.findUnique({ where: { id: opts.workspaceId }, select: { require2fa: true, duoConfig: true } }) : null;
  const need = loginRequirement({ totpEnabledAt: user?.totpEnabledAt ?? null }, ws);
  const duoOn = isDuoEnabled(ws);
  if (need === "none" && !duoOn) {
    await createSession(userId);
    return { done: true };
  }
  const enroll = need === "enroll";
  const token = await signMfaPending({ u: userId, ws: opts.workspaceId ?? undefined, enroll, method: opts.method });
  cookies().set(MFA_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MFA_TTL_SECONDS });
  return { done: false, to: enroll ? "/login/2fa/setup" : "/login/2fa" };
}

export async function readMfaPending() {
  return verifyMfaPending(cookies().get(MFA_COOKIE)?.value);
}

export function clearMfaPending() {
  cookies().delete(MFA_COOKIE);
}

/** Picks the workspace to land in, makes it active, and returns the page to open. Call after the session exists. */
export async function landingFor(userId: string, workspaceId?: string | null, noMemberTo?: string): Promise<string> {
  const ms = await membershipsFor(userId);
  const target = (workspaceId && ms.find((m) => m.workspaceId === workspaceId)) || ms[0];
  if (target) setActiveWorkspace(target.workspaceId);
  if (!target) {
    if (noMemberTo) return noMemberTo;
    const u = await prisma.user.findUnique({ where: { id: userId } });
    return u && resolvePlatformRole(u) === "OWNER" ? "/admin" : "/workplaces";
  }
  return target.role === "EMPLOYEE" ? "/app/my-portal" : "/app/overview";
}
