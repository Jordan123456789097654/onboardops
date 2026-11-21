import { cookies } from "next/headers";
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

export async function createSession(userId: string) {
  const token = await new SignJWT({ uid: userId })
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

export async function listMemberships() {
  const uid = await getSessionUserId();
  if (!uid) return [];
  const all = await prisma.workspaceMember.findMany({ where: { userId: uid }, include: { workspace: true }, orderBy: { createdAt: "asc" } });
  const hostWs = await hostWorkspaceId();
  return hostWs ? all.filter((m) => m.workspaceId === hostWs) : all;
}
