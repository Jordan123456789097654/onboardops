import { KEYED_SINCE, keyedHash, legacyHash } from "./audit-hash";
import { prisma } from "./prisma";

/** Recomputes the hash chain for a workspace, oldest first. Returns where it first breaks, if anywhere. */
export async function verifyAuditChain(workspaceId: string) {
  const rows = await prisma.auditLog.findMany({ where: { workspaceId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  let prev = "GENESIS";
  for (let i = 0; i < rows.length; i++) {
    const a = rows[i];
    const parts = { prev, workspaceId: a.workspaceId, actionType: a.actionType, targetType: a.targetType, targetId: a.targetId, summary: a.summary, createdAt: a.createdAt };
    const ok = keyedHash(parts) === a.hash || (a.createdAt < KEYED_SINCE && legacyHash(parts) === a.hash);
    if (!ok) return { ok: false as const, total: rows.length, brokenAt: i + 1, entryId: a.id, at: a.createdAt.toISOString() };
    prev = a.hash;
  }
  return { ok: true as const, total: rows.length, head: prev };
}

/** Same check for the staff-console log, which is one global chain keyed on the staff member's id. */
export async function verifyStaffAuditChain() {
  const rows = await prisma.staffAudit.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  let prev = "GENESIS";
  for (let i = 0; i < rows.length; i++) {
    const a = rows[i];
    const parts = { prev, workspaceId: a.staffUserId, actionType: a.action, targetType: a.targetType, targetId: a.targetId, summary: a.summary, createdAt: a.createdAt };
    const ok = keyedHash(parts) === a.hash || (a.createdAt < KEYED_SINCE && legacyHash(parts) === a.hash);
    if (!ok) return { ok: false as const, total: rows.length, brokenAt: i + 1, entryId: a.id, at: a.createdAt.toISOString() };
    prev = a.hash;
  }
  return { ok: true as const, total: rows.length, head: prev };
}
