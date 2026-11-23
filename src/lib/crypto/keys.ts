import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { basePrisma } from "../prisma-base";
import { open } from "../secret-box";

/**
 * Envelope encryption. Every workspace has its own random 256-bit data key. That key is stored only in locked form
 * (AES-256-GCM, wrapped with a master key that lives in the DATA_MASTER_KEY environment variable). The database never
 * holds a usable key, and deleting a workspace deletes its key, which makes its encrypted data unrecoverable.
 */
const toKey = (raw: string) => (/^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : createHash("sha256").update(raw).digest());

function masterKeys(): Buffer[] {
  const cur = process.env.DATA_MASTER_KEY?.trim();
  const old = process.env.DATA_MASTER_KEY_OLD?.trim();
  if (!cur) {
    if (process.env.NODE_ENV === "production") throw new Error("DATA_MASTER_KEY is not set.");
    return [toKey("dev-only-data-master-key-change-me-please-32")];
  }
  return [toKey(cur), ...(old ? [toKey(old)] : [])];
}

export function wrapDek(dek: Buffer, master = masterKeys()[0]): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", master, iv);
  c.setAAD(Buffer.from("dek"));
  const ct = Buffer.concat([c.update(dek), c.final()]);
  return `v1.${[iv, c.getAuthTag(), ct].map((b) => b.toString("base64")).join(".")}`;
}

export function unwrapDek(wrapped: string, masters = masterKeys()): Buffer {
  const [v, a, b, c] = wrapped.split(".");
  if (v !== "v1" || !a || !b || !c) throw new Error("Unreadable workspace key.");
  for (const m of masters) {
    try {
      const d = createDecipheriv("aes-256-gcm", m, Buffer.from(a, "base64"));
      d.setAAD(Buffer.from("dek"));
      d.setAuthTag(Buffer.from(b, "base64"));
      return Buffer.concat([d.update(Buffer.from(c, "base64")), d.final()]);
    } catch { /* try the next master key */ }
  }
  throw new Error("The master key does not unlock this workspace key.");
}

/** Thrown when a workspace uses a customer-supplied key and that key has been revoked. Its records cannot be read or written until the owner provides it again. */
export class KeyRevokedError extends Error {
  constructor() { super("This workspace's encryption key was revoked. The owner must provide the key again to unlock its records."); this.name = "KeyRevokedError"; }
}

/** Wraps the workspace data key with a customer-supplied 256-bit key. Format c1.<iv>.<tag>.<ciphertext>. */
export function wrapWithCustomerKey(dek: Buffer, kek: Buffer): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", kek, iv);
  c.setAAD(Buffer.from("dek-cmk"));
  const ct = Buffer.concat([c.update(dek), c.final()]);
  return `c1.${[iv, c.getAuthTag(), ct].map((b) => b.toString("base64")).join(".")}`;
}

/** Throws if the key is not the one that wrapped this data key (the GCM tag proves it). */
export function unwrapWithCustomerKey(wrapped: string, kek: Buffer): Buffer {
  const [v, a, b, c] = wrapped.split(".");
  if (v !== "c1" || !a || !b || !c) throw new Error("Unreadable workspace key.");
  const d = createDecipheriv("aes-256-gcm", kek, Buffer.from(a, "base64"));
  d.setAAD(Buffer.from("dek-cmk"));
  d.setAuthTag(Buffer.from(b, "base64"));
  return Buffer.concat([d.update(Buffer.from(c, "base64")), d.final()]);
}

export const isCustomerWrapped = (wrapped: string | null | undefined) => !!wrapped && wrapped.startsWith("c1.");

const cache = new Map<string, { key: Buffer; exp: number }>();
const TTL = 10 * 60 * 1000;
/** Workspaces with their own key keep the data key in memory only briefly, so revoking takes effect within seconds. */
const CMK_TTL = 30 * 1000;

/** The data key for a workspace. Created the first time it is needed. */
export async function getDek(workspaceId: string): Promise<Buffer> {
  const hit = cache.get(workspaceId);
  if (hit && hit.exp > Date.now()) return hit.key;
  let row = await basePrisma.workspace.findUnique({ where: { id: workspaceId }, select: { dataKeyEnc: true } });
  if (!row) throw new Error("Workspace not found for encryption.");
  if (!row.dataKeyEnc) {
    // Only one writer wins if two requests race; both then read the winner's key.
    await basePrisma.workspace.updateMany({ where: { id: workspaceId, dataKeyEnc: null }, data: { dataKeyEnc: wrapDek(randomBytes(32)) } });
    row = await basePrisma.workspace.findUnique({ where: { id: workspaceId }, select: { dataKeyEnc: true } });
  }
  if (!row?.dataKeyEnc) throw new Error("Could not create a workspace key.");
  if (isCustomerWrapped(row.dataKeyEnc)) {
    const cmk = await basePrisma.workspaceCmk.findUnique({ where: { workspaceId } });
    const kek = cmk && cmk.status === "ACTIVE" && cmk.kekSealed ? open(cmk.kekSealed) : null;
    if (!kek) { cache.delete(workspaceId); throw new KeyRevokedError(); }
    let dek: Buffer;
    try { dek = unwrapWithCustomerKey(row.dataKeyEnc, Buffer.from(kek, "base64")); } catch { cache.delete(workspaceId); throw new KeyRevokedError(); }
    cache.set(workspaceId, { key: dek, exp: Date.now() + CMK_TTL });
    return dek;
  }
  const key = unwrapDek(row.dataKeyEnc);
  cache.set(workspaceId, { key, exp: Date.now() + TTL });
  return key;
}

export const forgetDek = (workspaceId: string) => { cache.delete(workspaceId); };
