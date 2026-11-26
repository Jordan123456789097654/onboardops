import { prisma } from "@/lib/prisma";
import { emails, sendEmail } from "@/lib/email";

export const DELETION_GRACE_DAYS = 14;

/**
 * Permanently deletes accounts whose 14-day grace period has passed. Runs once a day from the cron route.
 * Accounts that are the only owner of a workspace are skipped (and reported), so no workspace is left without an owner.
 */
export async function finalizeDueDeletions(now = new Date()): Promise<{ deleted: number; skipped: string[] }> {
  const cutoff = new Date(now.getTime() - DELETION_GRACE_DAYS * 86400000);
  const due = await prisma.user.findMany({ where: { deletionRequestedAt: { lte: cutoff } }, include: { memberships: true }, take: 50 });
  const out = { deleted: 0, skipped: [] as string[] };
  for (const user of due) {
    let blocked = false;
    for (const m of user.memberships.filter((x) => x.role === "OWNER")) {
      const others = await prisma.workspaceMember.count({ where: { workspaceId: m.workspaceId, role: "OWNER", id: { not: m.id } } });
      if (!others) blocked = true;
    }
    if (blocked) { out.skipped.push(user.id); continue; }
    const note = emails.privacyDone(user.name, "account", "Your OnboardOps account and sign-in details have been permanently deleted, as you asked. Records your employer keeps are controlled by them.");
    await sendEmail(user.email, "Your OnboardOps account has been deleted", note.text, { html: note.html, kind: "privacy-done" }).catch(() => undefined);
    await prisma.$transaction(async (tx) => {
      // Keys that acted as this person stop working with the account, and no longer point at a deleted member.
      await tx.apiKey.updateMany({ where: { createdByMemberId: { in: user.memberships.map((m) => m.id) }, revokedAt: null }, data: { revokedAt: now } });
      await tx.user.delete({ where: { id: user.id } }); // cascades memberships, sessions, tokens, passkeys
    });
    console.info(`Account ${user.id} deleted after its grace period.`);
    out.deleted++;
  }
  return out;
}
