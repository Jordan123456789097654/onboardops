import { createHash } from "crypto";
import { SignJWT, jwtVerify } from "jose";

/**
 * The short-lived "password was right, second factor still needed" token.
 * It is signed with its own key and uses the claim `u` (not `uid`), so it can never be accepted as a session even if someone copies it into the session cookie.
 */
const key = () => new TextEncoder().encode(createHash("sha256").update(`mfa-pending:${process.env.SESSION_SECRET || "dev-only-secret-change-me-please-32chars"}`).digest("hex"));

export type MfaPending = {
  u: string;
  /** The workspace being signed in to, when known. */
  ws?: string;
  /** True when the workspace requires 2FA and this person has not set it up yet. */
  enroll?: boolean;
  method: "password" | "magic" | "reset" | "staff" | "sso";
};

export const MFA_COOKIE = "oo_mfa";
export const MFA_TTL_SECONDS = 300;

export async function signMfaPending(p: MfaPending): Promise<string> {
  return new SignJWT({ purpose: "mfa", ...p }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${MFA_TTL_SECONDS}s`).sign(key());
}

export async function verifyMfaPending(token: string | undefined | null): Promise<MfaPending | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (payload.purpose !== "mfa" || typeof payload.u !== "string") return null;
    return { u: payload.u, ws: typeof payload.ws === "string" ? payload.ws : undefined, enroll: payload.enroll === true, method: (payload.method as MfaPending["method"]) ?? "password" };
  } catch {
    return null;
  }
}
