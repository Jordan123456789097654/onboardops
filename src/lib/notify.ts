import type { Prisma, PrismaClient, Role } from "@prisma/client";

type Db = Prisma.TransactionClient | PrismaClient;
export type NotifyInput = { title: string; body?: string; href?: string };

export async function notifyMembers(db: Db, workspaceId: string, memberIds: (string | null | undefined)[], n: NotifyInput) {
  const ids = Array.from(new Set(memberIds.filter((x): x is string => !!x)));
  if (!ids.length) return;
  await db.notification.createMany({ data: ids.map((memberId) => ({ workspaceId, memberId, title: n.title, body: n.body ?? "", href: n.href ?? null })) });
}

export async function notifyRoles(db: Db, workspaceId: string, roles: Role[], n: NotifyInput, exceptMemberId?: string) {
  const ms = await db.workspaceMember.findMany({ where: { workspaceId, role: { in: roles } }, select: { id: true } });
  await notifyMembers(db, workspaceId, ms.map((m) => m.id).filter((id) => id !== exceptMemberId), n);
}

export async function notifyEmployee(db: Db, workspaceId: string, employeeId: string, n: NotifyInput) {
  const e = await db.employeeProfile.findUnique({ where: { id: employeeId }, select: { memberId: true } });
  await notifyMembers(db, workspaceId, [e?.memberId], n);
}
