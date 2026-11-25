import dns from "node:dns/promises";
import { prisma } from "./prisma";
import { hit } from "./rate-limit";
import { ZONE, createSubdomainRecord, deleteSubdomainRecord, isVercelTarget, listRecords, spaceshipConfigured } from "./spaceship-dns";
import { addProjectDomain, listProjectDomains, recommendedCname, removeDomain, vercelConfigured } from "./vercel-domains";
import { isMainHost } from "./host-shared";

/** Names that must never be claimed: our own services, common infrastructure and easy impersonation targets. */
export const RESERVED = new Set([
  "www", "app", "apps", "api", "admin", "staff", "support", "help", "docs", "status", "mail", "email", "smtp", "imap", "pop", "mx", "ns", "ns1", "ns2",
  "dns", "cdn", "static", "assets", "files", "img", "images", "login", "signin", "signup", "register", "auth", "sso", "account", "accounts", "billing", "pay",
  "payments", "security", "privacy", "legal", "terms", "blog", "news", "about", "contact", "careers", "jobs", "demo", "test", "testing", "dev", "staging",
  "preview", "beta", "alpha", "internal", "intranet", "portal", "dashboard", "console", "root", "system", "official", "team", "hr", "ops", "onboardops",
  "onboardop", "resend", "vercel", "neon", "google", "microsoft", "apple", "amazon", "facebook", "meta", "discord", "slack", "roblox", "stripe", "paypal",
  "localhost", "ftp", "git", "github", "autodiscover", "_dmarc", "_domainkey", "send", "bounce", "bounces", "notifications", "noreply", "no-reply",
]);

/** The platform address is the subdomain plus the zone, for example retailnexus.onboardops.org. */
export const subdomainHost = (slug: string) => `${slug}.${ZONE}`;

export function validateSubdomain(raw: string): { ok: true; slug: string } | { ok: false; error: string } {
  const slug = raw.trim().toLowerCase();
  if (slug.length < 3 || slug.length > 40) return { ok: false, error: "Use 3 to 40 characters." };
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) return { ok: false, error: "Use only letters, numbers and hyphens, and do not start or end with a hyphen." };
  if (slug.includes("--")) return { ok: false, error: "Do not use two hyphens in a row." };
  if (RESERVED.has(slug) || slug.startsWith("xn-")) return { ok: false, error: "That name is reserved. Please choose another." };
  return { ok: true, slug };
}

/** True when this server can create subdomains: DNS through the Spaceship API, or a wildcard record you set up once. */
export const subdomainsEnabled = () => spaceshipConfigured() || process.env.SUBDOMAIN_DNS_MODE === "wildcard";

export async function subdomainAvailable(slug: string, workspaceId?: string) {
  const v = validateSubdomain(slug);
  if (!v.ok) return { ok: false as const, error: v.error };
  const host = subdomainHost(v.slug);
  const clash = await prisma.workspace.findFirst({
    where: { OR: [{ subdomain: v.slug }, { customDomain: { equals: host, mode: "insensitive" } }], ...(workspaceId ? { id: { not: workspaceId } } : {}) },
    select: { id: true },
  });
  if (clash) return { ok: false as const, error: "That name is taken." };
  return { ok: true as const, slug: v.slug };
}

/** Claims slug.<zone> for a workspace: reserve in the database, create DNS, add to Vercel. Rolls back on failure. */
export async function claimSubdomain(workspaceId: string, rawSlug: string) {
  if (!subdomainsEnabled()) throw new Error("Workspace addresses are not turned on for this service yet.");
  const a = await subdomainAvailable(rawSlug, workspaceId);
  if (!a.ok) throw new Error(a.error);
  const wait = await hit(`subdomain:${workspaceId}`, 6, 86400);
  if (wait) throw new Error("You have changed your address several times today. Try again tomorrow.");
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { subdomain: true } });
  if (!ws) throw new Error("Workspace not found.");
  const host = subdomainHost(a.slug);
  const previous = ws.subdomain;
  try {
    await prisma.workspace.update({ where: { id: workspaceId }, data: { subdomain: a.slug, subdomainStatus: "PENDING" } });
  } catch {
    throw new Error("That name is taken.");
  }
  let dnsCreated = false;
  try {
    if (spaceshipConfigured()) dnsCreated = (await createSubdomainRecord(a.slug, (await recommendedCname(host)) ?? undefined)).created;
    if (vercelConfigured()) {
      const r = await addProjectDomain(host);
      if (!r.ok) throw new Error(r.error ?? "Could not add the address to the hosting project.");
    }
  } catch (e) {
    if (dnsCreated) await deleteSubdomainRecord(a.slug).catch(() => {});
    await prisma.workspace.update({ where: { id: workspaceId }, data: { subdomain: previous, subdomainStatus: previous ? "ACTIVE" : "NONE" } }).catch(() => {});
    throw e;
  }
  await prisma.workspace.update({ where: { id: workspaceId }, data: { subdomainStatus: "ACTIVE" } });
  if (previous && previous !== a.slug) await releaseRecords(previous).catch(() => {});
  return { slug: a.slug, host };
}

async function releaseRecords(slug: string) {
  if (vercelConfigured()) await removeDomain(subdomainHost(slug));
  if (spaceshipConfigured()) await deleteSubdomainRecord(slug);
}

export async function releaseSubdomain(workspaceId: string) {
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { subdomain: true } });
  if (!ws?.subdomain) throw new Error("This workspace has no OnboardOps address.");
  await releaseRecords(ws.subdomain);
  await prisma.workspace.update({ where: { id: workspaceId }, data: { subdomain: null, subdomainStatus: "NONE" } });
  return ws.subdomain;
}

/**
 * Frees the OnboardOps address and the custom domain of a workspace that has been deleted: removes the DNS record we created
 * (only a CNAME that points at Vercel) and the domain from the hosting project. Best effort; it never throws, so closing a workspace never fails because of DNS.
 * A customer's own DNS is theirs: we only detach the domain from our hosting project.
 */
export async function releaseWorkspaceAddresses(ws: { subdomain: string | null; customDomain: string | null }) {
  const done: string[] = [];
  const keep = (h: string) => !h || isMainHost(h.toLowerCase());
  if (ws.subdomain && !RESERVED.has(ws.subdomain) && !keep(subdomainHost(ws.subdomain))) {
    // Another workspace could have been given the name since; never remove an address that is in use.
    const inUse = await prisma.workspace.findFirst({ where: { subdomain: ws.subdomain }, select: { id: true } }).catch(() => null);
    if (!inUse) await releaseRecords(ws.subdomain).then(() => done.push(subdomainHost(ws.subdomain!))).catch(() => {});
  }
  if (ws.customDomain && !keep(ws.customDomain)) {
    const inUse = await prisma.workspace.findFirst({ where: { customDomain: { equals: ws.customDomain, mode: "insensitive" } }, select: { id: true } }).catch(() => null);
    if (!inUse && vercelConfigured()) await removeDomain(ws.customDomain).then(() => done.push(ws.customDomain!)).catch(() => {});
  }
  return done;
}

export type SweepResult = { configured: boolean; applied: boolean; orphans: string[]; removed: string[]; errors: string[]; skipped?: string };

/**
 * Finds leftover addresses under our own zone that no workspace uses (for example from workspaces closed before cleanup existed) and removes them.
 * Safe by design: only single-label names in our zone, never a reserved or platform name, DNS only if it is a CNAME pointing at Vercel,
 * nothing is removed if the workspace list looks empty, and at most MAX are removed per run. Dry run unless apply is true.
 */
export async function sweepOrphanAddresses(opts: { apply: boolean }): Promise<SweepResult> {
  const MAX = 20;
  const res: SweepResult = { configured: spaceshipConfigured() || vercelConfigured(), applied: opts.apply, orphans: [], removed: [], errors: [] };
  if (!res.configured) return { ...res, skipped: "Neither the DNS provider nor the hosting project is connected." };
  const wss = await prisma.workspace.findMany({ select: { subdomain: true, customDomain: true } });
  if (wss.length === 0) return { ...res, skipped: "No workspaces were found, so nothing was removed (safety check)." };
  const used = new Set(wss.map((w) => w.subdomain).filter((s): s is string => !!s));
  const customs = new Set(wss.map((w) => (w.customDomain ?? "").toLowerCase()).filter(Boolean));
  const labelOf = (h: string) => (h.endsWith(`.${ZONE}`) ? h.slice(0, -(ZONE.length + 1)) : null);
  const isOurs = (label: string | null): label is string => !!label && !label.includes(".") && !RESERVED.has(label) && !isMainHost(`${label}.${ZONE}`) && !used.has(label) && !customs.has(`${label}.${ZONE}`);

  const found = new Map<string, { dns: boolean; vercel: boolean }>();
  if (spaceshipConfigured()) {
    try {
      const { items } = await listRecords();
      for (const r of items) {
        const label = (r.name ?? "").toLowerCase();
        if ((r.type ?? "").toUpperCase() === "CNAME" && isVercelTarget(r.cname ?? r.value) && isOurs(label)) found.set(label, { dns: true, vercel: found.get(label)?.vercel ?? false });
      }
    } catch (e) { res.errors.push(e instanceof Error ? e.message : "Could not read DNS records."); }
  }
  if (vercelConfigured()) {
    try {
      for (const d of await listProjectDomains()) { const label = labelOf(d); if (isOurs(label)) found.set(label, { dns: found.get(label)?.dns ?? false, vercel: true }); }
    } catch (e) { res.errors.push(e instanceof Error ? e.message : "Could not read hosting domains."); }
  }
  res.orphans = [...found.keys()].sort().map((l) => `${l}.${ZONE}`);
  if (!opts.apply) return res;
  for (const label of [...found.keys()].sort().slice(0, MAX)) {
    try {
      // Re-check just before removing: a workspace may have claimed the name a moment ago.
      if (await prisma.workspace.findFirst({ where: { subdomain: label }, select: { id: true } })) continue;
      await releaseRecords(label);
      res.removed.push(`${label}.${ZONE}`);
    } catch (e) { res.errors.push(`${label}.${ZONE}: ${e instanceof Error ? e.message : "failed"}`); }
  }
  if (found.size > MAX) res.skipped = `Removed the first ${MAX}; run it again for the rest.`;
  return res;
}

/** Does the name resolve yet? New DNS records can take a few minutes to spread. */
export async function subdomainLive(slug: string) {
  try {
    const c = await dns.resolveCname(subdomainHost(slug));
    return c.length > 0;
  } catch {
    try { return (await dns.resolve4(subdomainHost(slug))).length > 0; } catch { return false; }
  }
}

/** Best-effort claim at workspace creation. Never blocks sign-up. */
export async function autoClaimSubdomain(workspaceId: string, preferred: string) {
  try {
    if (!subdomainsEnabled()) return null;
    const base = preferred.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-").slice(0, 40);
    for (const candidate of [base, `${base.slice(0, 34)}-${Math.floor(Math.random() * 9000 + 1000)}`]) {
      if (!(await subdomainAvailable(candidate, workspaceId)).ok) continue;
      return await claimSubdomain(workspaceId, candidate);
    }
  } catch {
    // The owner can claim a name later in Settings.
  }
  return null;
}
