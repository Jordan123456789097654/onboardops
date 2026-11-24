"use server";
import { prisma } from "@/lib/prisma";
import { requirePerm, requireWorkspaceRole, STAFF_ROLES } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { TASKS } from "@/lib/ai/tasks";
import { runTask } from "@/lib/ai/run";
import { guardAi } from "@/lib/ai/guard";
import { AiError } from "@/lib/ai/groq";
import { redact } from "@/lib/ai/redact";
import { run, type Result } from "./_util";

/** Recursively scrubs personal details and workspace employee names from text fields before a "care" task leaves the server. */
function redactPayload(value: unknown, names: string[]): { cleaned: unknown; restore: <T>(v: T) => T } {
  const restorers: (<T>(v: T) => T)[] = [];
  const SKIP_KEYS = new Set(["severity", "incidentType", "target", "employeeName", "names"]);
  const walk = (v: unknown, key?: string): unknown => {
    if (key && SKIP_KEYS.has(key)) {
      // Never send raw employee names list to the prompt builder
      if (key === "employeeName") return undefined;
      if (key === "names") return [];
      return v;
    }
    if (typeof v === "string") {
      const r = redact(v, names);
      restorers.push(r.restore);
      return r.text;
    }
    if (Array.isArray(v)) return v.map((x) => walk(x));
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = walk(val, k);
      return out;
    }
    return v;
  };
  const cleaned = walk(value);
  const restore = <T,>(out: T): T => restorers.reduce((acc, fn) => fn(acc), out);
  return { cleaned, restore };
}

/**
 * Runs one AI task and returns a DRAFT. The person reviews it on screen and saves through the normal screen; this action never changes records itself.
 * Every use is counted and audit-logged (the task and its size, never the text).
 */
export async function runAiTaskAction(taskId: string, input: unknown): Promise<Result<unknown>> {
  return run(async () => {
    const def = TASKS[taskId];
    if (!def) throw new Error("Unknown AI task.");
    const ctx = def.perm === "staff" ? await requireWorkspaceRole(STAFF_ROLES) : await requirePerm(def.perm);
    await guardAi(ctx.workspace, ctx.userId, def.risk);

    let payload = input;
    let restore: (<T>(v: T) => T) | null = null;
    let extraRules: string | undefined;

    if (def.risk === "care") {
      const empRows = await prisma.employeeProfile.findMany({
        where: { workspaceId: ctx.workspaceId },
        select: { fullName: true },
        take: 500,
      });
      const extraNames: string[] = [];
      if (input && typeof input === "object") {
        const o = input as Record<string, unknown>;
        if (typeof o.employeeName === "string" && o.employeeName.trim()) extraNames.push(o.employeeName);
        if (Array.isArray(o.names)) {
          for (const n of o.names) if (typeof n === "string" && n.trim()) extraNames.push(n);
        }
      }
      const names = [...empRows.map((e) => e.fullName), ...extraNames];
      const red = redactPayload(input, names);
      payload = red.cleaned;
      restore = red.restore;
      extraRules = "Keep placeholder tokens such as [Person 1], [Person 2], [email], [phone], [id], or [number] verbatim whenever they appear in the material.";
    }

    let out;
    try {
      out = await runTask(def, payload, { extraRules });
    } catch (e) {
      if (e instanceof AiError) throw new Error(e.message);
      throw e;
    }

    const finalOutput = restore ? restore(out.output) : out.output;
    const month = new Date().toISOString().slice(0, 7);
    await prisma.$transaction(async (tx) => {
      await tx.aiUsage.upsert({
        where: { workspaceId_month_feature: { workspaceId: ctx.workspaceId, month, feature: def.id } },
        create: { workspaceId: ctx.workspaceId, month, feature: def.id, requests: 1, inputTokens: out.usage.input, outputTokens: out.usage.output },
        update: { requests: { increment: 1 }, inputTokens: { increment: out.usage.input }, outputTokens: { increment: out.usage.output } },
      });
      await writeAudit(tx, {
        workspaceId: ctx.workspaceId,
        actorMemberId: ctx.id,
        actorName: ctx.user.name,
        actionType: "AI_USED",
        targetType: "Workspace",
        targetId: ctx.workspaceId,
        summary: `Used AI: ${def.label}`,
        metadata: { task: def.id, inputChars: out.inChars, outputChars: out.outChars, redacted: def.risk === "care" },
      });
    });
    return finalOutput;
  });
}
