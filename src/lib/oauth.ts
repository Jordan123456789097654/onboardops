import { createHash, randomBytes, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify, createRemoteJWKSet } from "jose";
import { prisma } from "./prisma";
import { findUserByAnyEmail } from "./user-emails";
import { writeAudit } from "./audit";
import { slugify } from "./utils";

/**
 * Google and GitHub sign-in (OAuth 2.0 authorization code flow with PKCE and a CSRF `state`).
 * Sign-in always matches on the provider's stable account id. An email is used only to link a provider to an existing account,
 * and only when both the provider and our own record say the address is verified.
 */

export type Provider = "google" | "github";
export const PROVIDERS: Provider[] = ["google", "github"];
export const providerLabel: Record<Provider, string> = { google: "Google", github: "GitHub" };
export const parseProvider = (s: string): Provider | null => (PROVIDERS as string[]).includes(s) ? (s as Provider) : null;

export const OAUTH_COOKIE = "oo_oauth";
export const OAUTH_TTL_SECONDS = 600;

const creds = (p: Provider) => (p === "google" ? { id: process.env.GOOGLE_CLIENT_ID, secret: process.env.GOOGLE_CLIENT_SECRET } : { id: process.env.GITHUB_CLIENT_ID, secret: process.env.GITHUB_CLIENT_SECRET });
export const isConfigured = (p: Provider) => !!(creds(p).id && creds(p).secret);
export const configuredProviders = () => PROVIDERS.filter(isConfigured);

/** Endpoints are fixed. Only outside production can a mock provider be substituted, so tests run without real credentials. */
const mock = () => (process.env.NODE_ENV !== "production" ? process.env.OAUTH_MOCK_BASE : undefined);
const urls = (p: Provider) => {
  const m = mock();
  return p === "google"
    ? { auth: m ? `${m}/google/authorize` : "https://accounts.google.com/o/oauth2/v2/auth", token: m ? `${m}/google/token` : "https://oauth2.googleapis.com/token", jwks: m ? `${m}/google/jwks` : "https://www.googleapis.com/oauth2/v3/certs", api: "" }
    : { auth: m ? `${m}/github/authorize` : "https://github.com/login/oauth/authorize", token: m ? `${m}/github/token` : "https://github.com/login/oauth/access_token", jwks: "", api: m ? `${m}/github/api` : "https://api.github.com" };
};

export const redirectUri = (p: Provider) => `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/api/auth/oauth/${p}/callback`;

export class OAuthError extends Error {
  constructor(public code: string, message?: string) { super(message ?? code); }
}

/** What each ?oauth_error= code means, in words a person can act on. */
export const OAUTH_ERRORS: Record<string, string> = {
  denied: "You cancelled the sign-in, or the provider refused it. Try again, or use your email and password.",
  state: "That sign-in took too long or did not start here. Please try again.",
  not_configured: "That sign-in method is not available right now. Use your email and password.",
  exchange: "We could not finish signing you in with that provider. Please try again in a minute.",
  email_unverified: "That provider has not verified your email address, so we cannot use it. Verify it with them, or use your email and password.",
  no_email: "That provider did not give us an email address. Make an email on your account visible to apps, or use your email and password.",
  no_account: "There is no OnboardOps account for that email yet. Create one below, then you can sign in with it.",
  unverified_conflict: "An account with that email already exists but its email has not been verified. Sign in with your password, verify your email, then connect the provider from Account settings.",
  link_conflict: "That provider account is already connected to a different OnboardOps account.",
  already_linked: "You already have a different account from that provider connected. Disconnect it first.",
  maintenance: "OnboardOps is under maintenance right now. Please try again shortly.",
  terms: "Tick the box to accept the Terms of Service and Privacy Policy first.",
  company: "Enter your company name first.",
  session: "Sign in first, then connect the provider.",
  rate: "Too many attempts. Wait a few minutes and try again.",
};

/* ---------------- Signed state (CSRF, PKCE verifier, nonce) kept in a short-lived cookie ---------------- */

export type OAuthFlow = {
  provider: Provider;
  mode: "login" | "signup" | "link";
  state: string;
  nonce: string;
  verifier: string;
  /** Link mode: the signed-in user who is connecting a provider. */
  uid?: string;
  /** Sign-up mode: what to create. */
  kind?: "OWNER" | "EMPLOYEE";
  company?: string;
  ref?: string;
  address?: string;
};

const stateKey = () => new TextEncoder().encode(createHash("sha256").update(`oauth-state:${process.env.SESSION_SECRET || "dev-only-secret-change-me-please-32chars"}`).digest("hex"));
const b64url = (b: Buffer) => b.toString("base64url");

export function newFlow(provider: Provider, mode: OAuthFlow["mode"], extra: Partial<Pick<OAuthFlow, "uid" | "kind" | "company" | "ref" | "address">> = {}): OAuthFlow {
  return { provider, mode, state: b64url(randomBytes(32)), nonce: b64url(randomBytes(24)), verifier: b64url(randomBytes(48)), ...extra };
}

export async function signFlow(f: OAuthFlow): Promise<string> {
  return new SignJWT({ purpose: "oauth", ...f }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${OAUTH_TTL_SECONDS}s`).sign(stateKey());
}

export async function verifyFlow(token: string | undefined | null): Promise<OAuthFlow | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, stateKey());
    if (payload.purpose !== "oauth" || !parseProvider(String(payload.provider))) return null;
    const { purpose: _p, iat: _i, exp: _e, ...flow } = payload as Record<string, unknown>;
    return flow as unknown as OAuthFlow;
  } catch {
    return null;
  }
}

export const stateMatches = (a: string | null | undefined, b: string) => !!a && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function authorizationUrl(f: OAuthFlow): string {
  const c = creds(f.provider);
  if (!c.id) throw new OAuthError("not_configured");
  const u = new URL(urls(f.provider).auth);
  const q = u.searchParams;
  q.set("client_id", c.id);
  q.set("redirect_uri", redirectUri(f.provider));
  q.set("state", f.state);
  q.set("code_challenge", b64url(createHash("sha256").update(f.verifier).digest()));
  q.set("code_challenge_method", "S256");
  if (f.provider === "google") {
    q.set("response_type", "code");
    q.set("scope", "openid email profile");
    q.set("nonce", f.nonce);
    q.set("prompt", "select_account");
  } else {
    q.set("scope", "read:user user:email");
    q.set("allow_signup", "true");
  }
  return u.toString();
}

/* ---------------- Profile ---------------- */

export type Profile = { provider: Provider; id: string; email: string; name: string };

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const jwks = (url: string) => { let j = jwksCache.get(url); if (!j) { j = createRemoteJWKSet(new URL(url), { timeoutDuration: 8000 }); jwksCache.set(url, j); } return j; };
const timeout = () => AbortSignal.timeout(10_000);

async function googleProfile(code: string, f: OAuthFlow): Promise<Profile> {
  const c = creds("google"); const u = urls("google");
  const res = await fetch(u.token, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body: new URLSearchParams({ code, client_id: c.id!, client_secret: c.secret!, redirect_uri: redirectUri("google"), grant_type: "authorization_code", code_verifier: f.verifier }), signal: timeout() });
  const body = (await res.json().catch(() => ({}))) as { id_token?: string };
  if (!res.ok || !body.id_token) throw new OAuthError("exchange");
  let claims: Record<string, unknown>;
  try {
    const { payload } = await jwtVerify(body.id_token, jwks(u.jwks), { issuer: ["https://accounts.google.com", "accounts.google.com"], audience: c.id! });
    claims = payload as Record<string, unknown>;
  } catch {
    throw new OAuthError("exchange");
  }
  if (claims.nonce !== f.nonce) throw new OAuthError("exchange");
  const sub = typeof claims.sub === "string" ? claims.sub : "";
  const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  if (!sub) throw new OAuthError("exchange");
  if (!email) throw new OAuthError("no_email");
  if (claims.email_verified !== true && claims.email_verified !== "true") throw new OAuthError("email_unverified");
  return { provider: "google", id: sub, email, name: typeof claims.name === "string" && claims.name.trim() ? claims.name.trim() : email.split("@")[0] };
}

async function githubProfile(code: string, f: OAuthFlow): Promise<Profile> {
  const c = creds("github"); const u = urls("github");
  const res = await fetch(u.token, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body: new URLSearchParams({ code, client_id: c.id!, client_secret: c.secret!, redirect_uri: redirectUri("github"), code_verifier: f.verifier }), signal: timeout() });
  const tok = (await res.json().catch(() => ({}))) as { access_token?: string };
  if (!res.ok || !tok.access_token) throw new OAuthError("exchange");
  const headers = { authorization: `Bearer ${tok.access_token}`, accept: "application/vnd.github+json", "user-agent": "OnboardOps", "x-github-api-version": "2022-11-28" };
  const [ur, er] = await Promise.all([fetch(`${u.api}/user`, { headers, signal: timeout() }), fetch(`${u.api}/user/emails`, { headers, signal: timeout() })]);
  if (!ur.ok) throw new OAuthError("exchange");
  const user = (await ur.json().catch(() => ({}))) as { id?: number | string; login?: string; name?: string | null };
  if (user.id === undefined || user.id === null) throw new OAuthError("exchange");
  // The profile email can be hidden (private). /user/emails lists every address with its verified flag; only a verified one is acceptable.
  const emails = er.ok ? ((await er.json().catch(() => [])) as { email?: string; primary?: boolean; verified?: boolean }[]) : [];
  const list = Array.isArray(emails) ? emails.filter((e) => typeof e.email === "string") : [];
  if (!list.length) throw new OAuthError("no_email");
  const best = list.find((e) => e.primary && e.verified) ?? list.find((e) => e.verified);
  if (!best) throw new OAuthError("email_unverified");
  return { provider: "github", id: String(user.id), email: best.email!.trim().toLowerCase(), name: (user.name && user.name.trim()) || user.login || best.email!.split("@")[0] };
}

/** Exchanges the code and returns the verified profile. Throws OAuthError with a code the sign-in page can explain. */
export async function fetchProfile(provider: Provider, code: string, flow: OAuthFlow): Promise<Profile> {
  if (!isConfigured(provider)) throw new OAuthError("not_configured");
  try {
    return provider === "google" ? await googleProfile(code, flow) : await githubProfile(code, flow);
  } catch (e) {
    if (e instanceof OAuthError) throw e;
    throw new OAuthError("exchange");
  }
}

/* ---------------- Matching the profile to an account ---------------- */

export type Resolution =
  | { kind: "signin"; userId: string }
  | { kind: "linked-signin"; userId: string }
  | { kind: "created"; userId: string; workspaceId?: string; slug?: string }
  | { kind: "linked" }
  | { kind: "no-account" }
  | { kind: "unverified-conflict" }
  | { kind: "link-conflict" }
  | { kind: "already-linked" };

const randomPasswordHash = () => bcrypt.hash(randomBytes(32).toString("hex"), 10);

async function emailIsVerified(user: { email: string; emailVerifiedAt: Date | null; id: string }, email: string) {
  if (user.email.toLowerCase() === email) return !!user.emailVerifiedAt;
  return !!(await prisma.userEmail.findFirst({ where: { userId: user.id, email, verifiedAt: { not: null } }, select: { id: true } }));
}

export async function resolveOAuth(p: Profile, flow: OAuthFlow): Promise<Resolution> {
  const existing = await prisma.oAuthAccount.findUnique({ where: { provider_providerAccountId: { provider: p.provider, providerAccountId: p.id } } });

  if (flow.mode === "link") {
    if (!flow.uid) return { kind: "link-conflict" };
    if (existing) return existing.userId === flow.uid ? { kind: "linked" } : { kind: "link-conflict" };
    if (await prisma.oAuthAccount.findUnique({ where: { userId_provider: { userId: flow.uid, provider: p.provider } } })) return { kind: "already-linked" };
    await prisma.oAuthAccount.create({ data: { userId: flow.uid, provider: p.provider, providerAccountId: p.id, email: p.email } });
    return { kind: "linked" };
  }

  if (existing) {
    await prisma.oAuthAccount.update({ where: { id: existing.id }, data: { lastLoginAt: new Date(), email: p.email } });
    return { kind: "signin", userId: existing.userId };
  }

  const user = await findUserByAnyEmail(p.email);
  if (user) {
    // Never attach a provider to an account whose email nobody has verified: someone could have registered it first.
    if (!(await emailIsVerified(user, p.email))) return { kind: "unverified-conflict" };
    if (await prisma.oAuthAccount.findUnique({ where: { userId_provider: { userId: user.id, provider: p.provider } } })) return { kind: "already-linked" };
    await prisma.oAuthAccount.create({ data: { userId: user.id, provider: p.provider, providerAccountId: p.id, email: p.email, lastLoginAt: new Date() } });
    return { kind: "linked-signin", userId: user.id };
  }

  if (flow.mode !== "signup") return { kind: "no-account" };

  // New account. The provider already verified the email, so it is marked verified. The password is a random value nobody knows; the person can set one later.
  const passwordHash = await randomPasswordHash();
  const owner = flow.kind !== "EMPLOYEE" && !!flow.company;
  let slug = slugify(flow.company || "");
  if (owner && (await prisma.workspace.findUnique({ where: { slug } }))) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  const out = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({ data: { email: p.email, name: p.name, passwordHash, emailVerifiedAt: new Date() } });
    await tx.oAuthAccount.create({ data: { userId: u.id, provider: p.provider, providerAccountId: p.id, email: p.email, lastLoginAt: new Date() } });
    if (!owner) return { userId: u.id };
    const ws = await tx.workspace.create({ data: { name: flow.company!, slug } });
    const member = await tx.workspaceMember.create({ data: { workspaceId: ws.id, userId: u.id, role: "OWNER" } });
    await writeAudit(tx, { workspaceId: ws.id, actorMemberId: member.id, actorName: u.name, actionType: "WORKSPACE_CREATED", targetType: "Workspace", targetId: ws.id, summary: `Workspace "${ws.name}" created (signed up with ${providerLabel[p.provider]})` });
    await writeAudit(tx, { workspaceId: ws.id, actorMemberId: member.id, actorName: u.name, actionType: "TERMS_ACCEPTED", targetType: "User", targetId: u.id, summary: `${u.name} accepted the Terms of Service, Privacy Policy and Beta Program Terms (version 2026-11-21)` });
    return { userId: u.id, workspaceId: ws.id, slug };
  });
  return { kind: "created", ...out };
}

/* ---------------- Disconnecting ---------------- */

/** A provider can be disconnected only if the person can still sign in another way: a password, or another connected provider. */
export async function canUnlink(userId: string, provider: Provider): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [u, others] = await Promise.all([prisma.user.findUnique({ where: { id: userId }, select: { passwordSetAt: true } }), prisma.oAuthAccount.count({ where: { userId, provider: { not: provider } } })]);
  if (!u) return { ok: false, reason: "Account not found." };
  if (u.passwordSetAt || others > 0) return { ok: true };
  return { ok: false, reason: `${providerLabel[provider]} is the only way you can sign in. Set a password or connect another account first, then disconnect it.` };
}

/** Accounts created by a provider have a random password nobody knows. Used to stop the "first sign-in sets the password" path from claiming them. */
export async function hasOAuthAccount(userId: string): Promise<boolean> {
  return (await prisma.oAuthAccount.count({ where: { userId } })) > 0;
}
