"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceRole } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { seal } from "@/lib/secret-box";
import { reauth } from "@/lib/reauth";
import { isTenantId, parseDomains } from "@/lib/sso";
import { enforceRate } from "@/lib/rate-limit";
import { run, type Result } from "./_util";

async function owner() { const c = await requireWorkspaceRole(["OWNER"]); await enforceRate("sso-admin", 30, 900); return c; }
const log = (c: Awaited<ReturnType<typeof owner>>, actionType: string, summary: string, metadata?: Record<string, string | boolean | string[]>) =>
  prisma.$transaction((tx) => writeAudit(tx, { workspaceId: c.workspaceId, actorMemberId: c.id, actorName: c.user.name, actionType, targetType: "Workspace", targetId: c.workspaceId, summary, ...(metadata ? { metadata } : {}) }));
const done = () => revalidatePath("/app", "layout");
const auth = z.object({ password: z.string().optional(), code: z.string().optional() });

const saveSchema = auth.extend({
  provider: z.enum(["google", "entra"]),
  clientId: z.string().trim().min(5, "Enter the client ID").max(200),
  /// Write-only. Leave empty on later saves to keep the stored secret.
  clientSecret: z.string().trim().max(500).optional(),
  tenantId: z.string().trim().max(60).optional(),
  domains: z.string().max(1000),
  enforce: z.boolean().default(false),
});

/** Saves the configuration. The client secret is stored sealed and is never sent back to the browser. Any change turns SSO off until it is tested again. */
export async function saveSsoAction(input: unknown): Promise<Result> {
  return run(async () => {
    const c = await owner(); const d = saveSchema.parse(input);
    await reauth(c.userId, d.password, d.code);
    if (d.provider === "entra" && !isTenantId(d.tenantId ?? "")) throw new Error("Enter the Microsoft Entra tenant (directory) ID, a value like 11111111-2222-3333-4444-555555555555.");
    const domains = parseDomains(d.domains);
    const existing = await prisma.workspaceSso.findUnique({ where: { workspaceId: c.workspaceId } });
    if (!existing && !d.clientSecret) throw new Error("Enter the client secret.");
    for (const dom of domains) {
      const taken = await prisma.ssoDomain.findUnique({ where: { domain: dom } });
      if (taken && taken.workspaceId !== c.workspaceId) throw new Error(`${dom} is already used for single sign-on by another workspace.`);
    }
    const changed = !existing || existing.provider !== d.provider || existing.clientId !== d.clientId || (existing.tenantId ?? "") !== (d.tenantId ?? "") || !!d.clientSecret || existing.domains.join() !== domains.join();
    await prisma.$transaction(async (tx) => {
      const data = { provider: d.provider, clientId: d.clientId, tenantId: d.provider === "entra" ? d.tenantId!.toLowerCase() : null, domains, enforce: d.enforce, ...(d.clientSecret ? { clientSecretEnc: seal(d.clientSecret) } : {}), ...(changed ? { enabled: false, testedAt: null } : {}) };
      if (existing) await tx.workspaceSso.update({ where: { workspaceId: c.workspaceId }, data });
      else await tx.workspaceSso.create({ data: { workspaceId: c.workspaceId, clientSecretEnc: seal(d.clientSecret!), ...data } as never });
      await tx.ssoDomain.deleteMany({ where: { workspaceId: c.workspaceId, domain: { notIn: domains } } });
      for (const dom of domains) await tx.ssoDomain.upsert({ where: { domain: dom }, create: { domain: dom, workspaceId: c.workspaceId }, update: {} });
      await writeAudit(tx, { workspaceId: c.workspaceId, actorMemberId: c.id, actorName: c.user.name, actionType: existing ? "SSO_UPDATED" : "SSO_CONFIGURED", targetType: "Workspace", targetId: c.workspaceId, summary: `Single sign-on ${existing ? "updated" : "configured"} (${d.provider === "google" ? "Google Workspace" : "Microsoft Entra ID"}; domains ${domains.join(", ")}${d.clientSecret ? "; client secret replaced" : ""}${changed && existing ? "; test again before enabling" : ""})`, metadata: { provider: d.provider, domains, enforce: d.enforce, secretReplaced: !!d.clientSecret } });
    });
    done();
    return undefined;
  });
}

export async function enableSsoAction(input: unknown): Promise<Result> {
  return run(async () => {
    const c = await owner(); const d = auth.parse(input);
    await reauth(c.userId, d.password, d.code);
    const cfg = await prisma.workspaceSso.findUnique({ where: { workspaceId: c.workspaceId } });
    if (!cfg) throw new Error("Save the configuration first.");
    if (!cfg.testedAt) throw new Error("Run a successful test sign-in before turning single sign-on on.");
    await prisma.workspaceSso.update({ where: { workspaceId: c.workspaceId }, data: { enabled: true } });
    await log(c, "SSO_ENABLED", `Single sign-on turned on for ${cfg.domains.join(", ")}${cfg.enforce ? " and required for non-owner members" : ""}`);
    done();
    return undefined;
  });
}

export async function disableSsoAction(input: unknown): Promise<Result> {
  return run(async () => {
    const c = await owner(); const d = auth.parse(input);
    await reauth(c.userId, d.password, d.code);
    const cfg = await prisma.workspaceSso.findUnique({ where: { workspaceId: c.workspaceId } });
    if (!cfg) throw new Error("Single sign-on is not set up.");
    await prisma.workspaceSso.update({ where: { workspaceId: c.workspaceId }, data: { enabled: false, enforce: false } });
    await log(c, "SSO_DISABLED", "Single sign-on turned off; everyone can use their password again");
    done();
    return undefined;
  });
}

export async function removeSsoAction(input: unknown): Promise<Result> {
  return run(async () => {
    const c = await owner(); const d = auth.parse(input);
    await reauth(c.userId, d.password, d.code);
    const cfg = await prisma.workspaceSso.findUnique({ where: { workspaceId: c.workspaceId } });
    if (!cfg) throw new Error("Single sign-on is not set up.");
    await prisma.$transaction([prisma.workspaceSso.delete({ where: { workspaceId: c.workspaceId } }), prisma.ssoDomain.deleteMany({ where: { workspaceId: c.workspaceId } }), prisma.ssoIdentity.deleteMany({ where: { workspaceId: c.workspaceId } })]);
    await log(c, "SSO_REMOVED", "Single sign-on configuration removed, including its stored client secret");
    done();
    return undefined;
  });
}
