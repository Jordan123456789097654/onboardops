import { createHash } from "crypto";
import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

/** The relying-party id is the site's own domain (APP_URL host, without www). Passkeys are tied to it and cannot be used on a look-alike site. */
export function rpId(): string {
  try { return new URL(process.env.APP_URL || "http://localhost:3000").hostname.toLowerCase().replace(/^www\./, ""); } catch { return "localhost"; }
}
export const RP_NAME = "OnboardOps";

/** Accepts only requests from our own origin (the main domain, www, or a subdomain of it). */
export function expectedOrigins(): string[] {
  const id = rpId();
  const origin = headers().get("origin");
  if (!origin) throw new Error("Passkeys need a normal browser request.");
  let u: URL;
  try { u = new URL(origin); } catch { throw new Error("Passkeys need a normal browser request."); }
  const h = u.hostname.toLowerCase();
  const local = id === "localhost";
  const okHost = h === id || h === `www.${id}` || h.endsWith(`.${id}`);
  if (!okHost || (!local && u.protocol !== "https:")) throw new Error("This page cannot use passkeys.");
  return [origin];
}

const key = () => new TextEncoder().encode(createHash("sha256").update(`passkey-challenge:${process.env.SESSION_SECRET || "dev-only-secret-change-me-please-32chars"}`).digest("hex"));
const COOKIE = "oo_pk";

/** The one-time challenge travels in a signed, short-lived, HttpOnly cookie so nothing needs to be stored. */
export async function setChallenge(challenge: string, purpose: "register" | "login", userId?: string) {
  const token = await new SignJWT({ c: challenge, p: purpose, ...(userId ? { u: userId } : {}) }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m").sign(key());
  cookies().set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 300 });
}

/** Reads and clears the challenge. It can be used once. */
export async function takeChallenge(purpose: "register" | "login"): Promise<{ challenge: string; userId?: string }> {
  const raw = cookies().get(COOKIE)?.value;
  cookies().delete(COOKIE);
  if (!raw) throw new Error("That took too long. Please try again.");
  try {
    const { payload } = await jwtVerify(raw, key());
    if (payload.p !== purpose || typeof payload.c !== "string") throw new Error("bad");
    return { challenge: payload.c, userId: typeof payload.u === "string" ? payload.u : undefined };
  } catch {
    throw new Error("That took too long. Please try again.");
  }
}

export const toB64u = (b: Uint8Array) => Buffer.from(b).toString("base64url");
export const fromB64u = (s: string) => new Uint8Array(Buffer.from(s, "base64url"));
