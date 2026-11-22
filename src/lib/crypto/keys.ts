import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { basePrisma } from "../prisma-base";

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

const cache = new Map<string, { key: Buffer; exp: number }>();
const TTL = 10 * 60 * 1000;

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
  const key = unwrapDek(row.dataKeyEnc);
  cache.set(workspaceId, { key, exp: Date.now() + TTL });
  return key;
}

export const forgetDek = (workspaceId: string) => { cache.delete(workspaceId); };
