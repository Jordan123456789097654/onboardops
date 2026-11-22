"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createSession, currentSessionId, getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { createToken } from "@/lib/tokens";
import { emails, sendEmail } from "@/lib/email";
import { emailTaken, norm } from "@/lib/user-emails";
import { OPTIONAL_EMAIL_KINDS } from "@/lib/notify-prefs";
import { run } from "./_util";

async function me() {
  const u = await getCurrentUser();
  if (!u) throw new Error("Sign in first.");
  return u;
}
const done = () => { revalidatePath("/account"); revalidatePath("/app", "layout"); revalidatePath("/workplaces"); };

/* ---------------- Profile ---------------- */
export async function updateProfileAction(input: unknown) {
  return run(async () => {
    const u = await me();
    const d = z.object({ name: z.string().trim().min(2, "Enter your full name").max(100), nickname: z.string().trim().max(40, "Keep the nickname under 40 characters").optional().or(z.literal("")) }).parse(input);
    await prisma.user.update({ where: { id: u.id }, data: { name: d.name, nickname: d.nickname || null } });
    done();
    return undefined;
  });
}

const MAX_AVATAR = 600 * 1024;
/** FormData: file (already resized in the browser to about 256 px). */
export async function uploadAvatarAction(form: FormData) {
  return run(async () => {
    const u = await me();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Choose an image.");
    if (file.size > MAX_AVATAR) throw new Error("That image is too large. Try a smaller one (under 600 KB).");
    const buf = Buffer.from(await file.arrayBuffer());
    const isPng = buf.subarray(1, 4).toString("latin1") === "PNG";
    const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
    const isWebp = buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP";
    if (!isPng && !isJpg && !isWebp) throw new Error("Use a PNG, JPG or WEBP image.");
    const now = new Date();
    await prisma.user.update({ where: { id: u.id }, data: { avatarData: buf, avatarMime: isPng ? "image/png" : isWebp ? "image/webp" : "image/jpeg", avatarUpdatedAt: now, avatarUrl: `/api/avatar/${u.id}?v=${now.getTime()}` } });
    done();
    return undefined;
  });
}

export async function removeAvatarAction() {
  return run(async () => {
    const u = await me();
    await prisma.user.update({ where: { id: u.id }, data: { avatarData: null, avatarMime: null, avatarUpdatedAt: null, avatarUrl: null } });
    done();
    return undefined;
  });
}

/* ---------------- Password and sessions ---------------- */
export async function changePasswordAction(input: unknown) {
  return run(async () => {
    const u = await me();
    const d = z.object({ current: z.string().optional().default(""), next: z.string().min(8, "Use at least 8 characters").max(200) }).parse(input);
    if (u.passwordSetAt) {
      if (!d.current) throw new Error("Enter your current password.");
      if (!(await verifyPassword(d.current, u.passwordHash))) throw new Error("Your current password is incorrect.");
    }
    if (d.current && d.current === d.next) throw new Error("Choose a password you have not used just now.");
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(d.next), passwordSetAt: new Date(), passwordChangedAt: new Date(), failedLogins: 0, lockedUntil: null } });
    await createSession(u.id); // keeps this device signed in; every other device is signed out
    done();
    return undefined;
  });
}

export async function signOutOtherDevicesAction() {
  return run(async () => {
    const u = await me();
    await prisma.user.update({ where: { id: u.id }, data: { passwordChangedAt: new Date() } });
    await prisma.userSession.updateMany({ where: { userId: u.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await createSession(u.id);
    done();
    return undefined;
  });
}

export async function revokeSessionAction(id: string) {
  return run(async () => {
    const u = await me();
    if ((await currentSessionId()) === id) throw new Error("That is the device you are using now.");
    await prisma.userSession.updateMany({ where: { id, userId: u.id, revokedAt: null }, data: { revokedAt: new Date() } });
    done();
    return undefined;
  });
}

/* ---------------- Email addresses ---------------- */
const LIMIT = 5;

async function sendAddressVerification(userId: string, name: string, emailId: string, address: string) {
  const raw = await createToken(userId, "ADDEMAIL", 24 * 3600_000);
  const url = `${process.env.APP_URL || "http://localhost:3000"}/verify-email?token=${raw}&e=${emailId}`;
  const m = emails.verifyAdditional(name, address, url);
  const r = await sendEmail(address, m.subject, m.text, { html: m.html, kind: "verify-additional" });
  return { sent: r.ok, devLink: process.env.NODE_ENV !== "production" ? url : undefined };
}

export async function addEmailAction(input: unknown) {
  return run(async () => {
    const u = await me();
    const d = z.object({ email: z.string().trim().email("Enter a valid email") }).parse(input);
    const e = norm(d.email);
    if ((await prisma.userEmail.count({ where: { userId: u.id } })) >= LIMIT - 1) throw new Error(`You can have up to ${LIMIT} email addresses.`);
    if (await emailTaken(e)) throw new Error("That email is already used by an account.");
    const row = await prisma.userEmail.create({ data: { userId: u.id, email: e } });
    const r = await sendAddressVerification(u.id, u.name, row.id, e);
    done();
    return { devLink: r.devLink };
  });
}

export async function resendEmailVerificationAction(id: string) {
  return run(async () => {
    const u = await me();
    const row = await prisma.userEmail.findFirst({ where: { id, userId: u.id, verifiedAt: null } });
    if (!row) throw new Error("That address is already verified or was removed.");
    const recent = await prisma.authToken.count({ where: { userId: u.id, kind: "ADDEMAIL", createdAt: { gt: new Date(Date.now() - 3600_000) } } });
    if (recent >= 4) throw new Error("We already sent several links. Check your inbox and spam folder, then try again later.");
    const r = await sendAddressVerification(u.id, u.name, row.id, row.email);
    return { devLink: r.devLink };
  });
}

export async function removeEmailAction(id: string) {
  return run(async () => {
    const u = await me();
    const row = await prisma.userEmail.findFirst({ where: { id, userId: u.id } });
    if (!row) throw new Error("Email not found.");
    await prisma.userEmail.delete({ where: { id } });
    done();
    return undefined;
  });
}

/** Swaps a verified secondary address into the primary slot. The old primary becomes a secondary address. */
export async function makePrimaryEmailAction(id: string) {
  return run(async () => {
    const u = await me();
    const row = await prisma.userEmail.findFirst({ where: { id, userId: u.id, verifiedAt: { not: null } } });
    if (!row) throw new Error("Only a verified address can become your primary email.");
    await prisma.$transaction(async (tx) => {
      const oldEmail = u.email, oldVerified = u.emailVerifiedAt;
      await tx.userEmail.update({ where: { id: row.id }, data: { email: oldEmail, verifiedAt: oldVerified } });
      await tx.user.update({ where: { id: u.id }, data: { email: row.email, emailVerifiedAt: row.verifiedAt } });
    });
    done();
    return undefined;
  });
}

/* ---------------- Notification preferences ---------------- */
export async function saveEmailPrefsAction(input: unknown) {
  return run(async () => {
    const u = await me();
    const d = z.record(z.boolean()).parse(input);
    const clean = Object.fromEntries(Object.entries(d).filter(([k]) => OPTIONAL_EMAIL_KINDS.some((o) => o.kind === k)));
    await prisma.user.update({ where: { id: u.id }, data: { emailPrefs: clean } });
    done();
    return undefined;
  });
}

export async function saveNotificationPrefsAction(input: unknown) {
  return run(async () => {
    const u = await me();
    const hour = z.coerce.number().int().min(0).max(23);
    const d = z.object({ quietStart: hour.nullable(), quietEnd: hour.nullable(), timezone: z.string().trim().max(60).default("") }).parse(input);
    const both = d.quietStart !== null && d.quietEnd !== null;
    await prisma.user.update({ where: { id: u.id }, data: { quietStart: both ? d.quietStart : null, quietEnd: both ? d.quietEnd : null, timezone: d.timezone || null } });
    done();
    return undefined;
  });
}
