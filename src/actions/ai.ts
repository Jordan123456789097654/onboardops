"use server";
import { prisma } from "@/lib/prisma";
import { ADMIN_ROLES, ALL_ROLES, requirePerm, requireWorkspaceRole, STAFF_ROLES } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { TASKS } from "@/lib/ai/tasks";
import { runTask } from "@/lib/ai/run";
import { guardAi } from "@/lib/ai/guard";
import { AiError } from "@/lib/ai/groq";
import { redact } from "@/lib/ai/redact";
import { run, type Result } from "./_util";

const IMAGE_DATA_URL_RE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMAGE_CHARS = 3_500_000;

/** Recursively scrubs personal details and workspace employee names from text fields before a "care" task leaves the server. */
function redactPayload(value: unknown, names: string[]): { cleaned: unknown; restore: <T>(v: T) => T } {
  const SKIP_KEYS = new Set(["severity", "incidentType", "target", "employeeName", "names", "id", "caseRef", "caseNumber", "at", "type", "kind", "status", "headers", "fileName"]);
  const walk = (v: unknown, key?: string): unknown => {
    if (key && SKIP_KEYS.has(key)) {
      if (key === "employeeName") return undefined;
      if (key === "names") return [];
      return v;
    }
    if (typeof v === "string") return redact(v, names).text;
    if (Array.isArray(v)) return v.map((x) => walk(x));
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = walk(val, k);
      return out;
    }
    return v;
  };
  const cleaned = walk(value);
  const restore = redact("", names).restore;
  return { cleaned, restore };
}

async function resolveCtx(perm: string) {
  if (perm === "all") return requireWorkspaceRole(ALL_ROLES);
  if (perm === "staff") return requireWorkspaceRole(STAFF_ROLES);
  if (perm === "admin") return requireWorkspaceRole(ADMIN_ROLES);
  return requirePerm(perm);
}

/**
 * Runs one AI task and returns a DRAFT. The person reviews it on screen and saves through the normal screen; this action never changes records itself.
 * Every use is counted and audit-logged (the task and its size, never the text).
 */
export async function runAiTaskAction(taskId: string, input: unknown): Promise<Result<unknown>> {
  return run(async () => {
    const def = TASKS[taskId];
    if (!def) throw new Error("Unknown AI task.");
    const ctx = await resolveCtx(def.perm);
    await guardAi(ctx.workspace, ctx.userId, def.risk);

    // Pull out optional base64 image data URL for vision tasks before text validation/redaction.
    let image: string | undefined;
    let payload: unknown = input;
    if (input && typeof input === "object" && "image" in (input as Record<string, unknown>)) {
      const { image: rawImg, ...rest } = input as Record<string, unknown>;
      if (typeof rawImg === "string" && rawImg.trim()) {
        if (rawImg.length > MAX_IMAGE_CHARS || !IMAGE_DATA_URL_RE.test(rawImg)) {
          throw new Error("Use a JPEG, PNG, or WebP photo under 2.5 MB.");
        }
        image = rawImg;
      }
      payload = rest;
    }

    let restore: (<T>(v: T) => T) | null = null;
    let extraRules: string | undefined;

    // Vision credential/document matching needs employee labels intact for matching; all text-only care tasks scrub workspace names & PII.
    const shouldRedactNames = def.risk === "care" && def.tier !== "vision";
    const keepRedactedOutput = def.id === "infraction.redact";

    if (shouldRedactNames) {
      const empRows = await prisma.employeeProfile.findMany({
        where: { workspaceId: ctx.workspaceId },
        select: { fullName: true },
        take: 500,
      });
      const extraNames: string[] = [];
      if (payload && typeof payload === "object") {
        const o = payload as Record<string, unknown>;
        if (typeof o.employeeName === "string" && o.employeeName.trim()) extraNames.push(o.employeeName);
        if (Array.isArray(o.names)) {
          for (const n of o.names) if (typeof n === "string" && n.trim()) extraNames.push(n);
        }
      }
      const names = [...empRows.map((e) => e.fullName), ...extraNames];
      const red = redactPayload(payload, names);
      payload = red.cleaned;
      if (!keepRedactedOutput) restore = red.restore;
      extraRules = "Keep placeholder tokens such as [Person 1], [Person 2], [email], [phone], [id], or [number] verbatim whenever they appear in the material.";
    }

    let out;
    try {
      out = await runTask(def, payload, { extraRules, image });
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
        metadata: { task: def.id, inputChars: out.inChars, outputChars: out.outChars, redacted: shouldRedactNames },
      });
    });
    return finalOutput;
  });
}

/**
 * Compares one infraction case against up to 15 anonymized past cases in the same workspace.
 * Employee names and PII are scrubbed server-side before anything leaves the server. Suggestion only.
 */
export async function compareInfractionCaseAction(caseId: string): Promise<Result<{ consistencyNote: string; similarCases: { caseRef: string; severity: string; points: number; similarity: string }[]; considerations: string[] }>> {
  return run(async () => {
    const def = TASKS["infraction.compare"];
    const ctx = await requireWorkspaceRole(STAFF_ROLES);
    await guardAi(ctx.workspace, ctx.userId, "care");

    const [target, others, empRows] = await Promise.all([
      prisma.infractionCase.findFirst({ where: { id: caseId, workspaceId: ctx.workspaceId } }),
      prisma.infractionCase.findMany({
        where: { workspaceId: ctx.workspaceId, id: { not: caseId } },
        orderBy: { createdAt: "desc" },
        take: 15,
        select: { id: true, severity: true, pointsAdded: true, policyViolated: true, summary: true },
      }),
      prisma.employeeProfile.findMany({ where: { workspaceId: ctx.workspaceId }, select: { fullName: true }, take: 500 }),
    ]);
    if (!target) throw new Error("Case not found.");
    if (others.length === 0) {
      return {
        consistencyNote: "There are no other past cases in this workspace to compare against yet.",
        similarCases: [],
        considerations: ["Once additional cases exist, AI comparison can highlight severity and point consistency patterns."],
      };
    }

    const names = empRows.map((e) => e.fullName);
    const scrub = (s: string) => redact(s, names).text;
    const payload = {
      current: { severity: target.severity, points: target.pointsAdded, policy: target.policyViolated, summary: scrub(target.summary) },
      pastCases: others.map((c, idx) => ({
        caseRef: `PAST-${idx + 1}`,
        severity: c.severity,
        points: c.pointsAdded,
        policy: c.policyViolated,
        summary: scrub(c.summary),
      })),
    };

    let out;
    try {
      out = await runTask(def, payload);
    } catch (e) {
      if (e instanceof AiError) throw new Error(e.message);
      throw e;
    }

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
        targetType: "Infraction",
        targetId: caseId,
        summary: `Used AI: ${def.label} (${others.length} anonymized past cases)`,
        metadata: { task: def.id, comparedCount: others.length, redacted: true },
      });
    });

    return out.output as { consistencyNote: string; similarCases: { caseRef: string; severity: string; points: number; similarity: string }[]; considerations: string[] };
  });
}
