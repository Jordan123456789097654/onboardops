import { prisma } from "./prisma";
import { writeAudit } from "./audit";
import { emails, sendEmail } from "./email";
import { staffAudit, type Staff } from "./platform";
import { can, getSupportConfig } from "./support-config";
import { emitSupportEvent } from "./support";

/**
 * The staff actions that both the staff console and the Discord bot perform. The caller has already checked the staff member's role.
 * Keeping one copy means the console and the bot can never disagree about what an action does.
 */

const ownersOf = (workspaceId: string) => prisma.workspaceMember.findMany({ where: { workspaceId, role: "OWNER" }, include: { user: true } });

/** Replies to a support ticket by email, and optionally marks it solved. */
export async function replyTicketCore(staff: Staff, id: string, d: { body: string; markSolved: boolean }) {
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
  return { emailed: sent.ok, error: sent.error };
}

/** Locks a workspace and tells its owners why. */
export async function suspendWorkspaceCore(staff: Staff, d: { workspaceId: string; reason: string }) {
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
}

/** Unlocks a workspace and tells its owners. */
export async function unsuspendWorkspaceCore(staff: Staff, workspaceId: string) {
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
}

/** Takes a ticket for yourself. */
export async function claimTicketCore(staff: Staff, id: string) {
  const r = await prisma.supportRequest.findUnique({ where: { id }, select: { id: true, assignee: true, workspaceId: true, status: true } });
  if (!r) throw new Error("Ticket not found.");
  await prisma.$transaction(async (tx) => {
    await tx.supportRequest.update({ where: { id }, data: { assignee: staff.name, status: r.status === "SOLVED" ? "OPEN" : r.status } });
    await staffAudit(tx, staff, { action: "SUPPORT_UPDATE", targetType: "SupportRequest", targetId: id, workspaceId: r.workspaceId, summary: `Request ${id.slice(-8).toUpperCase()} claimed by ${staff.name}` });
  });
  return { previous: r.assignee };
}

/** Marks a ticket solved without sending a message. */
export async function solveTicketCore(staff: Staff, id: string) {
  const r = await prisma.supportRequest.findUnique({ where: { id }, select: { id: true, workspaceId: true } });
  if (!r) throw new Error("Ticket not found.");
  if (!can(await getSupportConfig(), staff.role, "close")) throw new Error("You don't have permission to close tickets.");
  await prisma.$transaction(async (tx) => {
    await tx.supportRequest.update({ where: { id }, data: { status: "SOLVED", solvedAt: new Date(), resolvedHint: false } });
    await staffAudit(tx, staff, { action: "SUPPORT_UPDATE", targetType: "SupportRequest", targetId: id, workspaceId: r.workspaceId, summary: `Request ${id.slice(-8).toUpperCase()} marked solved by ${staff.name}` });
  });
}
