"use server";
import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { getCurrentUser, verifyPassword } from "@/lib/auth";
import { emails, sendEmail } from "@/lib/email";
import { DEFAULT_SCOPES, isScope } from "@/lib/api-scopes";
import { DELETION_GRACE_DAYS } from "@/lib/account-deletion";
import { run } from "./_util";

const hashKey = (k: string) => createHash("sha256").update(k).digest("hex");
const PERSONAL_KEY_LIMIT = 5;

async function me() {
  const u = await getCurrentUser();
  if (!u) throw new Error("Sign in first.");
  return u;
}
const done = () => { revalidatePath("/account"); revalidatePath("/app", "layout"); };

/* ---------------- Date and clock format ---------------- */

export async function updatePreferencesAction(input: unknown) {
  return run(async () => {
    const u = await me();
    const d = z.object({
      dateFormat: z.enum(["YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY"]).nullable(),
      clock24: z.boolean().nullable(),
    }).parse(input);
    await prisma.user.update({ where: { id: u.id }, data: { dateFormat: d.dateFormat, clock24: d.clock24 } });
    done();
    return undefined;
  });
}

/* ---------------- Personal API keys (tied to one person) ---------------- */

/** Creates a key that acts as this person in one workspace they belong to. It works only while they keep that role. */
export async function createPersonalKeyAction(input: unknown) {
  return run(async () => {
    const u = await me();
    const d = z.object({
      name: z.string().trim().min(2, "Name the key").max(60),
      workspaceId: z.string().min(5),
      scopes: z.array(z.string()).optional(),
      expiresInDays: z.number().int().min(1).max(3650).nullish(),
    }).parse(input);
    const member = await prisma.workspaceMember.findFirst({ where: { userId: u.id, workspaceId: d.workspaceId }, include: { workspace: { select: { name: true } } } });
    if (!member) throw new Error("You are not a member of that workspace.");
    const scopes = [...new Set(d.scopes && d.scopes.length ? d.scopes : DEFAULT_SCOPES)];
    if (!scopes.every(isScope)) throw new Error("Unknown scope.");
    const expiresAt = d.expiresInDays ? new Date(Date.now() + d.expiresInDays * 86400000) : null;
    const myMemberIds = (await prisma.workspaceMember.findMany({ where: { userId: u.id }, select: { id: true } })).map((m) => m.id);
    const active = await prisma.apiKey.count({ where: { revokedAt: null, createdByMemberId: { in: myMemberIds } } });
    if (active >= PERSONAL_KEY_LIMIT) throw new Error(`You can have at most ${PERSONAL_KEY_LIMIT} personal keys. Revoke one first.`);
    const key = `oo_live_${randomBytes(24).toString("hex")}`;
    await prisma.$transaction(async (tx) => {
      const k = await tx.apiKey.create({ data: { workspaceId: member.workspaceId, name: `${d.name} (personal)`, prefix: key.slice(0, 15), keyHash: hashKey(key), createdByName: u.name, createdByMemberId: member.id, scopes, expiresAt } });
      await writeAudit(tx, { workspaceId: member.workspaceId, actorMemberId: member.id, actorName: u.name, actionType: "API_KEY_CREATED", targetType: "ApiKey", targetId: k.id, summary: `Personal API key "${d.name}" created by ${u.name} with scopes: ${scopes.join(", ")}` });
    });
    done();
    return { key };
  });
}

/** Revokes one of this person's own keys, in any workspace they belong to. */
export async function revokePersonalKeyAction(id: string) {
  return run(async () => {
    const u = await me();
    const myMemberIds = (await prisma.workspaceMember.findMany({ where: { userId: u.id }, select: { id: true } })).map((m) => m.id);
    await prisma.$transaction(async (tx) => {
      const k = await tx.apiKey.findFirst({ where: { id, revokedAt: null, createdByMemberId: { in: myMemberIds } } });
      if (!k) throw new Error("Key not found.");
      await tx.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
      await writeAudit(tx, { workspaceId: k.workspaceId, actorMemberId: k.createdByMemberId, actorName: u.name, actionType: "API_KEY_REVOKED", targetType: "ApiKey", targetId: id, summary: `Personal API key "${k.name}" revoked by ${u.name}` });
    });
    done();
    return undefined;
  });
}

/* ---------------- Delete my account (14-day grace period) ---------------- */

export async function requestAccountDeletionAction(input: unknown) {
  return run(async () => {
    const u = await me();
    const d = z.object({ password: z.string().min(1, "Enter your password"), confirmEmail: z.string().trim() }).parse(input);
    if (d.confirmEmail.toLowerCase() !== u.email.toLowerCase()) throw new Error("Type your email address exactly to confirm.");
    if (!(await verifyPassword(d.password, u.passwordHash))) throw new Error("Your password is incorrect.");
    const owned = await prisma.workspaceMember.findMany({ where: { userId: u.id, role: "OWNER" } });
    for (const m of owned) {
      const others = await prisma.workspaceMember.count({ where: { workspaceId: m.workspaceId, role: "OWNER", id: { not: m.id } } });
      if (!others) throw new Error("You are the only owner of a workspace. Make someone else an owner, or close the workspace, before deleting your account.");
    }
    const at = new Date();
    await prisma.user.update({ where: { id: u.id }, data: { deletionRequestedAt: at } });
    const when = new Date(at.getTime() + DELETION_GRACE_DAYS * 86400000).toISOString().slice(0, 10);
    const note = emails.privacyDone(u.name, "account", `We received your request to delete your OnboardOps account. It will be permanently deleted on ${when} unless you cancel it from Account settings before then. Until then, nothing changes.`);
    await sendEmail(u.email, `Your account is scheduled for deletion on ${when}`, note.text, { html: note.html, kind: "privacy-done" });
    done();
    return { deletesOn: when };
  });
}

export async function cancelAccountDeletionAction() {
  return run(async () => {
    const u = await me();
    if (!u.deletionRequestedAt) throw new Error("Your account is not scheduled for deletion.");
    await prisma.user.update({ where: { id: u.id }, data: { deletionRequestedAt: null } });
    done();
    return undefined;
  });
}
