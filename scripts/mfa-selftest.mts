// Local check of two-factor authentication: RFC 6238 vectors, setup, valid/invalid/replayed codes, backup codes, lockout, storage, and token isolation.
// Uses the local demo database only; creates and deletes its own user.
// Run: DATA_MASTER_KEY=<any throwaway key> npx tsx scripts/mfa-selftest.mts
import { SignJWT, jwtVerify } from "jose";
const unwrap = (m: any) => (m && m.default && !m.prisma && !m.verifySecondFactor ? m.default : m);
const { prisma } = unwrap(await import("../src/lib/prisma.ts"));
const totp = unwrap(await import("../src/lib/totp.ts"));
const mfa = unwrap(await import("../src/lib/mfa.ts"));
const tok = unwrap(await import("../src/lib/mfa-token.ts"));
const box = unwrap(await import("../src/lib/secret-box.ts"));

if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) { console.error("Local database only."); process.exit(1); }
const ok = (n: string, c: boolean, extra = "") => { console.log(c ? "PASS" : "FAIL", n, extra); if (!c) process.exitCode = 1; };

// ---- RFC 6238 test vectors (SHA-1, secret "12345678901234567890"), first 6 digits of the published 8-digit values ----
const rfcSecret = totp.base32Encode(Buffer.from("12345678901234567890"));
for (const [t, want] of [[59, "287082"], [1111111109, "081804"], [1111111111, "050471"], [1234567890, "005924"], [2000000000, "279037"], [20000000000, "353130"]] as const) {
  ok(`RFC 6238 vector at t=${t}`, totp.totpAt(rfcSecret, t * 1000) === want, totp.totpAt(rfcSecret, t * 1000));
}
ok("base32 round trip", totp.base32Decode(totp.base32Encode(Buffer.from("hello there"))).toString() === "hello there");
const s = totp.generateSecret();
ok("secret is 32 base32 characters", /^[A-Z2-7]{32}$/.test(s));
ok("otpauth URI has issuer, secret and period", /^otpauth:\/\/totp\/.+secret=[A-Z2-7]{32}&issuer=.+&period=30$/.test(totp.otpauthUri(s, "a@b.test", "OnboardOps")));

// ---- verifyTotp ----
const now = 1_700_000_000_000;
const good = totp.totpAt(s, now);
ok("valid code accepted", totp.verifyTotp(s, good, { now }).ok === true);
ok("code from the previous 30s step accepted (clock drift)", totp.verifyTotp(s, totp.totpAt(s, now - 30_000), { now }).ok === true);
ok("code from the next 30s step accepted (clock drift)", totp.verifyTotp(s, totp.totpAt(s, now + 30_000), { now }).ok === true);
ok("code two steps old rejected", totp.verifyTotp(s, totp.totpAt(s, now - 60_000), { now }).ok === false);
ok("wrong code rejected", totp.verifyTotp(s, good === "000000" ? "000001" : "000000", { now }).ok === false);
ok("non-numeric and wrong-length input rejected", !totp.verifyTotp(s, "12ab56", { now }).ok && !totp.verifyTotp(s, "12345", { now }).ok && !totp.verifyTotp(s, "1234567", { now }).ok);
const r1 = totp.verifyTotp(s, good, { now });
ok("a step at or below lastStep is refused (replay)", r1.ok && totp.verifyTotp(s, good, { now, lastStep: r1.step }).ok === false);
ok("spaces inside a typed code are tolerated", totp.verifyTotp(s, `${good.slice(0, 3)} ${good.slice(3)}`, { now }).ok === true);

// ---- pending-login token cannot be used as a session ----
const sessionSecret = new TextEncoder().encode(process.env.SESSION_SECRET || "dev-only-secret-change-me-please-32chars");
const pending = await tok.signMfaPending({ u: "user_1", ws: "ws_1", method: "password" });
let acceptedAsSession = true;
try { await jwtVerify(pending, sessionSecret); } catch { acceptedAsSession = false; }
ok("pending token is rejected by the session key", acceptedAsSession === false);
const sessionLike = await new SignJWT({ uid: "user_1" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("14d").sign(sessionSecret);
ok("a session token is not accepted as a pending token", (await tok.verifyMfaPending(sessionLike)) === null);
const back = await tok.verifyMfaPending(pending);
ok("a pending token verifies and keeps its claims", back?.u === "user_1" && back?.ws === "ws_1" && back?.enroll === false);
ok("a tampered pending token is rejected", (await tok.verifyMfaPending(pending.slice(0, -4) + "AAAA")) === null);
ok("pending token has no 'uid' claim", !("uid" in JSON.parse(Buffer.from(pending.split(".")[1], "base64url").toString())));

// ---- login requirement matrix ----
ok("no 2FA and no policy: no second factor", mfa.loginRequirement({ totpEnabledAt: null }, { require2fa: false }) === "none");
ok("2FA on: code needed", mfa.loginRequirement({ totpEnabledAt: new Date() }, { require2fa: false }) === "code");
ok("workspace requires it and user has none: enrol", mfa.loginRequirement({ totpEnabledAt: null }, { require2fa: true }) === "enroll");
ok("workspace requires it and user has it: code", mfa.loginRequirement({ totpEnabledAt: new Date() }, { require2fa: true }) === "code");

// ---- database flows ----
const email = `mfa-selftest-${Date.now()}@example.test`;
const user = await prisma.user.create({ data: { email, name: "MFA Selftest", passwordHash: "x" } });
try {
  const setup = await mfa.startSetup(user);
  let row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  ok("pending secret is stored sealed, not in plain text", !!row.totpPendingEnc && !row.totpPendingEnc.includes(setup.secret) && box.open(row.totpPendingEnc) === setup.secret);
  ok("2FA is not enabled until a code is confirmed", row.totpEnabledAt === null);
  const bad = await mfa.confirmSetup(user.id, setup.secret.startsWith("A") ? "000001" : "000000");
  ok("a wrong code does not enable 2FA", bad.ok === false && (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).totpEnabledAt === null);
  const t0 = new Date();
  const conf = await mfa.confirmSetup(user.id, totp.totpAt(setup.secret, t0.getTime()), t0);
  ok("a correct code enables 2FA", conf.ok === true);
  const codes: string[] = conf.ok ? conf.backupCodes : [];
  row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  ok("2FA is enabled, pending cleared, secret sealed", !!row.totpEnabledAt && row.totpPendingEnc === null && !!row.totpSecretEnc && !row.totpSecretEnc.includes(setup.secret) && box.open(row.totpSecretEnc) === setup.secret);
  ok("10 unique backup codes are returned in XXXXX-XXXXX form", codes.length === 10 && new Set(codes).size === 10 && codes.every((c) => /^[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}$/.test(c)));
  const stored = await prisma.backupCode.findMany({ where: { userId: user.id } });
  ok("backup codes are stored only as keyed hashes", stored.length === 10 && stored.every((b: any) => /^[0-9a-f]{64}$/.test(b.codeHash) && !codes.some((c) => b.codeHash.toLowerCase().includes(c.replace("-", "").toLowerCase()))));
  ok("the code used to confirm cannot be replayed at sign-in", (await mfa.verifySecondFactor(user.id, totp.totpAt(setup.secret, t0.getTime()), t0)).ok === false);
  await prisma.user.update({ where: { id: user.id }, data: { totpFailed: 0, totpLockedUntil: null } });

  const t1 = new Date(t0.getTime() + 30_000);
  const v1 = await mfa.verifySecondFactor(user.id, totp.totpAt(setup.secret, t1.getTime()), t1);
  ok("a valid code at sign-in is accepted", v1.ok === true && v1.via === "totp");
  ok("the same code cannot be used twice", (await mfa.verifySecondFactor(user.id, totp.totpAt(setup.secret, t1.getTime()), t1)).ok === false);
  await prisma.user.update({ where: { id: user.id }, data: { totpFailed: 0, totpLockedUntil: null } });

  const b1 = await mfa.verifySecondFactor(user.id, codes[0]);
  ok("a backup code works once", b1.ok === true && b1.via === "backup");
  ok("a backup code cannot be reused", (await mfa.verifySecondFactor(user.id, codes[0])).ok === false);
  ok("typing a backup code in lower case without the hyphen works", (await mfa.verifySecondFactor(user.id, codes[1].toLowerCase().replace("-", ""))).ok === true);
  ok("a made-up backup code is rejected", (await mfa.verifySecondFactor(user.id, "AAAAA-AAAAA")).ok === false);
  ok("8 backup codes are left", (await mfa.backupCodesLeft(user.id)) === 8);
  await prisma.user.update({ where: { id: user.id }, data: { totpFailed: 0, totpLockedUntil: null } });

  // lockout: 5 wrong codes lock for 15 minutes; a right code is refused while locked; magic link / password reset do not clear it
  const t2 = new Date(t1.getTime() + 120_000);
  const wrong = totp.totpAt(setup.secret, t2.getTime()) === "111111" ? "222222" : "111111";
  const results = [];
  for (let i = 0; i < 5; i++) results.push(await mfa.verifySecondFactor(user.id, wrong, t2));
  ok("four wrong codes are plain failures", results.slice(0, 4).every((r) => !r.ok && r.reason === "invalid"));
  ok("the fifth wrong code locks the account", !results[4].ok && results[4].reason === "locked");
  row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  const mins = row.totpLockedUntil ? Math.round((row.totpLockedUntil.getTime() - t2.getTime()) / 60000) : -1;
  ok("the lock lasts 15 minutes", mins === 15, `${mins} min`);
  const during = await mfa.verifySecondFactor(user.id, totp.totpAt(setup.secret, t2.getTime()), t2);
  ok("a correct code is refused while locked", !during.ok && during.reason === "locked");
  const dupBackup = await mfa.verifySecondFactor(user.id, codes[2], t2);
  ok("a backup code is refused while locked", !dupBackup.ok && dupBackup.reason === "locked");
  await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } }); // what magic-link / reset do to the PASSWORD lock
  row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  ok("clearing the password lock does not clear the 2FA lock", !!row.totpLockedUntil && row.totpLockedUntil > t2);
  const t3 = new Date(row.totpLockedUntil!.getTime() + 1000);
  const after = await mfa.verifySecondFactor(user.id, totp.totpAt(setup.secret, t3.getTime()), t3);
  ok("a correct code works after the lock ends", after.ok === true);

  // regenerate and disable
  const fresh = await mfa.generateBackupCodes(user.id);
  ok("regenerating gives 10 new codes", fresh.length === 10 && fresh.every((c: string) => !codes.includes(c)));
  ok("old backup codes stop working after regenerating", (await mfa.verifySecondFactor(user.id, codes[3])).ok === false);
  await prisma.user.update({ where: { id: user.id }, data: { totpFailed: 0, totpLockedUntil: null } });
  ok("a new backup code works", (await mfa.verifySecondFactor(user.id, fresh[0])).ok === true);
  await mfa.disableMfa(user.id);
  row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  ok("disabling clears the secret and every backup code", row.totpSecretEnc === null && row.totpEnabledAt === null && (await prisma.backupCode.count({ where: { userId: user.id } })) === 0);
  const off = await mfa.verifySecondFactor(user.id, "123456");
  ok("a user without 2FA reports not_enabled", !off.ok && off.reason === "not_enabled");
} finally {
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  console.log("cleaned up");
}
process.exit(process.exitCode ?? 0);
