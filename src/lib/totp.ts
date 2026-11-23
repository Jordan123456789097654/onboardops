import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/** RFC 6238 time-based one-time passwords (SHA-1, 6 digits, 30 second steps), compatible with Google Authenticator, Microsoft Authenticator, 1Password and Authy. */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const STEP_SECONDS = 30;

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.replace(/[\s=-]/g, "").toUpperCase();
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error("Invalid base32 secret.");
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

/** 160-bit random secret, base32 (32 characters), as authenticator apps expect. */
export function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

function hotp(secret: Buffer, counter: number, digits = 6): string {
  const msg = Buffer.alloc(8);
  msg.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  msg.writeUInt32BE(counter >>> 0, 4);
  const h = createHmac("sha1", secret).update(msg).digest();
  const off = h[h.length - 1] & 15;
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export const stepAt = (timeMs: number) => Math.floor(timeMs / 1000 / STEP_SECONDS);

/** The code an authenticator app would show at that time. Used by tests and by nothing else. */
export function totpAt(secretB32: string, timeMs: number, digits = 6): string {
  return hotp(base32Decode(secretB32), stepAt(timeMs), digits);
}

const safeEq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Checks a code against the current step and one step either side (clock drift).
 * A step at or below `lastStep` is refused, so a code that was already used cannot be used again.
 */
export function verifyTotp(secretB32: string, code: string, opts: { now?: number; window?: number; lastStep?: number | null } = {}): { ok: true; step: number } | { ok: false } {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return { ok: false };
  const secret = base32Decode(secretB32);
  const now = opts.now ?? Date.now();
  const window = opts.window ?? 1;
  const base = stepAt(now);
  let found: number | null = null;
  // Always check every step in the window so timing does not reveal which one matched.
  for (let off = -window; off <= window; off++) {
    const step = base + off;
    const match = safeEq(hotp(secret, step), clean);
    if (match && found === null && (opts.lastStep == null || step > opts.lastStep)) found = step;
  }
  return found === null ? { ok: false } : { ok: true, step: found };
}

export function otpauthUri(secretB32: string, account: string, issuer: string): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
}
