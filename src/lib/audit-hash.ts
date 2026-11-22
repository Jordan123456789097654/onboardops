import { createHash, createHmac } from "crypto";

/** Entries written before this moment used a plain SHA-256 hash. Everything after must be keyed (HMAC). */
export const KEYED_SINCE = new Date("2026-11-22T00:43:23.000Z");

function key() {
  const k = process.env.AUDIT_HMAC_KEY || process.env.SESSION_SECRET;
  if (!k && process.env.NODE_ENV === "production") throw new Error("AUDIT_HMAC_KEY is not set.");
  return k || "dev-only-audit-key-change-me-please-32chars";
}

export type HashParts = { prev: string; workspaceId: string; actionType: string; targetType: string; targetId: string; summary: string; createdAt: Date };
const payload = (p: HashParts) => [p.prev, p.workspaceId, p.actionType, p.targetType, p.targetId, p.summary, p.createdAt.toISOString()].join("|");

/** Keyed hash: someone with database write access but not the key cannot recompute the chain. */
export const keyedHash = (p: HashParts) => createHmac("sha256", key()).update(payload(p)).digest("hex");
export const legacyHash = (p: HashParts) => createHash("sha256").update(payload(p)).digest("hex");
