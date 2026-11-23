// Local check of Google and GitHub sign-in: state/CSRF token, PKCE URL, Google ID-token validation, GitHub private-email lookup,
// account matching and linking rules, and unlink safety. Uses a mock provider on localhost and the local database only.
// Run: DATA_MASTER_KEY=<any throwaway key> npx tsx scripts/oauth-selftest.mts
import http from "node:http";
import { generateKeyPair, exportJWK, SignJWT } from "jose";

const PORT = 4017, BASE = `http://localhost:${PORT}`;
process.env.OAUTH_MOCK_BASE = BASE;
process.env.GOOGLE_CLIENT_ID = "test-google-client"; process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";
process.env.GITHUB_CLIENT_ID = "test-github-client"; process.env.GITHUB_CLIENT_SECRET = "test-github-secret";
process.env.APP_URL = "https://app.example.test";

const unwrap = (m: any) => (m && m.default && !m.prisma && !m.resolveOAuth ? m.default : m);
const { prisma } = unwrap(await import("../src/lib/prisma.ts"));
const o = unwrap(await import("../src/lib/oauth.ts"));
if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) { console.error("Local database only."); process.exit(1); }
const ok = (n: string, c: boolean, extra = "") => { console.log(c ? "PASS" : "FAIL", n, extra); if (!c) process.exitCode = 1; };
const rejects = async (f: () => Promise<unknown>) => { try { await f(); return ""; } catch (e: any) { return e?.code ?? e?.message ?? "error"; } };

// ---- mock Google + GitHub ----
const good = await generateKeyPair("RS256"); const other = await generateKeyPair("RS256");
const goodJwk = { ...(await exportJWK(good.publicKey)), kid: "k1", alg: "RS256", use: "sig" };
let idClaims: Record<string, unknown> = {}; let signWith = good.privateKey; let ghUser: any = {}; let ghEmails: any = []; let ghUserStatus = 200;
let lastTokenBody = "";
const idToken = async () => { const { __exp, ...rest } = idClaims as any; return new SignJWT(rest).setProtectedHeader({ alg: "RS256", kid: "k1" }).setIssuedAt().setExpirationTime(typeof __exp === "number" ? __exp : "10m").sign(signWith); };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url!, BASE); let body = ""; for await (const c of req) body += c;
  const send = (code: number, j: unknown) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(j)); };
  if (url.pathname === "/google/jwks") return send(200, { keys: [goodJwk] });
  if (url.pathname === "/google/token") { lastTokenBody = body; return send(200, { id_token: await idToken(), access_token: "x" }); }
  if (url.pathname === "/github/token") { lastTokenBody = body; return send(200, { access_token: "gho_test" }); }
  if (url.pathname === "/github/api/user") return send(ghUserStatus, ghUser);
  if (url.pathname === "/github/api/user/emails") return send(200, ghEmails);
  send(404, {});
});
await new Promise<void>((r) => server.listen(PORT, r));

const flowG = () => o.newFlow("google", "signup", { kind: "EMPLOYEE" });
const flowH = () => o.newFlow("github", "signup", { kind: "EMPLOYEE" });
const googleClaims = (f: any, extra: Record<string, unknown> = {}) => ({ iss: "https://accounts.google.com", aud: "test-google-client", sub: "g-123", email: "Alice@Example.test", email_verified: true, name: "Alice Example", nonce: f.nonce, ...extra });

const made: string[] = [];
const cleanup = async () => {
  for (const email of made) await prisma.user.deleteMany({ where: { email } });
  await prisma.workspace.deleteMany({ where: { name: { startsWith: "OAuth Selftest Co" } } });
};

try {
  // ---- configuration and URL ----
  ok("providers are reported as configured", o.isConfigured("google") && o.isConfigured("github") && o.configuredProviders().length === 2);
  ok("an unknown provider name is rejected", o.parseProvider("facebook") === null && o.parseProvider("google") === "google");
  const f0 = flowG();
  const au = new URL(o.authorizationUrl(f0));
  ok("Google URL carries client id, redirect URI, state, nonce and S256 PKCE", au.searchParams.get("client_id") === "test-google-client" && au.searchParams.get("redirect_uri") === "https://app.example.test/api/auth/oauth/google/callback" && au.searchParams.get("state") === f0.state && au.searchParams.get("nonce") === f0.nonce && au.searchParams.get("code_challenge_method") === "S256" && (au.searchParams.get("code_challenge") ?? "").length === 43);
  ok("the PKCE verifier is never put in the URL", !au.toString().includes(f0.verifier));
  ok("Google scope is openid email profile", au.searchParams.get("scope") === "openid email profile");
  const hu = new URL(o.authorizationUrl(flowH()));
  ok("GitHub scope asks for the email list", hu.searchParams.get("scope") === "read:user user:email");

  // ---- state cookie (CSRF) ----
  const tok = await o.signFlow(f0);
  const back = await o.verifyFlow(tok);
  ok("a signed flow verifies and keeps its fields", back?.state === f0.state && back?.provider === "google" && back?.mode === "signup" && back?.verifier === f0.verifier);
  ok("a tampered flow cookie is rejected", (await o.verifyFlow(tok.slice(0, -4) + "AAAA")) === null);
  ok("an empty or missing flow cookie is rejected", (await o.verifyFlow(undefined)) === null && (await o.verifyFlow("")) === null);
  ok("state comparison: same passes, different fails", o.stateMatches(f0.state, f0.state) && !o.stateMatches("x" + f0.state.slice(1), f0.state) && !o.stateMatches(null, f0.state) && !o.stateMatches("short", f0.state));
  const sessionTok = await new SignJWT({ uid: "u1" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").sign(new TextEncoder().encode(process.env.SESSION_SECRET || "dev-only-secret-change-me-please-32chars"));
  ok("a session token is not accepted as an OAuth flow", (await o.verifyFlow(sessionTok)) === null);

  // ---- Google ID token validation ----
  let f = flowG(); idClaims = googleClaims(f); signWith = good.privateKey;
  let p = await o.fetchProfile("google", "code1", f);
  ok("Google: a valid ID token gives the profile (email lower-cased)", p.id === "g-123" && p.email === "alice@example.test" && p.name === "Alice Example" && p.provider === "google");
  ok("Google: the code verifier is sent in the token request", lastTokenBody.includes(`code_verifier=${f.verifier}`) && lastTokenBody.includes("client_secret=test-google-secret"));
  f = flowG(); idClaims = googleClaims(f, { aud: "someone-else" });
  ok("Google: wrong audience is rejected", (await rejects(() => o.fetchProfile("google", "c", f))) === "exchange");
  f = flowG(); idClaims = googleClaims(f, { iss: "https://evil.example" });
  ok("Google: wrong issuer is rejected", (await rejects(() => o.fetchProfile("google", "c", f))) === "exchange");
  f = flowG(); idClaims = googleClaims(f, { nonce: "not-the-nonce" });
  ok("Google: wrong nonce is rejected", (await rejects(() => o.fetchProfile("google", "c", f))) === "exchange");
  f = flowG(); idClaims = googleClaims(f, { __exp: Math.floor(Date.now() / 1000) - 3600 });
  ok("Google: expired token is rejected", (await rejects(() => o.fetchProfile("google", "c", f))) === "exchange");
  f = flowG(); idClaims = googleClaims(f); signWith = other.privateKey;
  ok("Google: a token signed with another key is rejected", (await rejects(() => o.fetchProfile("google", "c", f))) === "exchange");
  signWith = good.privateKey;
  f = flowG(); idClaims = googleClaims(f, { email_verified: false });
  ok("Google: unverified email is rejected", (await rejects(() => o.fetchProfile("google", "c", f))) === "email_unverified");
  f = flowG(); idClaims = googleClaims(f, { email: undefined });
  ok("Google: a missing email is rejected", (await rejects(() => o.fetchProfile("google", "c", f))) === "no_email");

  // ---- GitHub: private email via /user/emails ----
  f = flowH(); ghUser = { id: 4242, login: "octo", name: "Octo Cat", email: null };
  ghEmails = [{ email: "old@example.test", primary: false, verified: true }, { email: "Octo@Example.test", primary: true, verified: true }];
  p = await o.fetchProfile("github", "c", f);
  ok("GitHub: a private profile email is found through /user/emails (primary and verified)", p.id === "4242" && p.email === "octo@example.test" && p.name === "Octo Cat");
  ghEmails = [{ email: "a@example.test", primary: true, verified: false }, { email: "b@example.test", primary: false, verified: true }];
  p = await o.fetchProfile("github", "c", flowH());
  ok("GitHub: an unverified primary is skipped for a verified address", p.email === "b@example.test");
  ghEmails = [{ email: "a@example.test", primary: true, verified: false }];
  ok("GitHub: only unverified addresses is rejected", (await rejects(() => o.fetchProfile("github", "c", flowH()))) === "email_unverified");
  ghEmails = [];
  ok("GitHub: no addresses at all is rejected", (await rejects(() => o.fetchProfile("github", "c", flowH()))) === "no_email");
  ghEmails = [{ email: "a@example.test", primary: true, verified: true }]; ghUserStatus = 401;
  ok("GitHub: a failed profile call is rejected", (await rejects(() => o.fetchProfile("github", "c", flowH()))) === "exchange");
  ghUserStatus = 200;
  ghUser = { id: 7, login: "nameless", name: null };
  p = await o.fetchProfile("github", "c", flowH());
  ok("GitHub: falls back to the login when there is no display name", p.name === "nameless");

  // ---- account matching ----
  const stamp = Date.now();
  const mkProfile = (provider: string, id: string, email: string) => ({ provider, id, email, name: "Test Person" });
  const signupFlow = (provider: string, extra: any = {}) => o.newFlow(provider, "signup", { kind: "EMPLOYEE", ...extra });
  const loginFlow = (provider: string) => o.newFlow(provider, "login");

  const e1 = `oauth-new-${stamp}@example.test`; made.push(e1);
  ok("login with an unknown email creates nothing and says no-account", (await o.resolveOAuth(mkProfile("google", `g-${stamp}-1`, e1), loginFlow("google"))).kind === "no-account" && !(await prisma.user.findUnique({ where: { email: e1 } })));
  const created = await o.resolveOAuth(mkProfile("google", `g-${stamp}-1`, e1), signupFlow("google"));
  ok("sign-up with an unknown email creates a user", created.kind === "created");
  const nu = await prisma.user.findUniqueOrThrow({ where: { email: e1 } });
  ok("the new user's email is verified, there is no real password, and no workspace is made for an employee", !!nu.emailVerifiedAt && nu.passwordSetAt === null && nu.passwordHash.startsWith("$2") && (await prisma.workspaceMember.count({ where: { userId: nu.id } })) === 0);
  ok("the provider identity is stored against the user", (await prisma.oAuthAccount.count({ where: { userId: nu.id, provider: "google", providerAccountId: `g-${stamp}-1` } })) === 1);
  const again = await o.resolveOAuth(mkProfile("google", `g-${stamp}-1`, "changed-email@example.test"), loginFlow("google"));
  ok("signing in again matches on the provider id, even if the provider email changed", again.kind === "signin" && again.userId === nu.id);

  const e2 = `oauth-owner-${stamp}@example.test`; made.push(e2);
  const owner = await o.resolveOAuth(mkProfile("github", `h-${stamp}-2`, e2), signupFlow("github", { kind: "OWNER", company: `OAuth Selftest Co ${stamp}` }));
  ok("owner sign-up creates the workspace with the person as OWNER", owner.kind === "created" && !!owner.workspaceId && (await prisma.workspaceMember.findFirst({ where: { workspaceId: owner.workspaceId, role: "OWNER" } }))?.userId === owner.userId);
  ok("owner sign-up writes the workspace and terms audit entries", (await prisma.auditLog.count({ where: { workspaceId: owner.workspaceId, actionType: { in: ["WORKSPACE_CREATED", "TERMS_ACCEPTED"] } } })) === 2);

  const e3 = `oauth-exists-${stamp}@example.test`; made.push(e3);
  const verified = await prisma.user.create({ data: { email: e3, name: "Verified Person", passwordHash: "x", passwordSetAt: new Date(), emailVerifiedAt: new Date() } });
  const linkedSignin = await o.resolveOAuth(mkProfile("github", `h-${stamp}-3`, e3), loginFlow("github"));
  ok("a verified existing account is linked automatically", linkedSignin.kind === "linked-signin" && linkedSignin.userId === verified.id && (await prisma.oAuthAccount.count({ where: { userId: verified.id } })) === 1);
  ok("the existing password still works after linking (no change to the account)", (await prisma.user.findUniqueOrThrow({ where: { id: verified.id } })).passwordSetAt !== null);

  const e4 = `oauth-unverified-${stamp}@example.test`; made.push(e4);
  const unver = await prisma.user.create({ data: { email: e4, name: "Unverified", passwordHash: "x", passwordSetAt: new Date() } });
  const conflict = await o.resolveOAuth(mkProfile("google", `g-${stamp}-4`, e4), signupFlow("google"));
  ok("an account with an UNVERIFIED email is never linked", conflict.kind === "unverified-conflict" && (await prisma.oAuthAccount.count({ where: { userId: unver.id } })) === 0);

  // link mode
  const e5 = `oauth-link-${stamp}@example.test`; made.push(e5);
  const lu = await prisma.user.create({ data: { email: e5, name: "Linker", passwordHash: "x", passwordSetAt: new Date(), emailVerifiedAt: new Date() } });
  const linkFlow = (uid: string, provider = "google") => o.newFlow(provider, "link", { uid });
  ok("link mode connects a provider to the signed-in user (different email is fine)", (await o.resolveOAuth(mkProfile("google", `g-${stamp}-5`, "another-address@example.test"), linkFlow(lu.id))).kind === "linked");
  ok("linking the same provider identity to a different user is refused", (await o.resolveOAuth(mkProfile("google", `g-${stamp}-5`, "x@example.test"), linkFlow(verified.id))).kind === "link-conflict");
  ok("a second Google account on the same user is refused", (await o.resolveOAuth(mkProfile("google", `g-${stamp}-5b`, "x@example.test"), linkFlow(lu.id))).kind === "already-linked");
  ok("link mode without a user id is refused", (await o.resolveOAuth(mkProfile("google", `g-${stamp}-6`, "x@example.test"), o.newFlow("google", "link"))).kind === "link-conflict");
  ok("an identity linked to someone else cannot be used to sign in as a second user via email match", (await o.resolveOAuth(mkProfile("google", `g-${stamp}-5`, e3), loginFlow("google"))).kind === "signin");

  // ---- unlink safety ----
  ok("with a password set, a provider can be disconnected", (await o.canUnlink(lu.id, "google")).ok === true);
  const e6 = `oauth-only-${stamp}@example.test`; made.push(e6);
  await o.resolveOAuth(mkProfile("google", `g-${stamp}-7`, e6), signupFlow("google"));
  const only = await prisma.user.findUniqueOrThrow({ where: { email: e6 } });
  const blocked = await o.canUnlink(only.id, "google");
  ok("the only way to sign in cannot be disconnected", blocked.ok === false && /only way you can sign in/.test((blocked as any).reason));
  await o.resolveOAuth(mkProfile("github", `h-${stamp}-7`, "other-addr@example.test"), linkFlow(only.id, "github"));
  ok("with a second provider connected, either can be disconnected", (await o.canUnlink(only.id, "google")).ok === true && (await o.canUnlink(only.id, "github")).ok === true);
  ok("hasOAuthAccount reports provider users (used to stop the first-password claim)", (await o.hasOAuthAccount(only.id)) === true && (await o.hasOAuthAccount(unver.id)) === false);
  ok("a deleted user removes the linked identities (cascade)", await (async () => { await prisma.user.delete({ where: { id: only.id } }); return (await prisma.oAuthAccount.count({ where: { userId: only.id } })) === 0; })());
} finally {
  await cleanup();
  server.close();
  console.log("cleaned up");
}
process.exit(process.exitCode ?? 0);
