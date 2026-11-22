import dns from "node:dns/promises";
import { prisma } from "./prisma";
import { hit } from "./rate-limit";
import { ZONE, createSubdomainRecord, deleteSubdomainRecord, spaceshipConfigured } from "./spaceship-dns";
import { addProjectDomain, removeDomain, vercelConfigured } from "./vercel-domains";

/** Names that must never be claimed: our own services, common infrastructure and easy impersonation targets. */
const RESERVED = new Set([
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
    if (spaceshipConfigured()) dnsCreated = (await createSubdomainRecord(a.slug)).created;
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
