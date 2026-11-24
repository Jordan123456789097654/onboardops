"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { enforceRate } from "@/lib/rate-limit";
import { requireWorkspaceRole } from "@/lib/rbac";
import { open, seal } from "@/lib/secret-box";
import { run, type Result } from "./_util";

const KMS_PROVIDERS = ["aws_kms", "gcp_kms", "azure_key_vault"] as const;
export type CloudKmsProvider = (typeof KMS_PROVIDERS)[number];

export type CloudKmsPublicConfig = {
  enabled: boolean;
  provider: "aws_kms" | "gcp_kms" | "azure_key_vault";
  keyUri: string;
  region: string;
  authPrincipal: string;
  configured: boolean;
  envelopeVersion: number;
  lastVerifiedAt: string | null;
  lastRotatedAt: string | null;
};

type CloudKmsStoredConfig = {
  enabled: boolean;
  provider: CloudKmsProvider;
  keyUri: string;
  region: string;
  authPrincipal: string;
  credentialsEnc: string | null;
  envelopeVersion: number;
  lastVerifiedAt: string | null;
  lastRotatedAt: string | null;
  updatedAt: string;
};

function isProvider(v: unknown): v is CloudKmsProvider {
  return typeof v === "string" && (KMS_PROVIDERS as readonly string[]).includes(v);
}

function parseStored(raw: unknown): CloudKmsStoredConfig | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const provider: CloudKmsProvider = isProvider(o.provider) ? o.provider : "aws_kms";
  const keyUri = typeof o.keyUri === "string" ? o.keyUri.trim() : "";
  if (!keyUri) return null;
  return {
    enabled: o.enabled === true,
    provider,
    keyUri,
    region: typeof o.region === "string" ? o.region.trim() : "",
    authPrincipal: typeof o.authPrincipal === "string" ? o.authPrincipal.trim() : "",
    credentialsEnc: typeof o.credentialsEnc === "string" && o.credentialsEnc.trim() ? o.credentialsEnc.trim() : null,
    envelopeVersion:
      typeof o.envelopeVersion === "number" && Number.isInteger(o.envelopeVersion) && o.envelopeVersion >= 1
        ? o.envelopeVersion
        : 1,
    lastVerifiedAt: typeof o.lastVerifiedAt === "string" ? o.lastVerifiedAt : null,
    lastRotatedAt: typeof o.lastRotatedAt === "string" ? o.lastRotatedAt : null,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString(),
  };
}

function toPublic(stored: CloudKmsStoredConfig | null): CloudKmsPublicConfig {
  if (!stored) {
    return {
      enabled: false,
      provider: "aws_kms",
      keyUri: "",
      region: "",
      authPrincipal: "",
      configured: false,
      envelopeVersion: 1,
      lastVerifiedAt: null,
      lastRotatedAt: null,
    };
  }
  return {
    enabled: stored.enabled,
    provider: stored.provider,
    keyUri: stored.keyUri,
    region: stored.region,
    authPrincipal: stored.authPrincipal,
    configured: true,
    envelopeVersion: stored.envelopeVersion,
    lastVerifiedAt: stored.lastVerifiedAt,
    lastRotatedAt: stored.lastRotatedAt,
  };
}

function validateKeyUri(
  provider: CloudKmsProvider,
  rawUri: string,
): { ok: true; keyUri: string; inferredRegion: string } | { ok: false; error: string } {
  const uri = rawUri.trim();
  if (!uri) return { ok: false, error: "Enter a Cloud KMS Key URI or ARN." };

  if (provider === "aws_kms") {
    const m = uri.match(
      /^arn:aws(?:-[a-z0-9-]+)?:kms:([a-z]{2}(?:-[a-z0-9]+)+-\d+):\d{12}:(?:key|alias)\/[A-Za-z0-9/_-]+$/,
    );
    if (!m) {
      return {
        ok: false,
        error:
          "AWS KMS Key ARN must match arn:aws:kms:<region>:<account-id>:key/<key-id> (or alias/<name>).",
      };
    }
    return { ok: true, keyUri: uri, inferredRegion: m[1] };
  }

  if (provider === "gcp_kms") {
    const m = uri.match(
      /^projects\/[a-z][a-z0-9-]{2,62}\/locations\/([a-z0-9-]+)\/keyRings\/[A-Za-z0-9_-]+\/cryptoKeys\/[A-Za-z0-9_-]+(?:\/cryptoKeyVersions\/\d+)?$/,
    );
    if (!m) {
      return {
        ok: false,
        error:
          "GCP Cloud KMS key path must match projects/<project>/locations/<location>/keyRings/<ring>/cryptoKeys/<key>.",
      };
    }
    return { ok: true, keyUri: uri, inferredRegion: m[1] };
  }

  // azure_key_vault
  try {
    const u = new URL(uri);
    if (u.protocol !== "https:") {
      return { ok: false, error: "Azure Key Vault key URI must start with https://." };
    }
    if (u.username || u.password) {
      return { ok: false, error: "Remove embedded credentials from the Azure Key Vault URI." };
    }
    if (!/^[a-z0-9][a-z0-9-]{1,22}[a-z0-9]\.vault\.azure\.net$/i.test(u.hostname)) {
      return {
        ok: false,
        error: "Azure Key Vault URI host must be <vault-name>.vault.azure.net.",
      };
    }
    if (!/^\/keys\/[A-Za-z0-9-]+(?:\/[A-Za-z0-9-]+)?\/?$/.test(u.pathname)) {
      return {
        ok: false,
        error: "Azure Key Vault URI path must match /keys/<key-name> (with optional /<version>).",
      };
    }
    return { ok: true, keyUri: u.toString().replace(/\/$/, ""), inferredRegion: "" };
  } catch {
    return {
      ok: false,
      error: "Azure Key Vault URI must match https://<vault-name>.vault.azure.net/keys/<key-name>.",
    };
  }
}

export async function getCloudKmsPublicConfig(raw: unknown): Promise<CloudKmsPublicConfig> {
  return toPublic(parseStored(raw));
}

const saveKmsSchema = z.object({
  enabled: z.boolean().default(true),
  provider: z.enum(KMS_PROVIDERS),
  keyUri: z.string().trim().min(1, "Enter a Cloud KMS key URI or ARN").max(500),
  region: z.string().trim().max(80).optional().default(""),
  authPrincipal: z.string().trim().max(300).optional().default(""),
  credentials: z.string().trim().max(16384).optional(),
});

export async function saveCloudKmsAction(input: unknown): Promise<Result<CloudKmsPublicConfig>> {
  return run(async () => {
    const ctx = await requireWorkspaceRole(["OWNER"]);
    await enforceRate("kms", 20, 900);
    const d = saveKmsSchema.parse(input);

    const check = validateKeyUri(d.provider, d.keyUri);
    if (!check.ok) throw new Error(check.error);

    if (d.credentials && d.credentials.startsWith("{")) {
      try {
        JSON.parse(d.credentials);
      } catch {
        throw new Error("Credentials JSON is malformed. Provide valid JSON or a raw credential secret.");
      }
    }

    const existing = parseStored(ctx.workspace.kmsConfig);
    const credentialsEnc =
      d.credentials && d.credentials.length > 0 ? seal(d.credentials) : existing?.credentialsEnc ?? null;
    const keyChanged = !existing || existing.provider !== d.provider || existing.keyUri !== check.keyUri;

    const stored: CloudKmsStoredConfig = {
      enabled: d.enabled,
      provider: d.provider,
      keyUri: check.keyUri,
      region: d.region || check.inferredRegion || "",
      authPrincipal: d.authPrincipal || "",
      credentialsEnc,
      envelopeVersion: existing?.envelopeVersion ?? 1,
      lastVerifiedAt: keyChanged ? null : existing?.lastVerifiedAt ?? null,
      lastRotatedAt: existing?.lastRotatedAt ?? null,
      updatedAt: new Date().toISOString(),
    };

    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({
        where: { id: ctx.workspaceId },
        data: { kmsConfig: stored as unknown as Prisma.InputJsonValue },
      });
      await writeAudit(tx, {
        workspaceId: ctx.workspaceId,
        actorMemberId: ctx.id,
        actorName: ctx.user.name,
        actionType: "CLOUD_KMS_UPDATED",
        targetType: "Workspace",
        targetId: ctx.workspaceId,
        summary: `Cloud KMS envelope ${d.enabled ? "enabled" : "saved (paused)"} for ${d.provider} (envelope v${stored.envelopeVersion})`,
        metadata: {
          provider: stored.provider,
          enabled: stored.enabled,
          region: stored.region || null,
          keyUri: stored.keyUri,
          authPrincipal: stored.authPrincipal || null,
          envelopeVersion: stored.envelopeVersion,
          credentialsUpdated: Boolean(d.credentials && d.credentials.length > 0),
        },
      });
    });

    revalidatePath("/app/settings");
    return toPublic(stored);
  });
}

export async function testCloudKmsAction(): Promise<
  Result<{
    verifiedAt: string;
    provider: CloudKmsProvider;
    keyUri: string;
    hasCredentials: boolean;
    envelopeVersion: number;
  }>
> {
  return run(async () => {
    const ctx = await requireWorkspaceRole(["OWNER"]);
    await enforceRate("kms", 20, 900);

    const existing = parseStored(ctx.workspace.kmsConfig);
    if (!existing) {
      throw new Error("Save a Cloud KMS configuration before verifying it.");
    }

    const check = validateKeyUri(existing.provider, existing.keyUri);
    if (!check.ok) throw new Error(check.error);

    if (existing.credentialsEnc) {
      const plain = open(existing.credentialsEnc);
      if (!plain) {
        throw new Error("Stored Cloud KMS credentials could not be decrypted. Re-enter and save credentials.");
      }
      if (plain.trim().startsWith("{")) {
        try {
          JSON.parse(plain);
        } catch {
          throw new Error("Stored Cloud KMS credentials JSON is invalid.");
        }
      }
    }

    const verifiedAt = new Date().toISOString();
    const updated: CloudKmsStoredConfig = {
      ...existing,
      lastVerifiedAt: verifiedAt,
      updatedAt: verifiedAt,
    };

    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({
        where: { id: ctx.workspaceId },
        data: { kmsConfig: updated as unknown as Prisma.InputJsonValue },
      });
      await writeAudit(tx, {
        workspaceId: ctx.workspaceId,
        actorMemberId: ctx.id,
        actorName: ctx.user.name,
        actionType: "CLOUD_KMS_VERIFIED",
        targetType: "Workspace",
        targetId: ctx.workspaceId,
        summary: `Cloud KMS envelope configuration verified for ${updated.provider} (v${updated.envelopeVersion})`,
        metadata: {
          provider: updated.provider,
          keyUri: updated.keyUri,
          envelopeVersion: updated.envelopeVersion,
          hasCredentials: Boolean(updated.credentialsEnc),
        },
      });
    });

    revalidatePath("/app/settings");
    return {
      verifiedAt,
      provider: updated.provider,
      keyUri: updated.keyUri,
      hasCredentials: Boolean(updated.credentialsEnc),
      envelopeVersion: updated.envelopeVersion,
    };
  });
}

export async function rotateCloudKmsEnvelopeAction(): Promise<
  Result<{ envelopeVersion: number; lastRotatedAt: string }>
> {
  return run(async () => {
    const ctx = await requireWorkspaceRole(["OWNER"]);
    await enforceRate("kms", 20, 900);

    const existing = parseStored(ctx.workspace.kmsConfig);
    if (!existing) {
      throw new Error("Configure Cloud KMS before rotating the envelope version.");
    }

    const check = validateKeyUri(existing.provider, existing.keyUri);
    if (!check.ok) throw new Error(check.error);

    const now = new Date().toISOString();
    const nextVersion = existing.envelopeVersion + 1;
    const updated: CloudKmsStoredConfig = {
      ...existing,
      envelopeVersion: nextVersion,
      lastRotatedAt: now,
      updatedAt: now,
    };

    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({
        where: { id: ctx.workspaceId },
        data: { kmsConfig: updated as unknown as Prisma.InputJsonValue },
      });
      await writeAudit(tx, {
        workspaceId: ctx.workspaceId,
        actorMemberId: ctx.id,
        actorName: ctx.user.name,
        actionType: "CLOUD_KMS_ENVELOPE_ROTATED",
        targetType: "Workspace",
        targetId: ctx.workspaceId,
        summary: `Cloud KMS envelope rotated to version ${nextVersion} (${updated.provider})`,
        metadata: {
          provider: updated.provider,
          keyUri: updated.keyUri,
          previousVersion: existing.envelopeVersion,
          envelopeVersion: nextVersion,
        },
      });
    });

    revalidatePath("/app/settings");
    return { envelopeVersion: nextVersion, lastRotatedAt: now };
  });
}

export async function removeCloudKmsAction(): Promise<Result> {
  return run(async () => {
    const ctx = await requireWorkspaceRole(["OWNER"]);
    await enforceRate("kms", 20, 900);

    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({
        where: { id: ctx.workspaceId },
        data: { kmsConfig: Prisma.DbNull },
      });
      await writeAudit(tx, {
        workspaceId: ctx.workspaceId,
        actorMemberId: ctx.id,
        actorName: ctx.user.name,
        actionType: "CLOUD_KMS_REMOVED",
        targetType: "Workspace",
        targetId: ctx.workspaceId,
        summary: "Cloud KMS envelope configuration and sealed credentials were removed",
      });
    });

    revalidatePath("/app/settings");
    return undefined;
  });
}
