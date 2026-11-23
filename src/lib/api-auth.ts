import { createHash, randomUUID } from "crypto";
import { prisma } from "./prisma";
import { hit } from "./rate-limit";
import { getMaintenanceCached } from "./maintenance";
import { isWriteScope, type Scope } from "./api-scopes";
import type { Membership } from "./auth";
import { isWorkspaceLocked } from "./cmk";

/**
 * Bearer-token auth for /api/v1. Keys are stored only as SHA-256 hashes.
 * A key can do what its scopes allow AND what its creator's current role allows (a demoted or removed creator stops the key working).
 * Errors are { error, code, requestId } with a matching HTTP status.
 */

export type ApiAuth = {
  workspaceId: string;
  keyId: string;
  keyName: string;
  scopes: string[];
  requestId: string;
  /** The key creator's membership, with the name marked as acting through the key so audit entries show the real origin. */
  ctx: Membership;
};

export function apiError(status: number, code: string, message: string, requestId: string, details?: unknown, headers: Record<string, string> = {}) {
  return Response.json({ error: message, code, requestId, ...(details !== undefined ? { details } : {}) }, { status, headers: { "x-request-id": requestId, ...headers } });
}

export async function authApiKey(req: Request, opts: { scope?: Scope } = {}): Promise<ApiAuth | Response> {
  const requestId = randomUUID();
  const mt = await getMaintenanceCached().catch(() => null);
  if (mt && mt.enabled && mt.areas.includes("api")) {
    const wait = mt.endsAt && Date.parse(mt.endsAt) > Date.now() ? Math.ceil((Date.parse(mt.endsAt) - Date.now()) / 1000) : 600;
    return apiError(503, "maintenance", "The API is down for maintenance. Try again later.", requestId, undefined, { "Retry-After": String(Math.min(wait, 3600)) });
  }
  const m = /^Bearer (oo_live_[a-f0-9]{48})$/.exec(req.headers.get("authorization") ?? "");
  if (!m) return apiError(401, "missing_key", "Missing or malformed API key. Send Authorization: Bearer <key>.", requestId);
  const key = await prisma.apiKey.findUnique({ where: { keyHash: createHash("sha256").update(m[1]).digest("hex") } });
  if (!key || key.revokedAt) return apiError(401, "invalid_key", "Invalid or revoked API key.", requestId);
  if (key.expiresAt && key.expiresAt < new Date()) return apiError(401, "key_expired", "This API key has expired.", requestId);
  const wait = await hit(`api:${key.id}`, 120, 60);
  if (wait) return apiError(429, "rate_limited", "Rate limit exceeded (120 requests a minute).", requestId, undefined, { "Retry-After": String(wait) });
  if (opts.scope && !key.scopes.includes(opts.scope)) return apiError(403, "insufficient_scope", `This key does not have the "${opts.scope}" scope.`, requestId, { required: opts.scope, granted: key.scopes });
  if (opts.scope && isWriteScope(opts.scope)) {
    const w = await hit(`apiw:${key.id}`, 30, 60);
    if (w) return apiError(429, "rate_limited", "Write rate limit exceeded (30 writes a minute per key).", requestId, undefined, { "Retry-After": String(w) });
  }
  const member = key.createdByMemberId ? await prisma.workspaceMember.findFirst({ where: { id: key.createdByMemberId, workspaceId: key.workspaceId }, include: { workspace: true, user: true, profile: true, customRole: true } }) : null;
  if (!member) {
    // Keys made before scopes existed have no creator on record. They stay read-only and can still read.
    if (opts.scope && isWriteScope(opts.scope)) return apiError(403, "key_owner_missing", "The person who created this key is no longer a member of the workspace, so it cannot write.", requestId);
  }
  const ws = member?.workspace ?? (await prisma.workspace.findUnique({ where: { id: key.workspaceId } }));
  if (!ws || ws.suspendedAt) return apiError(403, "workspace_suspended", "This workspace is locked by OnboardOps.", requestId);
  if (await isWorkspaceLocked(ws)) return apiError(423, "workspace_locked", "This workspace's encryption key was revoked, so its records are locked.", requestId);
  if (member?.customRole) member.role = member.customRole.baseRole;
  if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > 5 * 60_000) await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  const ctx = (member ? { ...member, user: { ...member.user, name: `${member.user.name} via API key "${key.name}"` } } : null) as unknown as Membership;
  return { workspaceId: key.workspaceId, keyId: key.id, keyName: key.name, scopes: key.scopes, requestId, ctx };
}
