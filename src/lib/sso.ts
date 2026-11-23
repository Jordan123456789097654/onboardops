import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify, createRemoteJWKSet } from "jose";
import { prisma } from "./prisma";
import { open } from "./secret-box";
import { findUserByAnyEmail } from "./user-emails";
import { OAuthError } from "./oauth";

/**
 * Per-workspace single sign-on over OpenID Connect (Google Workspace, Microsoft Entra ID).
 * It only ever signs in a person who ALREADY has an account and a membership in that workspace. It never creates users and never grants access because of a domain.
 */

export type SsoProvider = "google" | "entra";
export const SSO_PROVIDERS: SsoProvider[] = ["google", "entra"];
export const ssoLabel: Record<SsoProvider, string> = { google: "Google Workspace", entra: "Microsoft Entra ID" };
export const SSO_COOKIE = "oo_sso";
export const SSO_TTL_SECONDS = 600;

export const SSO_ERRORS: Record<string, string> = {
  state: "That single sign-on attempt took too long or did not start here. Please try again.",
  denied: "Sign-in was cancelled or refused by your identity provider.",
  exchange: "We could not finish signing you in with your company identity provider. Try again in a minute, or use your password if you have one.",
  not_configured: "Single sign-on is not set up for that address.",
  not_member: "Your company account signed in, but you have not been added to this workspace. Ask a workspace admin to invite you.",
  wrong_domain: "That account is not on a domain this workspace allows for single sign-on.",
  no_email: "Your identity provider did not share an email address, so we cannot match you to an account.",
  email_unverified: "Your identity provider has not verified that email address.",
  maintenance: "OnboardOps is under maintenance right now. Please try again shortly.",
  rate: "Too many attempts. Wait a few minutes and try again.",
  session: "Sign in as the workspace owner first, then run the test.",
  down: "Your company's single sign-on is not working right now. If you have a password, use \"Use password instead\".",
};

// Free mail providers can never be claimed as a company domain.
const FREE_MAIL = new Set(["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "yahoo.com", "ymail.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "mail.com", "zoho.com", "yandex.com", "example.com"]);

/** Turns "acme.com, Sub.Acme.com" into a clean list. Throws a message a person can act on. */
export function parseDomains(input: string): string[] {
  const out: string[] = [];
  for (const raw of input.split(/[\s,;]+/)) {
    const d = raw.trim().toLowerCase().replace(/^@/, "");
    if (!d) continue;
    if (!/^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(d)) throw new Error(`"${raw}" is not a valid domain.`);
    if (FREE_MAIL.has(d)) throw new Error(`${d} is a public email provider and cannot be used for single sign-on.`);
    if (!out.includes(d)) out.push(d);
  }
  if (!out.length) throw new Error("Enter at least one email domain, such as acme.com.");
  if (out.length > 10) throw new Error("Use at most 10 domains.");
  return out;
}

export const isTenantId = (t: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t);

const mock = () => (process.env.NODE_ENV !== "production" ? process.env.OAUTH_MOCK_BASE : undefined);
type Cfg = { provider: string; tenantId: string | null };
function endpoints(c: Cfg) {
  const m = mock();
  if (c.provider === "google") return { auth: m ? `${m}/sso/google/authorize` : "https://accounts.google.com/o/oauth2/v2/auth", token: m ? `${m}/sso/google/token` : "https://oauth2.googleapis.com/token", jwks: m ? `${m}/sso/google/jwks` : "https://www.googleapis.com/oauth2/v3/certs", issuers: ["https://accounts.google.com", "accounts.google.com"] };
  const t = c.tenantId ?? "";
  if (!isTenantId(t)) throw new OAuthError("not_configured");
  const base = `https://login.microsoftonline.com/${t}`;
  return { auth: m ? `${m}/sso/entra/authorize` : `${base}/oauth2/v2.0/authorize`, token: m ? `${m}/sso/entra/token` : `${base}/oauth2/v2.0/token`, jwks: m ? `${m}/sso/entra/jwks` : `${base}/discovery/v2.0/keys`, issuers: [`https://login.microsoftonline.com/${t}/v2.0`] };
}

export const ssoRedirectUri = () => `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/api/auth/sso/callback`;

/* ---------------- Which workspace an email belongs to ---------------- */

export const emailDomain = (email: string) => email.trim().toLowerCase().split("@")[1] ?? "";

/** The enabled SSO configuration for an email's domain, if any. */
export async function ssoForEmail(email: string) {
  const d = emailDomain(email);
  if (!d) return null;
  const row = await prisma.ssoDomain.findUnique({ where: { domain: d } });
  if (!row) return null;
  const config = await prisma.workspaceSso.findUnique({ where: { workspaceId: row.workspaceId } });
  return config && config.enabled ? config : null;
}

/** True when this person must use SSO and cannot sign in with a password. Owners can always use a password, so a broken identity provider cannot lock everyone out. */
export async function ssoRequiredFor(email: string): Promise<{ workspaceId: string } | null> {
  const cfg = await ssoForEmail(email);
  if (!cfg || !cfg.enforce) return null;
  const user = await findUserByAnyEmail(email);
  if (!user) return null;
  const m = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: cfg.workspaceId, userId: user.id } } });
  return m && m.role !== "OWNER" ? { workspaceId: cfg.workspaceId } : null;
}

/* ---------------- Signed state ---------------- */

export type SsoFlow = { wsId: string; state: string; nonce: string; verifier: string; test?: boolean; uid?: string; hint?: string };
const key = () => new TextEncoder().encode(createHash("sha256").update(`sso-state:${process.env.SESSION_SECRET || "dev-only-secret-change-me-please-32chars"}`).digest("hex"));
const b64 = (b: Buffer) => b.toString("base64url");
export const newSsoFlow = (wsId: string, extra: Partial<SsoFlow> = {}): SsoFlow => ({ wsId, state: b64(randomBytes(32)), nonce: b64(randomBytes(24)), verifier: b64(randomBytes(48)), ...extra });
export const signSsoFlow = (f: SsoFlow) => new SignJWT({ purpose: "sso", ...f }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${SSO_TTL_SECONDS}s`).sign(key());
export async function verifySsoFlow(t: string | undefined | null): Promise<SsoFlow | null> {
  if (!t) return null;
  try {
    const { payload } = await jwtVerify(t, key());
    if (payload.purpose !== "sso" || typeof payload.wsId !== "string") return null;
    const { purpose: _p, iat: _i, exp: _e, ...f } = payload as Record<string, unknown>;
    return f as unknown as SsoFlow;
  } catch { return null; }
}
export const ssoStateMatches = (a: string | null | undefined, b: string) => !!a && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function ssoAuthUrl(cfg: { provider: string; clientId: string; tenantId: string | null; domains: string[] }, f: SsoFlow): string {
  const u = new URL(endpoints(cfg).auth);
  const q = u.searchParams;
  q.set("client_id", cfg.clientId); q.set("redirect_uri", ssoRedirectUri()); q.set("response_type", "code");
  q.set("scope", "openid email profile"); q.set("state", f.state); q.set("nonce", f.nonce);
  q.set("code_challenge", b64(createHash("sha256").update(f.verifier).digest())); q.set("code_challenge_method", "S256");
  if (f.hint) q.set("login_hint", f.hint);
  if (cfg.provider === "google" && cfg.domains[0]) q.set("hd", cfg.domains[0]);
  q.set("prompt", "select_account");
  return u.toString();
}

/* ---------------- Identity ---------------- */

export type SsoProfile = { issuer: string; subject: string; email: string; name: string };
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const jwks = (url: string) => { let j = jwksCache.get(url); if (!j) { j = createRemoteJWKSet(new URL(url), { timeoutDuration: 8000 }); jwksCache.set(url, j); } return j; };

export async function ssoProfile(cfg: { provider: string; clientId: string; clientSecretEnc: string; tenantId: string | null; domains: string[] }, code: string, f: SsoFlow): Promise<SsoProfile> {
  const ep = endpoints(cfg);
  const secret = open(cfg.clientSecretEnc);
  if (!secret) throw new OAuthError("not_configured");
  try {
    const res = await fetch(ep.token, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, signal: AbortSignal.timeout(10_000), body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: cfg.clientId, client_secret: secret, redirect_uri: ssoRedirectUri(), code_verifier: f.verifier }) });
    const tok = (await res.json().catch(() => ({}))) as { id_token?: string };
    if (!res.ok || !tok.id_token) throw new OAuthError("exchange");
    const { payload } = await jwtVerify(tok.id_token, jwks(ep.jwks), { issuer: ep.issuers, audience: cfg.clientId });
    const c = payload as Record<string, unknown>;
    if (c.nonce !== f.nonce) throw new OAuthError("exchange");
    if (cfg.provider === "entra" && c.tid !== cfg.tenantId?.toLowerCase() && String(c.tid).toLowerCase() !== cfg.tenantId?.toLowerCase()) throw new OAuthError("exchange");
    const sub = typeof c.sub === "string" ? c.sub : typeof c.oid === "string" ? c.oid : "";
    const email = String(c.email ?? c.preferred_username ?? "").trim().toLowerCase();
    if (!sub) throw new OAuthError("exchange");
    if (!email || !email.includes("@")) throw new OAuthError("no_email");
    if (cfg.provider === "google") {
      if (c.email_verified !== true && c.email_verified !== "true") throw new OAuthError("email_unverified");
      // A Google Workspace account carries its domain in `hd`; a consumer account does not. Require it to match.
      if (typeof c.hd !== "string" || !cfg.domains.includes(c.hd.toLowerCase())) throw new OAuthError("wrong_domain");
    }
    if (!cfg.domains.includes(emailDomain(email))) throw new OAuthError("wrong_domain");
    return { issuer: ep.issuers[0], subject: sub, email, name: typeof c.name === "string" && c.name.trim() ? c.name.trim() : email.split("@")[0] };
  } catch (e) {
    if (e instanceof OAuthError) throw e;
    throw new OAuthError("exchange");
  }
}

export type SsoResolution = { kind: "signin"; userId: string; linked: boolean } | { kind: "not-member" };

/** Only an existing member of this workspace is let in. A stored identity is matched on the provider's stable subject; the first time, on the email. */
export async function resolveSso(workspaceId: string, p: SsoProfile): Promise<SsoResolution> {
  const ident = await prisma.ssoIdentity.findUnique({ where: { workspaceId_issuer_subject: { workspaceId, issuer: p.issuer, subject: p.subject } } });
  if (ident) {
    const m = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: ident.userId } } });
    return m ? { kind: "signin", userId: ident.userId, linked: false } : { kind: "not-member" };
  }
  const user = await findUserByAnyEmail(p.email);
  if (!user) return { kind: "not-member" };
  const m = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: user.id } } });
  if (!m) return { kind: "not-member" };
  // This person already has a different identity at the provider: refuse rather than silently adding a second one.
  if (await prisma.ssoIdentity.findFirst({ where: { workspaceId, userId: user.id } })) return { kind: "not-member" };
  await prisma.ssoIdentity.create({ data: { userId: user.id, workspaceId, issuer: p.issuer, subject: p.subject } });
  return { kind: "signin", userId: user.id, linked: true };
}
