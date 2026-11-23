import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "crypto";

/** Keyed digest (HMAC-SHA256) for values that must be matched but never read back, such as backup codes. The key never leaves the server. */
export function keyedDigest(purpose: string, value: string): string {
  return createHmac("sha256", key()).update(`${purpose}\0${value}`).digest("hex");
}

/** Encrypts customer-supplied credentials (such as their SMS auth token) before they are stored. AES-256-GCM. */
function key() {
  const k = process.env.SECRETS_KEY || process.env.AUDIT_HMAC_KEY || process.env.SESSION_SECRET;
  if (!k && process.env.NODE_ENV === "production") throw new Error("SECRETS_KEY is not set.");
  return createHash("sha256").update(k || "dev-only-secrets-key-change-me-please").digest();
}

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function open(sealed: string): string | null {
  try {
    const [iv, tag, enc] = sealed.split(".").map((p) => Buffer.from(p, "base64"));
    const d = createDecipheriv("aes-256-gcm", key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
