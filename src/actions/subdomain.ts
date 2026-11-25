"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { requireWorkspaceRole } from "@/lib/rbac";
import { enforceRate } from "@/lib/rate-limit";
import { claimSubdomain, releaseSubdomain, sweepOrphanAddresses, subdomainAvailable, subdomainHost, subdomainLive } from "@/lib/subdomain";
import { getStaff, SUPPORT_STAFF, staffAudit } from "@/lib/platform";
import { ZONE, retargetRecords, spaceshipConfigured, testDns } from "@/lib/spaceship-dns";
import { recommendedCname } from "@/lib/vercel-domains";
import { run } from "./_util";

const OWNER_ONLY = ["OWNER"] as const;
const done = () => { revalidatePath("/app/settings"); revalidatePath("/app", "layout"); };

/** Live availability check while typing. */
export async function checkSubdomainNameAction(slug: string) {
  return run(async () => {
    const ctx = await requireWorkspaceRole([...OWNER_ONLY]);
    await enforceRate("subdomain-check", 60, 600);
    const r = await subdomainAvailable(String(slug ?? ""), ctx.workspaceId);
    return r.ok ? { available: true as const, error: "" } : { available: false as const, error: r.error };
  });
}

export async function claimSubdomainAction(input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole([...OWNER_ONLY]);
    await enforceRate("subdomain-claim", 20, 3600);
    const d = z.object({ slug: z.string().min(1).max(60) }).parse(input);
    const r = await claimSubdomain(ctx.workspaceId, d.slug);
    await prisma.$transaction(async (tx) => {
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "SUBDOMAIN_CLAIMED", targetType: "Workspace", targetId: ctx.workspaceId, summary: `Workspace address set to ${r.host}` });
    });
    done();
    return { host: r.host };
  });
}

export async function releaseSubdomainAction() {
  return run(async () => {
    const ctx = await requireWorkspaceRole([...OWNER_ONLY]);
    const slug = await releaseSubdomain(ctx.workspaceId);
    await prisma.$transaction(async (tx) => {
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "SUBDOMAIN_RELEASED", targetType: "Workspace", targetId: ctx.workspaceId, summary: `Workspace address ${subdomainHost(slug)} released` });
    });
    done();
    return undefined;
  });
}

/** Has the new address spread through DNS yet? */
export async function subdomainStatusAction() {
  return run(async () => {
    const ctx = await requireWorkspaceRole([...OWNER_ONLY]);
    const ws = await prisma.workspace.findUnique({ where: { id: ctx.workspaceId }, select: { subdomain: true } });
    if (!ws?.subdomain) return { live: false };
    return { live: await subdomainLive(ws.subdomain) };
  });
}

/** Staff: read-only check that the DNS provider key works. */
export async function testDnsConnectionAction() {
  return run(async () => {
    const staff = await getStaff();
    if (!staff || !SUPPORT_STAFF.includes(staff.role)) throw new Error("You do not have access to the staff console.");
    if (!spaceshipConfigured()) throw new Error("SPACESHIP_API_KEY and SPACESHIP_API_SECRET are not set.");
    const r = await testDns();
    await prisma.$transaction((tx) => staffAudit(tx, staff, { action: "DNS_TESTED", targetType: "System", targetId: "dns", summary: `DNS connection tested (${r.total} records)` }));
    return { total: r.total };
  });
}

/** Staff (owner role): point every existing workspace address (and any hosts in SUBDOMAIN_EXTRA_HOSTS, default "management") at the CNAME target Vercel now recommends. Only records that already point at Vercel are changed. */
export async function updateDnsTargetsAction() {
  return run(async () => {
    const staff = await getStaff();
    if (!staff || staff.role !== "OWNER") throw new Error("Only the site owner can update DNS targets.");
    if (!spaceshipConfigured()) throw new Error("SPACESHIP_API_KEY and SPACESHIP_API_SECRET are not set.");
    const target = await recommendedCname(`management.${ZONE}`);
    if (!target) throw new Error("Could not read the recommended target from Vercel. Check VERCEL_API_TOKEN and VERCEL_PROJECT_ID.");
    const rows = await prisma.workspace.findMany({ where: { subdomain: { not: null } }, select: { subdomain: true } });
    const extra = (process.env.SUBDOMAIN_EXTRA_HOSTS ?? "management").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
    const hosts = Array.from(new Set([...rows.map((r) => r.subdomain as string), ...extra]));
    const r = await retargetRecords(hosts, target);
    await prisma.$transaction((tx) => staffAudit(tx, staff, { action: "DNS_RETARGETED", targetType: "System", targetId: "dns", summary: `DNS targets updated to ${target}: ${r.updated} changed, ${r.already} already correct, ${r.skipped} skipped` }));
    return { ...r, target };
  });
}

/** Staff (owner role): take back a workspace address, for example one that impersonates a brand. */
export async function adminReleaseSubdomainAction(workspaceId: string) {
  return run(async () => {
    const staff = await getStaff();
    if (!staff || staff.role !== "OWNER") throw new Error("Only the site owner can release an address.");
    const slug = await releaseSubdomain(workspaceId);
    await prisma.$transaction(async (tx) => {
      await staffAudit(tx, staff, { action: "SUBDOMAIN_RELEASED", targetType: "Workspace", targetId: workspaceId, workspaceId, summary: `Released address ${subdomainHost(slug)}` });
      await writeAudit(tx, { workspaceId, actorName: "OnboardOps", actionType: "SUBDOMAIN_RELEASED", targetType: "Workspace", targetId: workspaceId, summary: `Address ${subdomainHost(slug)} was released by OnboardOps staff` });
    });
    revalidatePath(`/admin/workspaces/${workspaceId}`);
    return undefined;
  });
}

/** Staff (owner role): find addresses under our zone that no workspace uses, and optionally remove their DNS record and hosting domain. */
export async function sweepOrphanAddressesAction(input: unknown) {
  return run(async () => {
    const staff = await getStaff();
    if (!staff || staff.role !== "OWNER") throw new Error("Only the site owner can clean up addresses.");
    const d = z.object({ apply: z.boolean() }).parse(input);
    const r = await sweepOrphanAddresses({ apply: d.apply });
    await prisma.$transaction((tx) => staffAudit(tx, staff, { action: d.apply ? "ADDRESSES_SWEPT" : "ADDRESSES_SCANNED", targetType: "System", targetId: "dns", summary: d.apply ? `Removed ${r.removed.length} unused address(es): ${r.removed.join(", ") || "none"}` : `Scanned for unused addresses: ${r.orphans.length} found` }));
    return r;
  });
}
