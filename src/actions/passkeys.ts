"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON, AuthenticatorTransportFuture, RegistrationResponseJSON } from "@simplewebauthn/types";
import { prisma } from "@/lib/prisma";
import { createSession, getCurrentUser, verifyPassword } from "@/lib/auth";
import { beginSession, landingFor } from "@/lib/login";
import { auditUser } from "@/lib/mfa";
import { isDuoEnabled } from "@/lib/duo";
import { enforceRate } from "@/lib/rate-limit";
import { RP_NAME, expectedOrigins, rpId, setChallenge, takeChallenge } from "@/lib/passkey";
import { run, type Result } from "./_util";

async function me() {
  const u = await getCurrentUser();
  if (!u) throw new Error("Sign in first.");
  return u;
}
const refresh = () => revalidatePath("/account");

/* ---------------- Add a passkey (signed in) ---------------- */

export async function passkeyRegisterOptionsAction(input: unknown): Promise<Result<unknown>> {
  return run(async () => {
    await enforceRate("passkey-add", 15, 900);
    const u = await me();
    const d = z.object({ password: z.string().optional() }).parse(input);
    if (u.passwordSetAt) {
      if (!d.password) throw new Error("Enter your password to continue.");
      if (!(await verifyPassword(d.password, u.passwordHash))) throw new Error("Your password is incorrect.");
    }
    expectedOrigins();
    const existing = await prisma.passkey.findMany({ where: { userId: u.id }, select: { credentialId: true, transports: true } });
    if (existing.length >= 10) throw new Error("You can have up to 10 passkeys. Remove one first.");
    const opts = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: rpId(),
      userID: new TextEncoder().encode(u.id),
      userName: u.email,
      userDisplayName: u.name,
      attestationType: "none",
      excludeCredentials: existing.map((p) => ({ id: p.credentialId, transports: p.transports as AuthenticatorTransportFuture[] })),
      authenticatorSelection: { residentKey: "required", userVerification: "required" },
    });
    await setChallenge(opts.challenge, "register", u.id);
    return opts;
  });
}

export async function passkeyRegisterVerifyAction(input: unknown): Promise<Result> {
  return run(async () => {
    await enforceRate("passkey-add", 15, 900);
    const u = await me();
    const d = z.object({ response: z.any(), name: z.string().trim().max(60).optional() }).parse(input);
    const { challenge, userId } = await takeChallenge("register");
    if (userId !== u.id) throw new Error("That took too long. Please try again.");
    const v = await verifyRegistrationResponse({ response: d.response as RegistrationResponseJSON, expectedChallenge: challenge, expectedOrigin: expectedOrigins(), expectedRPID: rpId(), requireUserVerification: true });
    if (!v.verified || !v.registrationInfo) throw new Error("That passkey could not be verified. Please try again.");
    const info = v.registrationInfo;
    const id = info.credentialID;
    if (await prisma.passkey.findUnique({ where: { credentialId: id } })) throw new Error("That passkey is already added.");
    await prisma.passkey.create({
      data: {
        userId: u.id,
        credentialId: id,
        publicKey: Buffer.from(info.credentialPublicKey),
        counter: info.counter,
        transports: ((d.response as RegistrationResponseJSON).response.transports ?? []) as string[],
        deviceType: info.credentialDeviceType,
        backedUp: info.credentialBackedUp,
        name: d.name || (info.credentialBackedUp ? "Synced passkey" : "Passkey"),
      },
    });
    await auditUser(u.id, u.name, "PASSKEY_ADDED", `${u.name} added a passkey`);
    refresh();
    return undefined;
  });
}

export async function removePasskeyAction(input: unknown): Promise<Result> {
  return run(async () => {
    await enforceRate("passkey-add", 15, 900);
    const u = await me();
    const d = z.object({ id: z.string().min(1), password: z.string().optional() }).parse(input);
    if (u.passwordSetAt) {
      if (!d.password) throw new Error("Enter your password to continue.");
      if (!(await verifyPassword(d.password, u.passwordHash))) throw new Error("Your password is incorrect.");
    }
    const p = await prisma.passkey.findFirst({ where: { id: d.id, userId: u.id } });
    if (!p) throw new Error("Passkey not found.");
    await prisma.passkey.delete({ where: { id: p.id } });
    await auditUser(u.id, u.name, "PASSKEY_REMOVED", `${u.name} removed a passkey`);
    refresh();
    return undefined;
  });
}

/* ---------------- Sign in with a passkey (no password, no email typed) ---------------- */

export async function passkeyLoginOptionsAction(): Promise<Result<unknown>> {
  return run(async () => {
    await enforceRate("passkey-login", 30, 900);
    expectedOrigins();
    const opts = await generateAuthenticationOptions({ rpID: rpId(), userVerification: "required" });
    await setChallenge(opts.challenge, "login");
    return opts;
  });
}

export async function passkeyLoginVerifyAction(input: unknown): Promise<Result<{ to: string }>> {
  return run(async () => {
    await enforceRate("passkey-login", 30, 900);
    const d = z.object({ response: z.any() }).parse(input);
    const resp = d.response as AuthenticationResponseJSON;
    const { challenge } = await takeChallenge("login");
    const pk = typeof resp?.id === "string" ? await prisma.passkey.findUnique({ where: { credentialId: resp.id }, include: { user: true } }) : null;
    const fail = new Error("That passkey was not recognised. Use your password instead, or try another passkey.");
    if (!pk) throw fail;
    let v;
    try {
      v = await verifyAuthenticationResponse({
        response: resp,
        expectedChallenge: challenge,
        expectedOrigin: expectedOrigins(),
        expectedRPID: rpId(),
        requireUserVerification: true,
        authenticator: { credentialID: pk.credentialId, credentialPublicKey: new Uint8Array(pk.publicKey), counter: pk.counter, transports: pk.transports as AuthenticatorTransportFuture[] },
      });
    } catch {
      throw fail;
    }
    if (!v.verified) throw fail;
    await prisma.passkey.update({ where: { id: pk.id }, data: { counter: v.authenticationInfo.newCounter, lastUsedAt: new Date(), backedUp: v.authenticationInfo.credentialBackedUp } });
    if (pk.user.bannedAt) return { to: "/banned" };

    // A passkey with a PIN or biometric is already two factors, so the authenticator-app code is skipped.
    // A workspace that requires Duo still gets its own check, through the normal gate.
    const ws = await prisma.workspace.findMany({ where: { members: { some: { userId: pk.userId } } }, select: { duoConfig: true } });
    if (ws.some((w) => isDuoEnabled(w))) {
      const r = await beginSession(pk.userId, { method: "password" });
      return { to: r.done ? await landingFor(pk.userId, null, "/workplaces") : r.to };
    }
    await createSession(pk.userId);
    await auditUser(pk.userId, pk.user.name, "PASSKEY_SIGN_IN", `${pk.user.name} signed in with a passkey`);
    return { to: await landingFor(pk.userId, null, "/workplaces") };
  });
}
