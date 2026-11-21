"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { requireWorkspaceRole, ADMIN_ROLES } from "@/lib/rbac";
import { connectDomain, refreshDomain, removeDomain, validateDomain, type DomainDetails } from "@/lib/vercel-domains";
import { run } from "./_util";

const statusOf = (d: DomainDetails) => (d.verified && !d.misconfigured ? "VERIFIED" : "PENDING");

export async function connectDomainAction(input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    const raw = z.object({ domain: z.string().min(3) }).parse(input).domain;
    const v = validateDomain(raw);
    if (!v.ok) throw new Error(v.error);
    if (ctx.workspace.customDomain && ctx.workspace.customDomain !== v.domain) throw new Error("Remove your current custom domain first.");
    const taken = await prisma.workspace.findFirst({ where: { customDomain: v.domain, id: { not: ctx.workspaceId } } });
    if (taken) throw new Error("That domain is already connected to another workspace.");
    const details = await connectDomain(v.domain);
    if (details.error) throw new Error(`Vercel could not add the domain: ${details.error}`);
    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({ where: { id: ctx.workspaceId }, data: { customDomain: v.domain, domainStatus: statusOf(details), domainCheckedAt: new Date(), domainDetails: details as object } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "DOMAIN_CONNECTED", targetType: "Workspace", targetId: ctx.workspaceId, summary: `Custom domain ${v.domain} added (${statusOf(details).toLowerCase()})` });
    });
    revalidatePath("/app", "layout");
    return undefined;
  });
}

export async function checkDomainAction() {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    const domain = ctx.workspace.customDomain;
    if (!domain) throw new Error("No custom domain to check.");
    const details = await refreshDomain(domain, ctx.workspace.domainDetails as Partial<DomainDetails> | undefined);
    const status = details.error ? "ERROR" : statusOf(details);
    await prisma.workspace.update({ where: { id: ctx.workspaceId }, data: { domainStatus: status, domainCheckedAt: new Date(), domainDetails: details as object } });
    revalidatePath("/app", "layout");
    return { status, error: details.error };
  });
}

export async function removeDomainAction() {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    const domain = ctx.workspace.customDomain;
    if (!domain) throw new Error("No custom domain to remove.");
    const r = await removeDomain(domain);
    if (!r.ok) throw new Error(`Vercel could not remove the domain: ${r.error ?? "unknown error"}`);
    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({ where: { id: ctx.workspaceId }, data: { customDomain: null, domainStatus: "NONE", domainCheckedAt: null, domainDetails: undefined } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "DOMAIN_REMOVED", targetType: "Workspace", targetId: ctx.workspaceId, summary: `Custom domain ${domain} removed` });
    });
    revalidatePath("/app", "layout");
    return undefined;
  });
}
