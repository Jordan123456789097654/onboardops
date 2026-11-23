import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { Prisma, Role } from "@prisma/client";
import { prisma } from "./prisma";
import { resolvePlatformRole } from "./platform-role";
import { hostWorkspaceId, onCustomHost } from "./host";

const SESSION = "oo_session";
const WORKSPACE = "oo_ws";
const SUPPORT = "oo_support";
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET || "dev-only-secret-change-me-please-32chars");

export const hashPassword = (p: string) => bcrypt.hash(p, 10);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);

function describeDevice(ua: string) {
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad|iOS/.test(ua) ? "iOS" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "unknown system";
  return `${browser} on ${os}`;
}

/** Records the sign-in as a session row (so it can be listed and ended) and emails the user if the device is new. */
async function recordSession(userId: string): Promise<string | null> {
  try {
    const h = headers();
    const ua = (h.get("user-agent") ?? "").slice(0, 300);
    const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 64);
    const device = describeDevice(ua);
    const prior = await prisma.userSession.count({ where: { userId } });
    const known = prior === 0 ? true : (await prisma.userSession.count({ where: { userId, device, ip } })) > 0;
    const row = await prisma.userSession.create({ data: { userId, userAgent: ua, device, ip } });
    if (!known) {
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
      if (u) {
        const { sendEmail } = await import("./email");
        await sendEmail(u.email, "New sign-in to your OnboardOps account", `Hi ${u.name},\n\nYour account was just signed in to from ${device}${ip ? ` (IP ${ip})` : ""}.\n\nIf this was you, no action is needed. If not, change your password and use "Sign out other devices" in Account settings.`, { kind: "security" });
      }
    }
    return row.id;
  } catch {
    return null;
  }
}

export async function currentSessionId(): Promise<string | null> {
  const t = cookies().get(SESSION)?.value;
  if (!t) return null;
  try { const { payload } = await jwtVerify(t, secret()); return typeof payload.sid === "string" ? payload.sid : null; } catch { return null; }
}

export async function createSession(userId: string) {
  const sid = await recordSession(userId);
  const token = await new SignJWT({ uid: userId, ...(sid ? { sid } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(secret());
  cookies().set(SESSION, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 14 });
}

export function destroySession() {
  cookies().delete(SESSION);
  cookies().delete(SUPPORT);
  cookies().delete(WORKSPACE);
}

export function setActiveWorkspace(id: string) {
  cookies().set(WORKSPACE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 90 });
}

/** Verifies the session cookie. With checkRevocation, sessions issued before the last password change are rejected. */
export async function getSessionUserId(checkRevocation = true): Promise<string | null> {
  const t = cookies().get(SESSION)?.value;
  if (!t) return null;
  try {
    const { payload } = await jwtVerify(t, secret());
    if (typeof payload.uid !== "string") return null;
    if (checkRevocation && typeof payload.iat === "number") {
      const u = await prisma.user.findUnique({ where: { id: payload.uid }, select: { passwordChangedAt: true } });
      if (!u) return null;
      if (u.passwordChangedAt && payload.iat * 1000 < u.passwordChangedAt.getTime() - 1000) return null;
    }
    if (checkRevocation && typeof payload.sid === "string") {
      const s = await prisma.userSession.findUnique({ where: { id: payload.sid }, select: { revokedAt: true, lastSeenAt: true } });
      if (s?.revokedAt) return null;
      if (s && Date.now() - s.lastSeenAt.getTime() > 10 * 60_000) await prisma.userSession.update({ where: { id: payload.sid }, data: { lastSeenAt: new Date() } }).catch(() => {});
    }
    return payload.uid;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const id = await getSessionUserId();
  if (!id) return null;
  return prisma.user.findUnique({ where: { id } });
}

type MembershipBase = Prisma.WorkspaceMemberGetPayload<{ include: { workspace: true; user: true; profile: true; customRole: true } }>;
export type SupportInfo = { grantId: string; expiresAt: Date; reason: string };
export type Membership = MembershipBase & { support?: SupportInfo };

/**
 * Resolves the signed-in user's membership in the active workspace (falls back to first membership).
 * While a staff member holds an active support-access grant, they get a read-only, supervisor-level view of that workspace instead.
 */
export async function getActiveMembership(): Promise<Membership | null> {
  const uid = await getSessionUserId();
  if (!uid) return null;
  const grantId = cookies().get(SUPPORT)?.value;
  if (grantId) {
    const grant = await prisma.supportAccessGrant.findFirst({ where: { id: grantId, staffUserId: uid, endedAt: null, expiresAt: { gt: new Date() } } });
    if (grant) {
      const [ws, user] = await Promise.all([prisma.workspace.findUnique({ where: { id: grant.workspaceId } }), prisma.user.findUnique({ where: { id: uid } })]);
      if (ws && user && resolvePlatformRole(user) && resolvePlatformRole(user) !== "VIEWER") {
        return { id: `support:${grant.id}`, workspaceId: ws.id, userId: uid, role: "SUPERVISOR", customRoleId: null, customRole: null, createdAt: grant.createdAt, workspace: ws, user, profile: null, support: { grantId: grant.id, expiresAt: grant.expiresAt, reason: grant.reason } };
      }
    }
  }
  const wanted = cookies().get(WORKSPACE)?.value;
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: uid },
    include: { workspace: true, user: true, profile: true, customRole: true },
    orderBy: { createdAt: "asc" },
  });
  // A custom role works at its base level (Employee, Supervisor or Manager); extra permissions are added on top in perms.ts.
  for (const m of memberships) if (m.customRole) m.role = m.customRole.baseRole;
  if (!memberships.length) return null;
  // On a workspace's custom domain, only that workspace is reachable, and only by its members.
  const hostWs = await hostWorkspaceId();
  if (hostWs) return memberships.find((m) => m.workspaceId === hostWs) ?? null;
  return memberships.find((m) => m.workspaceId === wanted) ?? memberships[0];
}

/** Where to send someone who has no usable membership: the domain's staff login, their workplaces list, or the main login. */
export async function unauthPath() {
  if (onCustomHost()) return "/";
  return (await getSessionUserId()) ? "/workplaces" : "/login";
}

export function setSupportGrant(id: string, maxAgeSeconds: number) {
  cookies().set(SUPPORT, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: maxAgeSeconds });
}
export function clearSupportGrant() {
  cookies().delete(SUPPORT);
}

/** A user's memberships (limited to the workspace on a custom domain). Works before a session exists, for the sign-in steps. */
export async function membershipsFor(uid: string) {
  const all = await prisma.workspaceMember.findMany({ where: { userId: uid }, include: { workspace: true }, orderBy: { createdAt: "asc" } });
  const hostWs = await hostWorkspaceId();
  return hostWs ? all.filter((m) => m.workspaceId === hostWs) : all;
}

export async function listMemberships() {
  const uid = await getSessionUserId();
  if (!uid) return [];
  return membershipsFor(uid);
}
