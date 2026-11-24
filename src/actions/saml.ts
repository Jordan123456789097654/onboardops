"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceRole } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { reauth } from "@/lib/reauth";
import { parseDomains } from "@/lib/sso";
import { normalizeCertPem, parseIdpMetadataXml, validateSsoUrl } from "@/lib/saml";
import { enforceRate } from "@/lib/rate-limit";
import { run, type Result } from "./_util";

async function owner() {
  const c = await requireWorkspaceRole(["OWNER"]);
  await enforceRate("saml-admin", 30, 900);
  return c;
}

const log = (
  c: Awaited<ReturnType<typeof owner>>,
  actionType: string,
  summary: string,
  metadata?: Record<string, string | boolean | string[]>,
) =>
  prisma.$transaction((tx) =>
    writeAudit(tx, {
      workspaceId: c.workspaceId,
      actorMemberId: c.id,
      actorName: c.user.name,
      actionType,
      targetType: "Workspace",
      targetId: c.workspaceId,
      summary,
      ...(metadata ? { metadata } : {}),
    }),
  );

const done = () => revalidatePath("/app", "layout");
const authSchema = z.object({ password: z.string().optional(), code: z.string().optional() });

const saveSchema = authSchema.extend({
  entityId: z.string().trim().min(3, "Enter the IdP Entity ID").max(500),
  ssoUrl: z.string().trim().min(8, "Enter the IdP SSO URL").max(1000),
  certPem: z.string().trim().min(40, "Paste the IdP X.509 signing certificate PEM").max(16000),
  prevCertPem: z.string().trim().max(16000).optional(),
  metadataXml: z.string().max(512_000).optional(),
  domains: z.string().max(1000),
  roleAttr: z.string().trim().max(200).default("role"),
  enforce: z.boolean().default(false),
});

const rotateSchema = authSchema.extend({
  certPem: z.string().trim().min(40, "Paste the new IdP X.509 signing certificate PEM").max(16000),
});

/** Parses uploaded or pasted SAML 2.0 IdP Metadata XML (Okta, Ping, OneLogin, ADFS) for the workspace owner. */
export async function parseSamlMetadataAction(
  xml: string,
): Promise<Result<{ entityId: string; ssoUrl: string; certPem: string; extraCertPem?: string }>> {
  return run(async () => {
    await owner();
    const raw = z
      .string()
      .min(20, "Paste or upload the IdP Metadata XML first.")
      .max(512_000, "Metadata XML is too large (max 512 KB).")
      .parse(xml);
    return parseIdpMetadataXml(raw);
  });
}

/** Saves or updates SAML 2.0 IdP configuration. Changing Entity ID, SSO URL, cert, or domains resets testedAt until re-tested. */
export async function saveSamlAction(input: unknown): Promise<Result> {
  return run(async () => {
    const c = await owner();
    const d = saveSchema.parse(input);
    await reauth(c.userId, d.password, d.code);

    const ssoUrl = validateSsoUrl(d.ssoUrl);
    const certPem = normalizeCertPem(d.certPem);
    const prevCertPem = d.prevCertPem?.trim() ? normalizeCertPem(d.prevCertPem) : null;
    const domains = parseDomains(d.domains);
    const roleAttr = d.roleAttr.trim() || "role";

    // Prevent another workspace from claiming the same email domain
    const samlConflict = await prisma.workspaceSaml.findFirst({
      where: { workspaceId: { not: c.workspaceId }, domains: { hasSome: domains } },
      select: { domains: true },
    });
    if (samlConflict) {
      const dup = domains.find((dom) => samlConflict.domains.includes(dom));
      throw new Error(`${dup ?? "That domain"} is already used for SAML SSO by another workspace.`);
    }
    const oidcConflict = await prisma.ssoDomain.findFirst({
      where: { workspaceId: { not: c.workspaceId }, domain: { in: domains } },
      select: { domain: true },
    });
    if (oidcConflict) {
      throw new Error(`${oidcConflict.domain} is already used for single sign-on by another workspace.`);
    }

    const existing = await prisma.workspaceSaml.findUnique({ where: { workspaceId: c.workspaceId } });
    const coreChanged =
      !existing ||
      existing.entityId !== d.entityId ||
      existing.ssoUrl !== ssoUrl ||
      existing.certPem !== certPem ||
      existing.domains.join(",") !== domains.join(",");

    await prisma.$transaction(async (tx) => {
      const data = {
        entityId: d.entityId,
        ssoUrl,
        certPem,
        prevCertPem,
        ...(d.metadataXml !== undefined ? { metadataXml: d.metadataXml.trim() || null } : {}),
        domains,
        roleAttr,
        enforce: d.enforce,
        ...(coreChanged ? { enabled: false, testedAt: null } : {}),
      };
      if (existing) {
        await tx.workspaceSaml.update({ where: { workspaceId: c.workspaceId }, data });
      } else {
        await tx.workspaceSaml.create({ data: { workspaceId: c.workspaceId, ...data } });
      }
      await writeAudit(tx, {
        workspaceId: c.workspaceId,
        actorMemberId: c.id,
        actorName: c.user.name,
        actionType: existing ? "SAML_UPDATED" : "SAML_CONFIGURED",
        targetType: "Workspace",
        targetId: c.workspaceId,
        summary: `SAML 2.0 SSO ${existing ? "updated" : "configured"} (${d.entityId}; domains ${domains.join(", ")}${coreChanged && existing ? "; test again before enabling" : ""})`,
        metadata: { entityId: d.entityId, domains, enforce: d.enforce, roleAttr },
      });
    });

    done();
    return undefined;
  });
}

/** Zero-downtime IdP certificate rotation: shifts current certPem into prevCertPem and installs the new primary certPem without disabling SAML. */
export async function rotateSamlCertAction(input: unknown): Promise<Result> {
  return run(async () => {
    const c = await owner();
    const d = rotateSchema.parse(input);
    await reauth(c.userId, d.password, d.code);

    const existing = await prisma.workspaceSaml.findUnique({ where: { workspaceId: c.workspaceId } });
    if (!existing) throw new Error("Save the SAML configuration first.");

    const nextCert = normalizeCertPem(d.certPem);
    if (nextCert === existing.certPem) {
      throw new Error("That certificate is already installed as the active primary certificate.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.workspaceSaml.update({
        where: { workspaceId: c.workspaceId },
        data: { prevCertPem: existing.certPem, certPem: nextCert },
      });
      await writeAudit(tx, {
        workspaceId: c.workspaceId,
        actorMemberId: c.id,
        actorName: c.user.name,
        actionType: "SAML_CERT_ROTATED",
        targetType: "Workspace",
        targetId: c.workspaceId,
        summary: "SAML 2.0 signing certificate rotated (previous certificate retained as fallback during rollover)",
      });
    });

    done();
    return undefined;
  });
}

/** Removes the retired rollover certificate once the IdP cutover is complete. */
export async function clearPrevSamlCertAction(input: unknown): Promise<Result> {
  return run(async () => {
    const c = await owner();
    const d = authSchema.parse(input);
    await reauth(c.userId, d.password, d.code);

    const existing = await prisma.workspaceSaml.findUnique({ where: { workspaceId: c.workspaceId } });
    if (!existing) throw new Error("SAML SSO is not configured.");

    await prisma.workspaceSaml.update({
      where: { workspaceId: c.workspaceId },
      data: { prevCertPem: null },
    });
    await log(c, "SAML_PREV_CERT_CLEARED", "Removed retired fallback SAML 2.0 signing certificate");
    done();
    return undefined;
  });
}

export async function enableSamlAction(input: unknown): Promise<Result> {
  return run(async () => {
    const c = await owner();
    const d = authSchema.parse(input);
    await reauth(c.userId, d.password, d.code);

    const cfg = await prisma.workspaceSaml.findUnique({ where: { workspaceId: c.workspaceId } });
    if (!cfg) throw new Error("Save the SAML configuration first.");
    if (!cfg.testedAt) throw new Error("Run a successful test SAML sign-in before turning SAML SSO on.");

    await prisma.workspaceSaml.update({ where: { workspaceId: c.workspaceId }, data: { enabled: true } });
    await log(
      c,
      "SAML_ENABLED",
      `SAML 2.0 SSO turned on for ${cfg.domains.join(", ")}${cfg.enforce ? " and required for non-owner members" : ""}`,
    );
    done();
    return undefined;
  });
}

export async function disableSamlAction(input: unknown): Promise<Result> {
  return run(async () => {
    const c = await owner();
    const d = authSchema.parse(input);
    await reauth(c.userId, d.password, d.code);

    const cfg = await prisma.workspaceSaml.findUnique({ where: { workspaceId: c.workspaceId } });
    if (!cfg) throw new Error("SAML SSO is not configured.");

    await prisma.workspaceSaml.update({
      where: { workspaceId: c.workspaceId },
      data: { enabled: false, enforce: false },
    });
    await log(c, "SAML_DISABLED", "SAML 2.0 SSO turned off; members can use passwords again");
    done();
    return undefined;
  });
}

export async function removeSamlAction(input: unknown): Promise<Result> {
  return run(async () => {
    const c = await owner();
    const d = authSchema.parse(input);
    await reauth(c.userId, d.password, d.code);

    const cfg = await prisma.workspaceSaml.findUnique({ where: { workspaceId: c.workspaceId } });
    if (!cfg) throw new Error("SAML SSO is not configured.");

    await prisma.$transaction([
      prisma.workspaceSaml.delete({ where: { workspaceId: c.workspaceId } }),
      prisma.ssoIdentity.deleteMany({ where: { workspaceId: c.workspaceId, issuer: cfg.entityId } }),
    ]);
    await log(c, "SAML_REMOVED", "SAML 2.0 SSO configuration and stored certificates removed");
    done();
    return undefined;
  });
}
