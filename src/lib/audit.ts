import { keyedHash } from "./audit-hash";
import { dispatchAuditToSiem } from "./siem";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export type AuditInput = {
  workspaceId: string;
  actorMemberId?: string | null;
  actorName: string;
  actionType: string;
  targetType: string;
  targetId: string;
  summary: string;
  metadata?: Prisma.InputJsonValue;
};

/** Append-only. Each entry's hash chains over the previous entry's hash for the workspace. */
export async function writeAudit(tx: Tx, a: AuditInput) {
  const prev = await tx.auditLog.findFirst({ where: { workspaceId: a.workspaceId }, orderBy: { createdAt: "desc" }, select: { hash: true } });
  const createdAt = new Date();
  const hash = keyedHash({ prev: prev?.hash ?? "GENESIS", workspaceId: a.workspaceId, actionType: a.actionType, targetType: a.targetType, targetId: a.targetId, summary: a.summary, createdAt });
  const row = await tx.auditLog.create({
    data: {
      workspaceId: a.workspaceId,
      actorMemberId: a.actorMemberId ?? null,
      actorName: a.actorName,
      actionType: a.actionType,
      targetType: a.targetType,
      targetId: a.targetId,
      summary: a.summary,
      metadata: a.metadata ?? {},
      hash,
      createdAt,
    },
  });
  void dispatchAuditToSiem(a.workspaceId, row);
  return row;
}
