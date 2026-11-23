"use server";
import { prisma } from "@/lib/prisma";
import { requirePerm } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { TASKS } from "@/lib/ai/tasks";
import { runTask } from "@/lib/ai/run";
import { guardAi } from "@/lib/ai/guard";
import { AiError } from "@/lib/ai/groq";
import { run, type Result } from "./_util";

/**
 * Runs one AI task and returns a DRAFT. The person reviews it on screen and saves through the normal screen; this action never changes records itself.
 * Every use is counted and audit-logged (the task and its size, never the text).
 */
export async function runAiTaskAction(taskId: string, input: unknown): Promise<Result<unknown>> {
  return run(async () => {
    const def = TASKS[taskId];
    if (!def) throw new Error("Unknown AI task.");
    const ctx = await requirePerm(def.perm);
    await guardAi(ctx.workspace, ctx.userId, def.risk);
    let out;
    try { out = await runTask(def, input); } catch (e) { if (e instanceof AiError) throw new Error(e.message); throw e; }
    const month = new Date().toISOString().slice(0, 7);
    await prisma.$transaction(async (tx) => {
      await tx.aiUsage.upsert({ where: { workspaceId_month_feature: { workspaceId: ctx.workspaceId, month, feature: def.id } }, create: { workspaceId: ctx.workspaceId, month, feature: def.id, requests: 1, inputTokens: out.usage.input, outputTokens: out.usage.output }, update: { requests: { increment: 1 }, inputTokens: { increment: out.usage.input }, outputTokens: { increment: out.usage.output } } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "AI_USED", targetType: "Workspace", targetId: ctx.workspaceId, summary: `Used AI: ${def.label}`, metadata: { task: def.id, inputChars: out.inChars, outputChars: out.outChars } });
    });
    return out.output;
  });
}
