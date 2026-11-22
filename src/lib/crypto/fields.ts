import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { getDek } from "./keys";

/** Text: enc1:<workspaceId>:<base64url(iv).base64url(tag).base64url(ciphertext)>. The workspace id is bound in as authenticated data. */
export const PREFIX = "enc1:";
const MAGIC = Buffer.from("OOENC1");
const b64 = (b: Buffer) => b.toString("base64url");

export const isEncryptedString = (v: unknown): v is string => typeof v === "string" && v.startsWith(PREFIX);
export const isEncryptedBytes = (v: unknown): v is Buffer => Buffer.isBuffer(v) && v.length > MAGIC.length + 1 + 28 && v.subarray(0, MAGIC.length).equals(MAGIC);

export async function encryptString(workspaceId: string, plain: string): Promise<string> {
  const key = await getDek(workspaceId);
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  c.setAAD(Buffer.from(workspaceId));
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `${PREFIX}${workspaceId}:${b64(iv)}.${b64(c.getAuthTag())}.${b64(ct)}`;
}

export async function decryptString(value: string): Promise<string> {
  const rest = value.slice(PREFIX.length);
  const i = rest.indexOf(":");
  const workspaceId = rest.slice(0, i);
  const [iv, tag, ct] = rest.slice(i + 1).split(".");
  const key = await getDek(workspaceId);
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  d.setAAD(Buffer.from(workspaceId));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}

/** JSON columns hold { $enc: "enc1:..." } so the column stays valid JSON. */
export const isEncryptedJson = (v: unknown): v is { $enc: string } => !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 1 && isEncryptedString((v as { $enc?: unknown }).$enc);
export async function encryptJson(workspaceId: string, value: unknown) { return { $enc: await encryptString(workspaceId, JSON.stringify(value)) }; }

/** Files: "OOENC1" + id length + workspace id + iv(12) + tag(16) + ciphertext. */
export async function encryptBytes(workspaceId: string, data: Buffer): Promise<Buffer> {
  const key = await getDek(workspaceId);
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  c.setAAD(Buffer.from(workspaceId));
  const ct = Buffer.concat([c.update(data), c.final()]);
  const id = Buffer.from(workspaceId);
  return Buffer.concat([MAGIC, Buffer.from([id.length]), id, iv, c.getAuthTag(), ct]);
}

export async function decryptBytes(buf: Buffer): Promise<Buffer> {
  const n = buf[MAGIC.length];
  const start = MAGIC.length + 1;
  const workspaceId = buf.subarray(start, start + n).toString();
  const iv = buf.subarray(start + n, start + n + 12);
  const tag = buf.subarray(start + n + 12, start + n + 28);
  const ct = buf.subarray(start + n + 28);
  const key = await getDek(workspaceId);
  const d = createDecipheriv("aes-256-gcm", key, iv);
  d.setAAD(Buffer.from(workspaceId));
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]);
}

const UNREADABLE = "[could not decrypt]";

/** Walks any query result and decrypts everything that is encrypted. Old plain values pass through unchanged. */
export async function deepDecrypt<T>(value: T): Promise<T> {
  const v = value as unknown;
  if (typeof v === "string") {
    if (!isEncryptedString(v)) return value;
    try { return (await decryptString(v)) as unknown as T; } catch (e) { console.error("decrypt failed", e instanceof Error ? e.message : e); return UNREADABLE as unknown as T; }
  }
  if (Buffer.isBuffer(v)) {
    if (!isEncryptedBytes(v)) return value;
    return (await decryptBytes(v)) as unknown as T;
  }
  if (Array.isArray(v)) return (await Promise.all(v.map((x) => deepDecrypt(x)))) as unknown as T;
  if (v && typeof v === "object") {
    if (isEncryptedJson(v)) {
      try { return JSON.parse(await decryptString(v.$enc)) as T; } catch (e) { console.error("decrypt failed", e instanceof Error ? e.message : e); return null as unknown as T; }
    }
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) return value; // Date, Decimal and similar
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = await deepDecrypt(x);
    return out as T;
  }
  return value;
}
