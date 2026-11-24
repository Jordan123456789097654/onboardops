"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { enforceRate } from "@/lib/rate-limit";
import { ADMIN_ROLES, requireWorkspaceRole } from "@/lib/rbac";
import {
  DATA_REGIONS,
  DATA_REGION_LABELS,
  evaluateRetentionPurge,
  parseRetentionPolicy,
  type DataRegion,
  type RetentionPolicy,
  type RetentionPurgeResult,
} from "@/lib/retention";
import { run, type Result } from "./_util";

const residencySchema = z.object({
  dataRegion: z.enum(DATA_REGIONS),
  singleTenantRef: z
    .string()
    .trim()
    .max(120, "Tenant shard reference must be 120 characters or fewer")
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export async function saveDataResidencyAction(
  input: unknown,
): Promise<Result<{ dataRegion: DataRegion; singleTenantRef: string | null }>> {
  return run(async () => {
    const ctx = await requireWorkspaceRole(["OWNER"]);
    await enforceRate("governance", 30, 900);
    const d = residencySchema.parse(input);

    if (d.singleTenantRef && !/^[A-Za-z0-9._-]{2,120}$/.test(d.singleTenantRef)) {
      throw new Error(
        "Dedicated tenant shard ID must be 2–120 characters using letters, numbers, dots, underscores, or hyphens.",
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({
        where: { id: ctx.workspaceId },
        data: {
          dataRegion: d.dataRegion,
          singleTenantRef: d.singleTenantRef,
        },
      });
      await writeAudit(tx, {
        workspaceId: ctx.workspaceId,
        actorMemberId: ctx.id,
        actorName: ctx.user.name,
        actionType: "DATA_RESIDENCY_UPDATED",
        targetType: "Workspace",
        targetId: ctx.workspaceId,
        summary: `Data residency pinned to ${DATA_REGION_LABELS[d.dataRegion]}${d.singleTenantRef ? ` (tenant shard ${d.singleTenantRef})` : ""}`,
        metadata: {
          previousRegion: ctx.workspace.dataRegion,
          dataRegion: d.dataRegion,
          singleTenantRef: d.singleTenantRef,
        },
      });
    });

    revalidatePath("/app/settings");
    return { dataRegion: d.dataRegion, singleTenantRef: d.singleTenantRef };
  });
}

const retentionSchema = z.object({
  wormLocked: z.boolean(),
  i9OshaDays: z.coerce.number().int().min(30, "Minimum retention is 30 days").max(36500, "Maximum retention is 36,500 days"),
  disciplineDays: z.coerce.number().int().min(30, "Minimum retention is 30 days").max(36500, "Maximum retention is 36,500 days"),
  trainingDays: z.coerce.number().int().min(30, "Minimum retention is 30 days").max(36500, "Maximum retention is 36,500 days"),
  policiesDays: z.coerce.number().int().min(30, "Minimum retention is 30 days").max(36500, "Maximum retention is 36,500 days"),
  terminatedPiiDays: z.coerce.number().int().min(30, "Minimum retention is 30 days").max(36500, "Maximum retention is 36,500 days"),
});

export async function saveRetentionPoliciesAction(input: unknown): Promise<Result<RetentionPolicy>> {
  return run(async () => {
    const ctx = await requireWorkspaceRole(["OWNER"]);
    await enforceRate("governance", 30, 900);
    const d = retentionSchema.parse(input);

    const current = parseRetentionPolicy(ctx.workspace.retentionPolicies);

    if (current.wormLocked) {
      if (!d.wormLocked) {
        throw new Error("WORM retention lock is immutable and cannot be disabled once activated.");
      }
      const shortened: string[] = [];
      if (d.i9OshaDays < current.i9OshaDays) shortened.push(`I-9/OSHA (${current.i9OshaDays}d)`);
      if (d.disciplineDays < current.disciplineDays) shortened.push(`Discipline (${current.disciplineDays}d)`);
      if (d.trainingDays < current.trainingDays) shortened.push(`Training (${current.trainingDays}d)`);
      if (d.policiesDays < current.policiesDays) shortened.push(`Policies (${current.policiesDays}d)`);
      if (d.terminatedPiiDays < current.terminatedPiiDays) shortened.push(`Terminated PII (${current.terminatedPiiDays}d)`);
      if (shortened.length > 0) {
        throw new Error(
          `WORM retention lock is active — retention windows can only be extended, never shortened: ${shortened.join(", ")}.`,
        );
      }
    }

    const next: RetentionPolicy = {
      wormLocked: d.wormLocked,
      i9OshaDays: d.i9OshaDays,
      disciplineDays: d.disciplineDays,
      trainingDays: d.trainingDays,
      policiesDays: d.policiesDays,
      terminatedPiiDays: d.terminatedPiiDays,
      lastPurgeAt: current.lastPurgeAt ?? null,
      lastPurgeSummary: current.lastPurgeSummary ?? null,
    };

    const newlyLocked = !current.wormLocked && next.wormLocked;

    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({
        where: { id: ctx.workspaceId },
        data: { retentionPolicies: next as unknown as Prisma.InputJsonValue },
      });
      await writeAudit(tx, {
        workspaceId: ctx.workspaceId,
        actorMemberId: ctx.id,
        actorName: ctx.user.name,
        actionType: "RETENTION_POLICY_UPDATED",
        targetType: "Workspace",
        targetId: ctx.workspaceId,
        summary: newlyLocked
          ? `WORM immutable retention lock enabled (I-9/OSHA ${next.i9OshaDays}d, Discipline ${next.disciplineDays}d, PII ${next.terminatedPiiDays}d)`
          : `Retention policies updated (${next.wormLocked ? "WORM locked" : "editable"}: I-9/OSHA ${next.i9OshaDays}d, Discipline ${next.disciplineDays}d, Training ${next.trainingDays}d, Policies ${next.policiesDays}d, PII ${next.terminatedPiiDays}d)`,
        metadata: {
          wormLocked: next.wormLocked,
          newlyLocked,
          i9OshaDays: next.i9OshaDays,
          disciplineDays: next.disciplineDays,
          trainingDays: next.trainingDays,
          policiesDays: next.policiesDays,
          terminatedPiiDays: next.terminatedPiiDays,
        },
      });
    });

    revalidatePath("/app/settings");
    return next;
  });
}

const legalHoldSchema = z.object({
  enabled: z.boolean(),
  reason: z.string().trim().max(500, "Legal hold reason must be 500 characters or fewer").default(""),
});

export async function toggleWorkspaceLegalHoldAction(
  input: unknown,
): Promise<Result<{ legalHold: boolean; legalHoldReason: string; legalHoldAt: string | null }>> {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    await enforceRate("governance", 30, 900);
    const d = legalHoldSchema.parse(input);

    if (d.enabled && d.reason.length < 3) {
      throw new Error("Provide a matter reference or reason (at least 3 characters) to place the workspace under Legal Hold.");
    }

    const now = d.enabled ? new Date() : null;
    const prevReason = ctx.workspace.legalHoldReason || "";

    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({
        where: { id: ctx.workspaceId },
        data: {
          legalHold: d.enabled,
          legalHoldReason: d.enabled ? d.reason : "",
          legalHoldAt: now,
        },
      });
      await writeAudit(tx, {
        workspaceId: ctx.workspaceId,
        actorMemberId: ctx.id,
        actorName: ctx.user.name,
        actionType: d.enabled ? "LEGAL_HOLD_ENABLED" : "LEGAL_HOLD_RELEASED",
        targetType: "Workspace",
        targetId: ctx.workspaceId,
        summary: d.enabled
          ? `Workspace placed under Legal Hold: "${d.reason}"`
          : `Workspace Legal Hold released${prevReason ? ` (prior reason: "${prevReason}")` : ""}`,
        metadata: {
          enabled: d.enabled,
          reason: d.enabled ? d.reason : null,
          previousReason: prevReason || null,
        },
      });
    });

    revalidatePath("/app/settings");
    revalidatePath("/app", "layout");
    return {
      legalHold: d.enabled,
      legalHoldReason: d.enabled ? d.reason : "",
      legalHoldAt: now ? now.toISOString() : null,
    };
  });
}

const purgeSchema = z.object({
  dryRun: z.boolean().default(true),
});

export async function runRetentionPurgeAction(
  input: unknown,
): Promise<Result<RetentionPurgeResult & { summary: string }>> {
  return run(async () => {
    const ctx = await requireWorkspaceRole(["OWNER"]);
    await enforceRate("retention-purge", 15, 900);
    const d = purgeSchema.parse(input);

    const res = await evaluateRetentionPurge(ctx.workspaceId, d.dryRun);
    const nowIso = new Date().toISOString();

    const summary = res.blockedByLegalHold
      ? "Blocked by active Legal Hold — 0 records modified."
      : d.dryRun
        ? `Dry run preview: ${res.counts.expiredDocs} expired document(s) and ${res.counts.terminatedPii} terminated employee PII record(s) eligible.`
        : `Purged ${res.counts.expiredDocs} expired document(s) and redacted PII for ${res.counts.terminatedPii} terminated employee(s).`;

    const currentPolicy = parseRetentionPolicy(ctx.workspace.retentionPolicies);
    const updatedPolicy: RetentionPolicy = {
      ...currentPolicy,
      lastPurgeAt: nowIso,
      lastPurgeSummary: summary,
    };

    await prisma.$transaction(async (tx) => {
      if (!res.blockedByLegalHold) {
        await tx.workspace.update({
          where: { id: ctx.workspaceId },
          data: { retentionPolicies: updatedPolicy as unknown as Prisma.InputJsonValue },
        });
      }
      await writeAudit(tx, {
        workspaceId: ctx.workspaceId,
        actorMemberId: ctx.id,
        actorName: ctx.user.name,
        actionType: res.blockedByLegalHold
          ? "RETENTION_PURGE_BLOCKED"
          : d.dryRun
            ? "RETENTION_PURGE_DRY_RUN"
            : "RETENTION_PURGE_EXECUTED",
        targetType: "Workspace",
        targetId: ctx.workspaceId,
        summary,
        metadata: {
          dryRun: d.dryRun,
          blockedByLegalHold: res.blockedByLegalHold,
          expiredDocs: res.counts.expiredDocs,
          terminatedPii: res.counts.terminatedPii,
        },
      });
    });

    revalidatePath("/app/settings");
    return { ...res, summary };
  });
}
