import { prisma } from "./prisma";
import { emails, sendEmail } from "./email";
import { postDiscord } from "./discord-events";
import { staffAudit, type Staff } from "./platform";
import { resolvePlatformRole, PERMANENT_OWNER_EMAILS } from "./platform-role";

/** Moderation actions shared by the staff console and the Discord bot. The caller has already checked the staff member's role. */

const appUrl = () => (process.env.APP_URL || "https://onboardops.org").trim().replace(/^["']+|["']+$/g, "").replace(/\/$/, "");

export async function banUserCore(staff: Staff, userId: string, reason: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, bannedAt: true, platformRole: true } });
  if (!user) throw new Error("Account not found.");
  if (user.bannedAt) throw new Error("This account is already banned.");
  if (resolvePlatformRole({ email: user.email, platformRole: user.platformRole }) === "OWNER") throw new Error("An owner account can't be banned this way.");
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { bannedAt: new Date(), banReason: reason } });
    await tx.userSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.moderationCase.create({ data: { targetType: "USER", userId: user.id, action: "BAN", reason, actorName: staff.name } });
    await staffAudit(tx, staff, { action: "ACCOUNT_BAN", targetType: "User", targetId: user.id, summary: `Banned ${user.email}. Reason: ${reason}` });
  });
  await postDiscord("modlog", { title: "Account banned", description: reason, fields: [{ name: "By", value: staff.name }], tone: "bad" });
  const m = emails.accountBanned(user.name, reason);
  await sendEmail(user.email, m.subject, m.text, { html: m.html, kind: "moderation" });
}

export async function unbanUserCore(staff: Staff, userId: string, reason: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, bannedAt: true } });
  if (!user) throw new Error("Account not found.");
  if (!user.bannedAt) throw new Error("This account is not banned.");
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { bannedAt: null, banReason: "" } });
    await tx.moderationCase.create({ data: { targetType: "USER", userId: user.id, action: "UNBAN", reason, actorName: staff.name } });
    await staffAudit(tx, staff, { action: "ACCOUNT_UNBAN", targetType: "User", targetId: user.id, summary: `Unbanned ${user.email}. Reason: ${reason}` });
  });
  await postDiscord("modlog", { title: "Account restored", description: reason, fields: [{ name: "By", value: staff.name }], tone: "good" });
  const m = emails.accountUnbanned(user.name);
  await sendEmail(user.email, m.subject, m.text, { html: m.html, kind: "moderation" });
}

export async function warnUserCore(staff: Staff, userId: string, reason: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
  if (!user) throw new Error("Account not found.");
  await prisma.$transaction(async (tx) => {
    await tx.moderationCase.create({ data: { targetType: "USER", userId: user.id, action: "WARN", reason, actorName: staff.name } });
    await staffAudit(tx, staff, { action: "ACCOUNT_WARN", targetType: "User", targetId: user.id, summary: `Warned ${user.email}. Reason: ${reason}` });
  });
  await postDiscord("modlog", { title: "Account warned", description: reason, fields: [{ name: "By", value: staff.name }], tone: "warn" });
  const m = emails.moderationWarning(user.name, reason);
  await sendEmail(user.email, m.subject, m.text, { html: m.html, kind: "moderation" });
}

export async function decideAppealCore(staff: Staff, appealId: string, overturn: boolean, note: string) {
  const appeal = await prisma.moderationAppeal.findUnique({ where: { id: appealId }, include: { case: true } });
  if (!appeal) throw new Error("Appeal not found.");
  if (appeal.status !== "PENDING") throw new Error("This appeal has already been decided.");
  const c = appeal.case;
  let notifyName = "there";
  let notifyEmail = appeal.email;
  await prisma.$transaction(async (tx) => {
    if (overturn && c.targetType === "USER" && c.userId) {
      await tx.user.update({ where: { id: c.userId }, data: { bannedAt: null, banReason: "" } });
      await tx.moderationCase.create({ data: { targetType: "USER", userId: c.userId, action: "UNBAN", reason: `Appeal upheld: ${note}`, actorName: staff.name } });
    }
    if (overturn && c.targetType === "WORKSPACE" && c.workspaceId) {
      await tx.workspace.update({ where: { id: c.workspaceId }, data: { suspendedAt: null, suspendedReason: "" } });
      await tx.moderationCase.create({ data: { targetType: "WORKSPACE", workspaceId: c.workspaceId, action: "UNSUSPEND", reason: `Appeal upheld: ${note}`, actorName: staff.name } });
    }
    await tx.moderationAppeal.update({ where: { id: appeal.id }, data: { status: overturn ? "OVERTURNED" : "UPHELD", decisionNote: note, decidedBy: staff.name, decidedAt: new Date() } });
    await staffAudit(tx, staff, { action: "APPEAL_DECIDED", targetType: "Appeal", targetId: appeal.id, summary: `Appeal ${overturn ? "overturned" : "upheld"}. ${note}` });
  });
  const u = c.userId ? await prisma.user.findUnique({ where: { id: c.userId }, select: { name: true, email: true } }) : null;
  if (u) { notifyName = u.name; notifyEmail = u.email; }
  await postDiscord("modlog", { title: `Appeal ${overturn ? "overturned" : "upheld"}`, description: note, fields: [{ name: "By", value: staff.name }], tone: overturn ? "good" : "info" });
  const m = emails.appealDecided(notifyName, overturn, note);
  await sendEmail(notifyEmail, m.subject, m.text, { html: m.html, kind: "moderation" });
}

/** How many people hold the Owner staff role. */
export async function ownerCount(): Promise<number> {
  const boot = (process.env.PLATFORM_OWNER_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const rows = await prisma.user.findMany({ where: { OR: [{ platformRole: "OWNER" }, { email: { in: [...PERMANENT_OWNER_EMAILS, ...boot] } }] }, select: { id: true } });
  return rows.length;
}

/** With two or more owners, a ban started from Discord waits for a different owner to approve it. With one owner it happens at once. */
export async function requestBanCore(staff: Staff, userId: string, reason: string): Promise<{ executed: boolean; requestId?: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, bannedAt: true } });
  if (!user) throw new Error("Account not found.");
  if (user.bannedAt) throw new Error("This account is already banned.");
  if ((await ownerCount()) < 2) {
    await banUserCore(staff, userId, reason);
    return { executed: true };
  }
  const existing = await prisma.moderationRequest.findFirst({ where: { userId, status: "PENDING", kind: "BAN" } });
  if (existing) throw new Error("A ban for this account is already waiting for approval.");
  const req = await prisma.moderationRequest.create({ data: { kind: "BAN", userId, reason, requestedBy: staff.name, requestedById: staff.id } });
  await postDiscord("modlog", {
    title: "Ban waiting for a second owner",
    description: reason,
    fields: [{ name: "Requested by", value: staff.name }],
    url: `${appUrl()}/admin/moderation`,
    tone: "warn",
    buttons: [
      { id: `banreq:approve:${req.id}`, label: "Approve ban", style: "danger" },
      { id: `banreq:deny:${req.id}`, label: "Deny", style: "secondary" },
    ],
  });
  return { executed: false, requestId: req.id };
}

/** A different owner approves or denies a waiting ban. Requests expire after 24 hours. */
export async function decideBanRequestCore(staff: Staff, requestId: string, approve: boolean) {
  const req = await prisma.moderationRequest.findUnique({ where: { id: requestId } });
  if (!req || req.status !== "PENDING") throw new Error("That request was already decided.");
  if (req.requestedById === staff.id) throw new Error("A different owner has to approve this ban.");
  if (Date.now() - req.createdAt.getTime() > 24 * 3600_000) {
    await prisma.moderationRequest.update({ where: { id: req.id }, data: { status: "EXPIRED" } });
    throw new Error("That request expired. Start the ban again.");
  }
  await prisma.moderationRequest.update({ where: { id: req.id }, data: { status: approve ? "APPROVED" : "DENIED", decidedBy: staff.name, decidedAt: new Date() } });
  if (approve) await banUserCore(staff, req.userId, `${req.reason} (requested by ${req.requestedBy}, approved by ${staff.name})`);
  else await postDiscord("modlog", { title: "Ban request denied", fields: [{ name: "By", value: staff.name }], tone: "info" });
}

/** What the moderation record says about an email address. No message content, no other personal data. */
export async function lookupUserCore(email: string) {
  const e = email.toLowerCase();
  const u = await prisma.user.findFirst({ where: { OR: [{ email: e }, { extraEmails: { some: { email: e } } }] }, select: { id: true, bannedAt: true, banReason: true, createdAt: true } });
  if (!u) return { found: false as const };
  const cases = await prisma.moderationCase.groupBy({ by: ["action"], where: { userId: u.id }, _count: { _all: true } });
  const counts = Object.fromEntries(cases.map((c) => [c.action, c._count._all]));
  const pendingAppeals = await prisma.moderationAppeal.count({ where: { status: "PENDING", case: { userId: u.id } } });
  return { found: true as const, id: u.id, banned: !!u.bannedAt, banReason: u.banReason, created: u.createdAt.toISOString(), counts, pendingAppeals };
}
