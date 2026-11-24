"use server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ADMIN_ROLES, requireWorkspaceRole } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { open, seal } from "@/lib/secret-box";
import { enforceRate } from "@/lib/rate-limit";
import { duoHealthCheck, normalizeDuoHost, parseDuoStoredConfig, type DuoStoredConfig } from "@/lib/duo";
import { run, type Result } from "./_util";

async function admin() {
  const c = await requireWorkspaceRole(ADMIN_ROLES);
  await enforceRate("duo-admin", 20, 900);
  return c;
}

const saveSchema = z.object({
  apiHost: z.string().trim().min(5, "Enter your Duo API hostname").max(120),
  clientId: z.string().trim().min(5, "Enter the Duo Client ID").max(200),
  clientSecret: z.string().trim().max(500).optional(),
  enabled: z.boolean().default(false),
});

const healthSchema = z
  .object({
    apiHost: z.string().trim().max(120).optional(),
    clientId: z.string().trim().max(200).optional(),
    clientSecret: z.string().trim().max(500).optional(),
  })
  .optional();

/** Saves Duo Security Universal Prompt configuration. Client secret is sealed with AES-256-GCM and never returned. */
export async function saveDuoAction(input: unknown): Promise<Result> {
  return run(async () => {
    const c = await admin();
    const d = saveSchema.parse(input);
    const apiHost = normalizeDuoHost(d.apiHost);

    const existing = parseDuoStoredConfig(c.workspace.duoConfig);
    if (!existing && !d.clientSecret) {
      throw new Error("Enter the Duo Client Secret.");
    }

    const nextConfig: DuoStoredConfig = {
      enabled: d.enabled,
      apiHost,
      clientId: d.clientId,
      clientSecretEnc: d.clientSecret ? seal(d.clientSecret) : existing!.clientSecretEnc,
      updatedAt: new Date().toISOString(),
    };

    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({
        where: { id: c.workspaceId },
        data: { duoConfig: nextConfig as unknown as Prisma.InputJsonValue },
      });
      await writeAudit(tx, {
        workspaceId: c.workspaceId,
        actorMemberId: c.id,
        actorName: c.user.name,
        actionType: existing ? "DUO_CONFIG_UPDATED" : "DUO_CONFIG_SAVED",
        targetType: "Workspace",
        targetId: c.workspaceId,
        summary: `Duo Security Universal Prompt ${d.enabled ? "enabled" : "saved (disabled)"} (${apiHost}${d.clientSecret ? "; client secret updated" : ""})`,
        metadata: { apiHost, enabled: d.enabled, secretUpdated: !!d.clientSecret },
      });
    });

    revalidatePath("/app", "layout");
    return undefined;
  });
}

/** Runs a live Duo /oauth/v1/health_check using the provided or stored credentials. */
export async function testDuoHealthAction(input?: unknown): Promise<Result<{ timestamp?: number }>> {
  return run(async () => {
    const c = await admin();
    const d = healthSchema.parse(input);
    const existing = parseDuoStoredConfig(c.workspace.duoConfig);

    const apiHostRaw = d?.apiHost?.trim() || existing?.apiHost || "";
    const clientId = d?.clientId?.trim() || existing?.clientId || "";
    const clientSecret =
      d?.clientSecret?.trim() || (existing ? open(existing.clientSecretEnc) ?? "" : "");

    if (!apiHostRaw || !clientId || !clientSecret) {
      throw new Error("Enter your Duo API hostname, Client ID, and Client Secret first.");
    }

    const apiHost = normalizeDuoHost(apiHostRaw);
    const res = await duoHealthCheck({ apiHost, clientId, clientSecret });
    if (!res.ok) {
      throw new Error(res.error);
    }

    await prisma.$transaction((tx) =>
      writeAudit(tx, {
        workspaceId: c.workspaceId,
        actorMemberId: c.id,
        actorName: c.user.name,
        actionType: "DUO_HEALTH_CHECK",
        targetType: "Workspace",
        targetId: c.workspaceId,
        summary: `Duo Security health check succeeded against ${apiHost}`,
      }),
    );

    return { timestamp: res.timestamp };
  });
}

/** Removes Duo Security configuration and deletes the sealed client secret from the workspace. */
export async function removeDuoAction(): Promise<Result> {
  return run(async () => {
    const c = await admin();
    const existing = parseDuoStoredConfig(c.workspace.duoConfig);
    if (!existing) throw new Error("Duo Security is not configured.");

    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({
        where: { id: c.workspaceId },
        data: { duoConfig: Prisma.DbNull },
      });
      await writeAudit(tx, {
        workspaceId: c.workspaceId,
        actorMemberId: c.id,
        actorName: c.user.name,
        actionType: "DUO_CONFIG_REMOVED",
        targetType: "Workspace",
        targetId: c.workspaceId,
        summary: "Duo Security Universal Prompt configuration and stored client secret removed",
      });
    });

    revalidatePath("/app", "layout");
    return undefined;
  });
}
