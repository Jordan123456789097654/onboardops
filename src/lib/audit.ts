import { createHash } from "crypto";
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
  const hash = createHash("sha256")
    .update([prev?.hash ?? "GENESIS", a.workspaceId, a.actionType, a.targetType, a.targetId, a.summary, createdAt.toISOString()].join("|"))
    .digest("hex");
  return tx.auditLog.create({
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
}
