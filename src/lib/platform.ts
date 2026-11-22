import { keyedHash } from "./audit-hash";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { getCurrentUser } from "./auth";
import { AuthzError } from "./rbac";
import { resolvePlatformRole, type PlatformRole } from "./platform-role";

export type Staff = { id: string; name: string; email: string; role: PlatformRole };

export async function getStaff(): Promise<Staff | null> {
  const u = await getCurrentUser();
  if (!u) return null;
  const role = resolvePlatformRole(u);
  return role ? { id: u.id, name: u.name, email: u.email, role } : null;
}

/** For server actions: throws unless the caller is staff with one of the allowed roles. */
export async function requireStaff(allowed: PlatformRole[]): Promise<Staff> {
  const s = await getStaff();
  if (!s || !allowed.includes(s.role)) throw new AuthzError("You do not have access to the staff console.");
  return s;
}

/** For pages: redirects non-staff away. */
export async function requireStaffPage(allowed: PlatformRole[]): Promise<Staff> {
  const s = await getStaff();
  if (!s) redirect("/login");
  if (!allowed.includes(s.role)) redirect(s.role === "VIEWER" ? "/admin" : "/admin");
  return s;
}

export const ALL_STAFF: PlatformRole[] = ["OWNER", "SUPPORT", "VIEWER"];
export const SUPPORT_STAFF: PlatformRole[] = ["OWNER", "SUPPORT"];
export const OWNER_ONLY: PlatformRole[] = ["OWNER"];

type Db = Prisma.TransactionClient | typeof prisma;

/** Append-only staff activity log. Each entry's hash chains over the previous one. */
export async function staffAudit(db: Db, s: Staff, a: { action: string; targetType: string; targetId: string; workspaceId?: string | null; summary: string; metadata?: Prisma.InputJsonValue }) {
  const prev = await db.staffAudit.findFirst({ orderBy: { createdAt: "desc" }, select: { hash: true } });
  const createdAt = new Date();
  const hash = keyedHash({ prev: prev?.hash ?? "GENESIS", workspaceId: s.id, actionType: a.action, targetType: a.targetType, targetId: a.targetId, summary: a.summary, createdAt });
  return db.staffAudit.create({ data: { staffUserId: s.id, staffName: s.name, action: a.action, targetType: a.targetType, targetId: a.targetId, workspaceId: a.workspaceId ?? null, summary: a.summary, metadata: a.metadata ?? {}, hash, createdAt } });
}
