"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { enforceRate } from "@/lib/rate-limit";
import { ADMIN_ROLES, requireWorkspaceRole } from "@/lib/rbac";
import { seal } from "@/lib/secret-box";
import {
  getSiemPublicConfig,
  parseSiemStoredConfig,
  sendSiemTestEvent,
  SIEM_PROVIDERS,
  validateSiemEndpointUrl,
  type SiemPublicConfig,
  type SiemStoredConfig,
} from "@/lib/siem";
import { run, type Result } from "./_util";

const saveSiemSchema = z.object({
  enabled: z.boolean().default(true),
  provider: z.enum(SIEM_PROVIDERS),
  endpointUrl: z.string().trim().min(1, "Enter an HTTPS SIEM endpoint URL").max(1000),
  token: z.string().trim().max(4096).optional(),
  indexName: z.string().trim().max(120).optional().default(""),
  sourceTag: z.string().trim().max(120).optional().default(""),
});

export async function saveSiemAction(input: unknown): Promise<Result<SiemPublicConfig>> {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    await enforceRate("siem", 30, 900);
    const d = saveSiemSchema.parse(input);

    const check = validateSiemEndpointUrl(d.endpointUrl);
    if (!check.ok) throw new Error(check.error);

    const existing = parseSiemStoredConfig(ctx.workspace.siemConfig);
    const tokenEnc = d.token && d.token.length > 0 ? seal(d.token) : existing?.tokenEnc ?? "";
    if (!tokenEnc) {
      throw new Error("Enter your SIEM API key or HEC token.");
    }

    const stored: SiemStoredConfig = {
      enabled: d.enabled,
      provider: d.provider,
      endpointUrl: check.url.toString(),
      tokenEnc,
      indexName: d.indexName || "",
      sourceTag: d.sourceTag || "",
      updatedAt: new Date().toISOString(),
    };

    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({
        where: { id: ctx.workspaceId },
        data: { siemConfig: stored as unknown as Prisma.InputJsonValue },
      });
      await writeAudit(tx, {
        workspaceId: ctx.workspaceId,
        actorMemberId: ctx.id,
        actorName: ctx.user.name,
        actionType: "SIEM_CONFIG_UPDATED",
        targetType: "Workspace",
        targetId: ctx.workspaceId,
        summary: `SIEM streaming ${d.enabled ? "enabled" : "saved (paused)"} for ${d.provider} (${check.url.hostname})`,
        metadata: {
          provider: d.provider,
          enabled: d.enabled,
          host: check.url.hostname,
          indexName: stored.indexName || null,
          sourceTag: stored.sourceTag || null,
          tokenRotated: Boolean(d.token && d.token.length > 0),
        },
      });
    });

    revalidatePath("/app/settings");
    return getSiemPublicConfig(stored);
  });
}

export async function testSiemAction(): Promise<Result<{ ok: boolean; statusCode: number | null; error?: string }>> {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    await enforceRate("siem-test", 20, 900);

    const res = await sendSiemTestEvent(ctx.workspaceId, ctx.user.name);
    await prisma.$transaction((tx) =>
      writeAudit(tx, {
        workspaceId: ctx.workspaceId,
        actorMemberId: ctx.id,
        actorName: ctx.user.name,
        actionType: "SIEM_TEST_SENT",
        targetType: "Workspace",
        targetId: ctx.workspaceId,
        summary: res.ok
          ? `SIEM test event delivered (HTTP ${res.statusCode ?? "OK"})`
          : `SIEM test event failed: ${res.error ?? "Unknown error"}`,
        metadata: {
          ok: res.ok,
          statusCode: res.statusCode,
          ...(res.error ? { error: res.error.slice(0, 200) } : {}),
        },
      }),
    );

    revalidatePath("/app/settings");
    return res;
  });
}

export async function removeSiemAction(): Promise<Result> {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    await enforceRate("siem", 30, 900);

    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({
        where: { id: ctx.workspaceId },
        data: { siemConfig: Prisma.DbNull },
      });
      await writeAudit(tx, {
        workspaceId: ctx.workspaceId,
        actorMemberId: ctx.id,
        actorName: ctx.user.name,
        actionType: "SIEM_CONFIG_REMOVED",
        targetType: "Workspace",
        targetId: ctx.workspaceId,
        summary: "SIEM audit log streaming configuration was removed",
      });
    });

    revalidatePath("/app/settings");
    return undefined;
  });
}
