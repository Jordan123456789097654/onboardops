"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { clearSupportGrant, getSessionUserId, setSupportGrant } from "@/lib/auth";
import { createToken } from "@/lib/tokens";
import { emails, sendEmail } from "@/lib/email";
import { notifyRoles } from "@/lib/notify";
import { getStaff, requireStaff, staffAudit, SUPPORT_STAFF, OWNER_ONLY } from "@/lib/platform";
import { PERMANENT_OWNER_EMAILS } from "@/lib/platform-role";
import { saveAnnouncementState, saveMaintenanceState } from "@/lib/maintenance";
import { reconcileMaintenance } from "@/lib/betterstack";
import { mergeWorkspaceMeta } from "@/lib/workspace-meta";
import { connectDomain, removeDomain, validateDomain } from "@/lib/vercel-domains";
import { can, getSupportConfig } from "@/lib/support-config";
import { emitSupportEvent } from "@/lib/support";
import { run } from "./_util";

const ownersOf = (workspaceId: string) => prisma.workspaceMember.findMany({ where: { workspaceId, role: "OWNER" }, include: { user: true } });
const refresh = () => revalidatePath("/admin", "layout");

/* ---------------- Support inbox ---------------- */
export async function replyToRequestAction(id: string, input: unknown) {
  return run(async () => {
    const staff = await requireStaff(SUPPORT_STAFF);
    const d = z.object({ body: z.string().trim().min(2, "Write a reply").max(8000), markSolved: z.boolean().default(false) }).parse(input);
    const req = await prisma.supportRequest.findUnique({ where: { id } });
    if (!req) throw new Error("Request not found.");
    const ref = req.id.slice(-8).toUpperCase();
    if (d.markSolved && !can(await getSupportConfig(), staff.role, "close")) throw new Error("You don't have permission to close tickets.");
    const m = emails.supportReply(req.name, ref, d.body);
    const sent = await sendEmail(req.email, m.subject, m.text, { html: m.html, kind: "support-reply", workspaceId: req.workspaceId });
    const updated = await prisma.$transaction(async (tx) => {
      await tx.supportMessage.create({ data: { requestId: id, kind: "REPLY", authorName: staff.name, body: d.body, emailed: sent.ok } });
      const u = await tx.supportRequest.update({
        where: { id },
        data: { status: d.markSolved ? "SOLVED" : "WAITING", solvedAt: d.markSolved ? new Date() : null, resolvedHint: false, idleNudgedAt: null, staffTypingAt: null, assignee: req.assignee ?? staff.name },
      });
      await staffAudit(tx, staff, { action: "SUPPORT_REPLY", targetType: "SupportRequest", targetId: id, workspaceId: req.workspaceId, summary: `Replied to request ${ref}${sent.ok ? "" : " (email failed: " + (sent.error ?? "unknown") + ")"}` });
      return u;
    });
    await emitSupportEvent(d.markSolved ? "ticket.solved" : "ticket.replied", updated, d.body);
    refresh();
    return { emailed: sent.ok, error: sent.error };
  });
}

/** Moves a chat ticket to email: the customer gets an email with the conversation, and the chat shows that it continues by email. */
export async function moveRequestToEmailAction(id: string) {
  return run(async () => {
    const staff = await requireStaff(SUPPORT_STAFF);
    const req = await prisma.supportRequest.findUnique({ where: { id } });
    if (!req) throw new Error("Request not found.");
    const ref = req.id.slice(-8).toUpperCase();
    const body = `We are continuing your conversation by email. Reply to this email with anything else you need, and ${staff.name} will pick it up from here.

Your original message:
${req.message.slice(0, 2000)}`;
    const m = emails.supportReply(req.name, ref, body);
    const sent = await sendEmail(req.email, m.subject, m.text, { html: m.html, kind: "support-reply", workspaceId: req.workspaceId });
    await prisma.$transaction(async (tx) => {
      await tx.supportRequest.update({ where: { id }, data: { source: "EMAIL", assignee: req.assignee ?? staff.name } });
      await tx.supportMessage.create({ data: { requestId: id, kind: "SYSTEM", authorName: staff.name, body: "This conversation continues by email.", emailed: sent.ok } });
      await staffAudit(tx, staff, { action: "SUPPORT_MOVED_TO_EMAIL", targetType: "SupportRequest", targetId: id, workspaceId: req.workspaceId, summary: `Moved request ${ref} from chat to email${sent.ok ? "" : " (email failed)"}` });
    });
    refresh();
    return { emailed: sent.ok, error: sent.error };
  });
}

export async function addInternalNoteAction(id: string, input: unknown) {
  return run(async () => {
    const staff = await requireStaff(SUPPORT_STAFF);
    const d = z.object({ body: z.string().trim().min(2).max(8000) }).parse(input);
    await prisma.supportMessage.create({ data: { requestId: id, kind: "NOTE", authorName: staff.name, body: d.body } });
    refresh();
    return undefined;
  });
}

const updateSchema = z.object({ status: z.enum(["OPEN", "WAITING", "SOLVED"]).optional(), assignee: z.string().max(100).nullable().optional(), boardStatus: z.enum(["NEW", "PLANNED", "DONE", "DECLINED"]).nullable().optional() });
export async function updateRequestAction(id: string, input: unknown) {
  return run(async () => {
    const staff = await requireStaff(SUPPORT_STAFF);
    const d = updateSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      const r = await tx.supportRequest.update({ where: { id }, data: d });
      await staffAudit(tx, staff, { action: "SUPPORT_UPDATE", targetType: "SupportRequest", targetId: id, workspaceId: r.workspaceId, summary: `Request ${id.slice(-8).toUpperCase()} updated: ${Object.entries(d).map(([k, v]) => `${k}=${v}`).join(", ")}` });
    });
    refresh();
    return undefined;
  });
}

/* ---------------- Support access (read-only, time-limited, customer-visible) ---------------- */
const accessSchema = z.object({ workspaceId: z.string(), reason: z.string().trim().min(10, "Give a reason (10+ characters)").max(500), hours: z.coerce.number().int().min(1).max(4), requestId: z.string().optional() });
export async function startSupportAccessAction(input: unknown) {
  return run(async () => {
    const staff = await requireStaff(SUPPORT_STAFF);
    const d = accessSchema.parse(input);
    const ws = await prisma.workspace.findUnique({ where: { id: d.workspaceId } });
    if (!ws) throw new Error("Workspace not found.");
    const expiresAt = new Date(Date.now() + d.hours * 3600_000);
    const owners = await ownersOf(ws.id);
    const grant = await prisma.$transaction(async (tx) => {
      const g = await tx.supportAccessGrant.create({ data: { workspaceId: ws.id, staffUserId: staff.id, staffName: staff.name, reason: d.reason, requestId: d.requestId ?? null, expiresAt } });
      await writeAudit(tx, { workspaceId: ws.id, actorName: `OnboardOps support (${staff.name})`, actionType: "SUPPORT_ACCESS_GRANTED", targetType: "Workspace", targetId: ws.id, summary: `OnboardOps support (${staff.name}) opened read-only support access until ${expiresAt.toISOString().slice(11, 16)}Z. Reason: ${d.reason}`, metadata: { grantId: g.id, requestId: d.requestId ?? null } });
      await notifyRoles(tx, ws.id, ["OWNER", "ADMIN"], { title: "OnboardOps support opened read-only access", body: d.reason, href: "/app/audit" });
      await staffAudit(tx, staff, { action: "SUPPORT_ACCESS_START", targetType: "Workspace", targetId: ws.id, workspaceId: ws.id, summary: `Started support access to ${ws.name} for ${d.hours}h. Reason: ${d.reason}` });
      return g;
    });
    for (const o of owners) { const m = emails.supportAccess(o.user.name, ws.name, staff.name, d.reason, expiresAt.toISOString().replace("T", " ").slice(0, 16) + " UTC"); await sendEmail(o.user.email, m.subject, m.text, { html: m.html, kind: "support-access", workspaceId: ws.id }); }
    setSupportGrant(grant.id, d.hours * 3600);
    return { grantId: grant.id };
  });
}

/** Ends the staff member's current support access. Callable from inside the customer app (the banner). */
export async function endSupportAccessAction() {
  return run(async () => {
    const uid = await getSessionUserId();
    const staff = await getStaff();
    if (!uid || !staff) throw new Error("Not signed in.");
    const open = await prisma.supportAccessGrant.findMany({ where: { staffUserId: uid, endedAt: null } });
    for (const g of open) {
      await prisma.$transaction(async (tx) => {
        await tx.supportAccessGrant.update({ where: { id: g.id }, data: { endedAt: new Date() } });
        await writeAudit(tx, { workspaceId: g.workspaceId, actorName: `OnboardOps support (${staff.name})`, actionType: "SUPPORT_ACCESS_ENDED", targetType: "Workspace", targetId: g.workspaceId, summary: `Support access by ${staff.name} ended` });
        await staffAudit(tx, staff, { action: "SUPPORT_ACCESS_END", targetType: "Workspace", targetId: g.workspaceId, workspaceId: g.workspaceId, summary: "Ended support access" });
      });
    }
    clearSupportGrant();
    return undefined;
  });
}

/* ---------------- Suspend / unlock a workspace ---------------- */
export async function suspendWorkspaceAction(input: unknown) {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    const d = z.object({ workspaceId: z.string(), reason: z.string().trim().min(10, "Give a reason the owner will see (10+ characters)").max(500) }).parse(input);
    const ws = await prisma.workspace.findUnique({ where: { id: d.workspaceId } });
    if (!ws) throw new Error("Workspace not found.");
    const owners = await ownersOf(ws.id);
    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({ where: { id: ws.id }, data: { suspendedAt: new Date(), suspendedReason: d.reason } });
      await writeAudit(tx, { workspaceId: ws.id, actorName: "OnboardOps", actionType: "WORKSPACE_LOCKED", targetType: "Workspace", targetId: ws.id, summary: `Workspace locked by OnboardOps. Reason: ${d.reason}` });
      await staffAudit(tx, staff, { action: "WORKSPACE_LOCK", targetType: "Workspace", targetId: ws.id, workspaceId: ws.id, summary: `Locked ${ws.name}. Reason: ${d.reason}` });
      await tx.moderationCase.create({ data: { targetType: "WORKSPACE", workspaceId: ws.id, action: "SUSPEND", reason: d.reason, actorName: staff.name } });
    });
    for (const o of owners) { const m = emails.workspaceLocked(o.user.name, ws.name, d.reason); await sendEmail(o.user.email, m.subject, m.text, { html: m.html, kind: "workspace-locked", workspaceId: ws.id }); }
    refresh();
    return undefined;
  });
}

export async function unsuspendWorkspaceAction(workspaceId: string) {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws) throw new Error("Workspace not found.");
    const owners = await ownersOf(ws.id);
    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({ where: { id: ws.id }, data: { suspendedAt: null, suspendedReason: "" } });
      await writeAudit(tx, { workspaceId: ws.id, actorName: "OnboardOps", actionType: "WORKSPACE_UNLOCKED", targetType: "Workspace", targetId: ws.id, summary: "Workspace unlocked by OnboardOps" });
      await staffAudit(tx, staff, { action: "WORKSPACE_UNLOCK", targetType: "Workspace", targetId: ws.id, workspaceId: ws.id, summary: `Unlocked ${ws.name}` });
      await tx.moderationCase.create({ data: { targetType: "WORKSPACE", workspaceId: ws.id, action: "UNSUSPEND", reason: "Unlocked by staff", actorName: staff.name } });
    });
    for (const o of owners) { const m = emails.workspaceUnlocked(o.user.name, ws.name); await sendEmail(o.user.email, m.subject, m.text, { html: m.html, kind: "workspace-unlocked", workspaceId: ws.id }); }
    refresh();
    return undefined;
  });
}

/* ---------------- Account recovery ---------------- */
/** Emails a one-time set-password link to the account's own address. Staff never see the link. */
export async function sendRecoveryLinkAction(userId: string) {
  return run(async () => {
    const staff = await requireStaff(SUPPORT_STAFF);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found.");
    const raw = await createToken(user.id, "RESET", 24 * 3600_000);
    const url = `${process.env.APP_URL || "http://localhost:3000"}/reset-password?token=${raw}`;
    const m = emails.reset(user.name, url);
    const sent = await sendEmail(user.email, m.subject, m.text, { html: m.html, kind: "recovery" });
    await staffAudit(prisma, staff, { action: "RECOVERY_LINK", targetType: "User", targetId: user.id, summary: `Sent a set-password link to ${user.email}${sent.ok ? "" : " (email failed)"}` });
    if (!sent.ok) throw new Error(`The email could not be sent: ${sent.error ?? "unknown error"}`);
    return undefined;
  });
}

export async function unlockUserAction(userId: string) {
  return run(async () => {
    const staff = await requireStaff(SUPPORT_STAFF);
    const u = await prisma.user.update({ where: { id: userId }, data: { failedLogins: 0, lockedUntil: null } });
    await staffAudit(prisma, staff, { action: "USER_UNLOCK", targetType: "User", targetId: u.id, summary: `Cleared sign-in lockout for ${u.email}` });
    refresh();
    return undefined;
  });
}

export async function transferOwnershipAction(input: unknown) {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    const d = z.object({ workspaceId: z.string(), toMemberId: z.string(), reason: z.string().trim().min(10, "Record how you verified the request (10+ characters)").max(500) }).parse(input);
    await prisma.$transaction(async (tx) => {
      const to = await tx.workspaceMember.findFirst({ where: { id: d.toMemberId, workspaceId: d.workspaceId }, include: { user: true } });
      if (!to) throw new Error("Member not found in that workspace.");
      if (to.role === "OWNER") throw new Error("That person already owns the workspace.");
      const owners = await tx.workspaceMember.findMany({ where: { workspaceId: d.workspaceId, role: "OWNER" } });
      await tx.workspaceMember.updateMany({ where: { id: { in: owners.map((o) => o.id) } }, data: { role: "ADMIN" } });
      await tx.workspaceMember.update({ where: { id: to.id }, data: { role: "OWNER" } });
      await writeAudit(tx, { workspaceId: d.workspaceId, actorName: "OnboardOps", actionType: "OWNERSHIP_TRANSFERRED", targetType: "Member", targetId: to.id, summary: `Ownership transferred to ${to.user.name} by OnboardOps. Verification: ${d.reason}` });
      await notifyRoles(tx, d.workspaceId, ["OWNER", "ADMIN"], { title: `Ownership moved to ${to.user.name}`, body: "Done by OnboardOps after verification", href: "/app/audit" });
      await staffAudit(tx, staff, { action: "OWNERSHIP_TRANSFER", targetType: "Workspace", targetId: d.workspaceId, workspaceId: d.workspaceId, summary: `Transferred ownership to ${to.user.email}. Verification: ${d.reason}` });
    });
    refresh();
    return undefined;
  });
}

/* ---------------- Privacy requests ---------------- */
export async function deleteAccountDataAction(input: unknown) {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    const d = z.object({ email: z.string().email(), requestId: z.string().optional(), confirm: z.literal(true) }).parse(input);
    const email = d.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email }, include: { memberships: true } });
    if (!user) throw new Error("No account with that email.");
    for (const m of user.memberships.filter((x) => x.role === "OWNER")) {
      const others = await prisma.workspaceMember.count({ where: { workspaceId: m.workspaceId, role: "OWNER", id: { not: m.id } } });
      if (!others) throw new Error("This person is the only owner of a workspace. Transfer ownership or close the workspace first.");
    }
    const ref = d.requestId?.slice(-8).toUpperCase() ?? "manual";
    const note = emails.privacyDone(user.name, ref, "Your OnboardOps account and login have been deleted. Employee records held by your employer are controlled by them, so ask them about those.");
    await sendEmail(user.email, note.subject, note.text, { html: note.html, kind: "privacy-done" });
    await prisma.$transaction(async (tx) => {
      await tx.supportRequest.deleteMany({ where: { email, ...(d.requestId ? { id: { not: d.requestId } } : {}) } });
      await tx.emailLog.deleteMany({ where: { OR: [{ to: email }, { redirectedFrom: email }] } });
      await tx.user.delete({ where: { id: user.id } }); // cascades memberships, tokens; employee profiles are unlinked (memberId set null)
      if (d.requestId) await tx.supportRequest.update({ where: { id: d.requestId }, data: { status: "SOLVED" } });
      await staffAudit(tx, staff, { action: "ACCOUNT_DELETED", targetType: "User", targetId: user.id, summary: `Deleted account data for ${email} (request ${ref})` });
    });
    refresh();
    return undefined;
  });
}

/* ---------------- Staff management ---------------- */
export async function setStaffRoleAction(input: unknown) {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    const d = z.object({ email: z.string().email(), role: z.enum(["OWNER", "SUPPORT", "VIEWER", "NONE"]) }).parse(input);
    const email = d.email.toLowerCase();
    if (PERMANENT_OWNER_EMAILS.includes(email) && d.role !== "OWNER") throw new Error("This account is a permanent site owner.");
    const u = await prisma.user.findUnique({ where: { email } });
    if (!u) throw new Error("That person needs an OnboardOps account first. Ask them to register, then add them here.");
    if (u.id === staff.id && d.role !== "OWNER") throw new Error("You cannot remove your own owner access. Ask another owner.");
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: u.id }, data: { platformRole: d.role === "NONE" ? null : d.role } });
      await staffAudit(tx, staff, { action: "STAFF_ROLE", targetType: "User", targetId: u.id, summary: `${u.email} staff role set to ${d.role}` });
    });
    if (d.role !== "NONE") { const m = emails.staffAdded(u.name, d.role); await sendEmail(u.email, m.subject, m.text, { html: m.html, kind: "staff-added" }); }
    refresh();
    return undefined;
  });
}

/* ---------------- Manual custom domain management (Site Owner) ---------------- */
export async function adminConnectDomainAction(input: unknown) {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    const d = z.object({ workspaceId: z.string(), domain: z.string().min(3), forceVerified: z.boolean().default(true) }).parse(input);
    const v = validateDomain(d.domain, { allowPartnerSubdomain: true });
    if (!v.ok) throw new Error(v.error);
    const ws = await prisma.workspace.findUnique({ where: { id: d.workspaceId } });
    if (!ws) throw new Error("Workspace not found.");
    const taken = await prisma.workspace.findFirst({ where: { customDomain: v.domain, id: { not: d.workspaceId } } });
    if (taken) throw new Error(`That domain is already connected to ${taken.name}.`);
    const details = await connectDomain(v.domain);
    const status = d.forceVerified || (details.verified && !details.misconfigured) ? "VERIFIED" : "PENDING";
    const finalDetails = d.forceVerified ? { ...details, verified: true, misconfigured: false, error: undefined } : details;
    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({
        where: { id: d.workspaceId },
        data: { customDomain: v.domain, domainStatus: status, domainCheckedAt: new Date(), domainDetails: finalDetails as object },
      });
      await writeAudit(tx, { workspaceId: d.workspaceId, actorName: "OnboardOps", actionType: "DOMAIN_CONNECTED", targetType: "Workspace", targetId: d.workspaceId, summary: `Custom domain ${v.domain} connected by site owner (${status.toLowerCase()})` });
      await staffAudit(tx, staff, { action: "DOMAIN_CONNECTED", targetType: "Workspace", targetId: d.workspaceId, workspaceId: d.workspaceId, summary: `Connected custom domain ${v.domain} (${status})` });
    });
    refresh();
    revalidatePath("/app", "layout");
    return undefined;
  });
}

export async function adminRemoveDomainAction(workspaceId: string) {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws || !ws.customDomain) throw new Error("No custom domain connected to this workspace.");
    const domain = ws.customDomain;
    await removeDomain(domain).catch(() => {});
    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({ where: { id: workspaceId }, data: { customDomain: null, domainStatus: "NONE", domainCheckedAt: null, domainDetails: undefined } });
      await writeAudit(tx, { workspaceId, actorName: "OnboardOps", actionType: "DOMAIN_REMOVED", targetType: "Workspace", targetId: workspaceId, summary: `Custom domain ${domain} removed by site owner` });
      await staffAudit(tx, staff, { action: "DOMAIN_REMOVED", targetType: "Workspace", targetId: workspaceId, workspaceId, summary: `Removed custom domain ${domain}` });
    });
    refresh();
    revalidatePath("/app", "layout");
    return undefined;
  });
}

/* ---------------- Website Maintenance Mode (Site Owner) ---------------- */
export async function setMaintenanceModeAction(input: unknown) {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    const d = z
      .object({
        enabled: z.boolean(),
        message: z.string().trim().max(1000).optional(),
        eta: z.string().trim().max(120).optional(),
        startsAt: z.string().trim().max(60).optional().nullable(),
        endsAt: z.string().trim().max(60).optional().nullable(),
        areas: z.array(z.enum(["site", "app", "portal", "api"])).min(1, "Pick at least one area").optional(),
        noticeMinutes: z.number().int().min(0).max(10080).optional(),
      })
      .parse(input);
    const state = await saveMaintenanceState({
      areas: d.areas,
      noticeMinutes: d.noticeMinutes,
      enabled: d.enabled,
      message: d.message,
      eta: d.eta,
      startsAt: d.startsAt || null,
      endsAt: d.endsAt || null,
      updatedBy: staff.name,
    });
    await prisma.$transaction((tx) =>
      staffAudit(tx, staff, {
        action: d.enabled || d.startsAt ? "MAINTENANCE_ENABLED" : "MAINTENANCE_DISABLED",
        targetType: "Platform",
        targetId: "maintenance",
        summary: d.enabled
          ? `Maintenance mode ENABLED for ${state.areas.join(", ")} (${state.message.slice(0, 80)})`
          : d.startsAt
            ? `Maintenance scheduled for ${state.areas.join(", ")} (${d.startsAt}${d.endsAt ? ` → ${d.endsAt}` : ""})`
            : "Maintenance mode DISABLED (site unlocked)",
      })
    );
    // Show it on the public status page straight away. A failure here must not undo the maintenance change.
    await reconcileMaintenance().catch((e) => console.error("status page update failed", e instanceof Error ? e.message : e));
    revalidatePath("/", "layout");
    return state;
  });
}

/* ---------------- Global Announcement Banner (Site Owner) ---------------- */
export async function setAnnouncementAction(input: unknown) {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    const d = z
      .object({
        enabled: z.boolean(),
        message: z.string().trim().max(400).default(""),
        tone: z.enum(["info", "warning", "success"]).default("info"),
        linkUrl: z.string().trim().max(300).optional().nullable(),
        linkLabel: z.string().trim().max(60).optional().nullable(),
        dismissible: z.boolean().default(true),
      })
      .parse(input);
    if (d.enabled && d.message.length < 3) throw new Error("Enter an announcement message.");
    const state = await saveAnnouncementState({ ...d, updatedBy: staff.name });
    await prisma.$transaction((tx) =>
      staffAudit(tx, staff, {
        action: d.enabled ? "ANNOUNCEMENT_ENABLED" : "ANNOUNCEMENT_DISABLED",
        targetType: "Platform",
        targetId: "announcement",
        summary: d.enabled ? `Global announcement posted: "${d.message.slice(0, 80)}"` : "Global announcement cleared",
      })
    );
    revalidatePath("/", "layout");
    return state;
  });
}

/* ---------------- Partner Workspace Badge & Legal Hold ---------------- */
export async function setPartnerStatusAction(input: unknown) {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    const d = z.object({ workspaceId: z.string(), partner: z.boolean() }).parse(input);
    const ws = await prisma.workspace.findUnique({ where: { id: d.workspaceId } });
    if (!ws) throw new Error("Workspace not found.");
    const nextFeatures = mergeWorkspaceMeta(ws.features, { __partner: d.partner });
    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({ where: { id: d.workspaceId }, data: { features: nextFeatures as object } });
      await staffAudit(tx, staff, {
        action: d.partner ? "PARTNER_ENABLED" : "PARTNER_DISABLED",
        targetType: "Workspace",
        targetId: d.workspaceId,
        workspaceId: d.workspaceId,
        summary: `${ws.name} ${d.partner ? "marked as Official Partner" : "partner badge removed"}`,
      });
    });
    refresh();
    revalidatePath("/app", "layout");
    return undefined;
  });
}

export async function adminToggleLegalHoldAction(input: unknown) {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    const d = z.object({ workspaceId: z.string(), legalHold: z.boolean(), reason: z.string().trim().max(500).default("") }).parse(input);
    const ws = await prisma.workspace.findUnique({ where: { id: d.workspaceId } });
    if (!ws) throw new Error("Workspace not found.");
    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({ where: { id: d.workspaceId }, data: { legalHold: d.legalHold, legalHoldReason: d.legalHold ? d.reason : "" } });
      await writeAudit(tx, { workspaceId: d.workspaceId, actorName: "OnboardOps", actionType: d.legalHold ? "LEGAL_HOLD_ENABLED" : "LEGAL_HOLD_DISABLED", targetType: "Workspace", targetId: d.workspaceId, summary: d.legalHold ? `Legal Hold placed by OnboardOps${d.reason ? `: ${d.reason}` : ""}` : "Legal Hold lifted by OnboardOps" });
      await staffAudit(tx, staff, { action: d.legalHold ? "LEGAL_HOLD_ON" : "LEGAL_HOLD_OFF", targetType: "Workspace", targetId: d.workspaceId, workspaceId: d.workspaceId, summary: `${ws.name} legal hold ${d.legalHold ? "enabled" : "lifted"}` });
    });
    refresh();
    revalidatePath("/app", "layout");
    return undefined;
  });
}

/* ---------------- Admin Email Log: Retry Failed & Send Test ---------------- */
export async function sendTestEmailAction(input: unknown) {
  return run(async () => {
    const staff = await requireStaff(SUPPORT_STAFF);
    const d = z
      .object({
        to: z.string().trim().email("Enter a valid recipient email"),
        subject: z.string().trim().min(2).max(150).default("OnboardOps test email"),
        message: z.string().trim().min(2).max(2000).default("This is a test message from the OnboardOps Staff Console verifying delivery from notifications@onboardops.org."),
      })
      .parse(input);
    const r = await sendEmail(d.to, d.subject, d.message, { kind: "admin-test" });
    await prisma.$transaction((tx) =>
      staffAudit(tx, staff, {
        action: "TEST_EMAIL_SENT",
        targetType: "Email",
        targetId: d.to,
        summary: `Test email to ${d.to} (${r.ok ? "sent" : `failed: ${r.error ?? "unknown"}`})`,
      })
    );
    refresh();
    if (!r.ok) throw new Error(r.error ?? "Failed to send test email.");
    return undefined;
  });
}

export async function retryEmailAction(emailLogId: string) {
  return run(async () => {
    const staff = await requireStaff(SUPPORT_STAFF);
    const logRow = await prisma.emailLog.findUnique({ where: { id: emailLogId } });
    if (!logRow) throw new Error("Email log entry not found.");
    const recipient = logRow.redirectedFrom || logRow.to;
    // Re-send a fresh notification or invite/recovery notice depending on kind
    const ws = logRow.workspaceId ? await prisma.workspace.findUnique({ where: { id: logRow.workspaceId } }) : null;
    let r: { ok: boolean; error?: string };
    if (logRow.kind === "invite" && ws) {
      const user = await prisma.user.findUnique({ where: { email: recipient.toLowerCase() } });
      if (user) {
        const raw = await createToken(user.id, "INVITE", 7 * 86400000);
        const link = `${process.env.APP_URL || "https://onboardops.org"}/reset-password?token=${raw}&invite=1`;
        const m = emails.invite(user.name, ws.name, link);
        r = await sendEmail(recipient, m.subject, m.text, { html: m.html, kind: "invite-retry", workspaceId: ws.id, workspaceName: ws.name });
      } else {
        r = await sendEmail(recipient, logRow.subject, `Re-sending notification from ${ws.name} on OnboardOps: ${logRow.subject}`, { kind: `${logRow.kind || "retry"}-retry`, workspaceId: ws.id, workspaceName: ws.name });
      }
    } else if (logRow.kind === "verify") {
      const user = await prisma.user.findUnique({ where: { email: recipient.toLowerCase() } });
      if (user) {
        const raw = await createToken(user.id, "VERIFY", 24 * 3600_000);
        const link = `${process.env.APP_URL || "https://onboardops.org"}/verify-email?token=${raw}`;
        const m = emails.verify(user.name, link);
        r = await sendEmail(recipient, m.subject, m.text, { html: m.html, kind: "verify-retry" });
      } else {
        r = await sendEmail(recipient, logRow.subject, `Re-sending verification email from OnboardOps.`, { kind: "verify-retry" });
      }
    } else {
      r = await sendEmail(
        recipient,
        logRow.subject,
        `This is a re-sent copy of your OnboardOps notification ("${logRow.subject}"). Sign in at ${process.env.APP_URL || "https://onboardops.org"} to view full details.`,
        { kind: `${logRow.kind || "email"}-retry`, workspaceId: ws?.id ?? null, workspaceName: ws?.name ?? null }
      );
    }
    await prisma.$transaction((tx) =>
      staffAudit(tx, staff, {
        action: "EMAIL_RETRIED",
        targetType: "EmailLog",
        targetId: emailLogId,
        workspaceId: logRow.workspaceId,
        summary: `Retried email "${logRow.subject}" to ${recipient} (${r.ok ? "sent" : `failed: ${r.error ?? "unknown"}`})`,
      })
    );
    refresh();
    if (!r.ok) throw new Error(r.error ?? "Retry failed.");
    return undefined;
  });
}
