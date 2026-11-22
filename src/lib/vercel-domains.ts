import dns from "node:dns/promises";

const API = "https://api.vercel.com";
const token = () => process.env.VERCEL_API_TOKEN;
const project = () => process.env.VERCEL_PROJECT_ID;
const team = () => (process.env.VERCEL_TEAM_ID ? `teamId=${encodeURIComponent(process.env.VERCEL_TEAM_ID)}` : "");

export const vercelConfigured = () => !!token() && !!project();

export type DomainDetails = {
  apex: boolean;
  cname: string;
  a: string;
  verification: { type: string; domain: string; value: string; reason?: string }[];
  verified: boolean;
  misconfigured: boolean;
  manual: boolean;
  error?: string;
};

const url = (path: string, extra = "") => {
  const q = [team(), extra].filter(Boolean).join("&");
  return `${API}${path}${q ? `?${q}` : ""}`;
};
async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(url(path), { method, headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json: json as Record<string, any> };
}

const DEFAULT_CNAME = "cname.vercel-dns.com";
const DEFAULT_A = "76.76.21.21";

export function isApex(domain: string) {
  return domain.split(".").length <= 2; // good enough for example.com; multi-part TLDs (co.uk) are treated as subdomains of the TLD, so use A/CNAME guidance from Vercel's config
}

export function isOnboardOpsSubdomain(domain: string) {
  return domain.endsWith(".onboardops.org") && domain !== "onboardops.org" && domain !== "www.onboardops.org";
}

export function validateDomain(raw: string, opts?: { allowPartnerSubdomain?: boolean }): { ok: true; domain: string } | { ok: false; error: string } {
  const domain = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
  if (!/^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) return { ok: false, error: "Enter a domain like hr.yourcompany.com" };
  if (domain === "onboardops.org" || domain === "www.onboardops.org" || /(^|\.)(vercel\.app|localhost)$/.test(domain)) {
    return { ok: false, error: "Cannot use the root onboardops.org, vercel.app, or localhost address." };
  }
  if (isOnboardOpsSubdomain(domain) && !opts?.allowPartnerSubdomain) {
    return { ok: false, error: "*.onboardops.org subdomains are reserved for partners. Ask the site owner to assign one, or connect a domain you own." };
  }
  return { ok: true, domain };
}

/** Adds the domain to the Vercel project and returns what the customer must add at their DNS provider. */
export async function connectDomain(domain: string): Promise<DomainDetails> {
  const isSub = isOnboardOpsSubdomain(domain);
  const base: DomainDetails = { apex: isApex(domain), cname: DEFAULT_CNAME, a: DEFAULT_A, verification: [], verified: isSub, misconfigured: !isSub, manual: !vercelConfigured() };
  if (!vercelConfigured()) return base;
  const add = await call("POST", `/v10/projects/${project()}/domains`, { name: domain });
  if (!add.ok && add.status !== 409) {
    if (isSub) return { ...base, verified: true, misconfigured: false };
    return { ...base, manual: false, error: add.json?.error?.message ?? `Vercel responded ${add.status}` };
  }
  if (isSub) return { ...base, manual: false, verified: true, misconfigured: false };
  return refreshDomain(domain, base);
}

/** Reads the current state from Vercel (and triggers its verification check). */
export async function refreshDomain(domain: string, prev?: Partial<DomainDetails>): Promise<DomainDetails> {
  const isSub = isOnboardOpsSubdomain(domain);
  const base: DomainDetails = { apex: isApex(domain), cname: DEFAULT_CNAME, a: DEFAULT_A, verification: [], verified: isSub, misconfigured: !isSub, manual: !vercelConfigured(), ...prev };
  if (isSub) return { ...base, verified: true, misconfigured: false, error: undefined };
  if (!vercelConfigured()) return manualCheck(domain, base);
  let info = await call("GET", `/v9/projects/${project()}/domains/${encodeURIComponent(domain)}`);
  if (!info.ok) return { ...base, manual: false, error: info.json?.error?.message ?? `Vercel responded ${info.status}` };
  if (!info.json.verified) {
    const v = await call("POST", `/v9/projects/${project()}/domains/${encodeURIComponent(domain)}/verify`);
    if (v.ok) info = { ...info, json: v.json };
  }
  const cfg = await fetch(url(`/v6/domains/${encodeURIComponent(domain)}/config`), { headers: { Authorization: `Bearer ${token()}` }, signal: AbortSignal.timeout(15000) }).then((r) => r.json()).catch(() => ({} as Record<string, any>));
  const rec = (cfg.recommendedCNAME as { rank: number; value: string }[] | undefined)?.sort((x, y) => x.rank - y.rank)[0]?.value;
  const ipv4 = (cfg.recommendedIPv4 as { rank: number; value: string[] }[] | undefined)?.sort((x, y) => x.rank - y.rank)[0]?.value?.[0];
  return {
    ...base,
    manual: false,
    cname: (rec ?? base.cname).replace(/\.$/, ""),
    a: ipv4 ?? base.a,
    verification: ((info.json.verification as DomainDetails["verification"]) ?? []).map((v) => ({ type: v.type, domain: v.domain, value: v.value, reason: v.reason })),
    verified: !!info.json.verified,
    misconfigured: cfg.misconfigured !== false,
    error: undefined,
  };
}

/** Without a Vercel token, check public DNS ourselves. The domain must still be added to the Vercel project by hand. */
async function manualCheck(domain: string, base: DomainDetails): Promise<DomainDetails> {
  try {
    const [cnames, as] = await Promise.all([dns.resolveCname(domain).catch(() => [] as string[]), dns.resolve4(domain).catch(() => [] as string[])]);
    const ok = cnames.some((c) => /vercel-dns\.com\.?$/.test(c)) || as.includes(DEFAULT_A);
    return { ...base, manual: true, verified: ok, misconfigured: !ok };
  } catch {
    return { ...base, manual: true, misconfigured: true };
  }
}

let recCache: { at: number; value: string } | null = null;
/** The CNAME target Vercel currently recommends for this project (it looks like abc123.vercel-dns-017.com). Cached for an hour. Null if Vercel is not connected or does not answer. */
export async function recommendedCname(domain: string): Promise<string | null> {
  if (process.env.VERCEL_CNAME_TARGET) return process.env.VERCEL_CNAME_TARGET.toLowerCase().replace(/\.$/, "");
  if (!vercelConfigured()) return null;
  if (recCache && Date.now() - recCache.at < 3600_000) return recCache.value;
  try {
    const cfg = await fetch(url(`/v6/domains/${encodeURIComponent(domain)}/config`), { headers: { Authorization: `Bearer ${token()}` }, signal: AbortSignal.timeout(15000) }).then((r) => r.json());
    const rec = (cfg.recommendedCNAME as { rank: number; value: string }[] | undefined)?.sort((x, y) => x.rank - y.rank)[0]?.value;
    if (!rec) return null;
    recCache = { at: Date.now(), value: rec.toLowerCase().replace(/\.$/, "") };
    return recCache.value;
  } catch { return null; }
}

/** Adds one domain to the Vercel project. Already-added (409) counts as success. */
export async function addProjectDomain(domain: string): Promise<{ ok: boolean; error?: string }> {
  if (!vercelConfigured()) return { ok: true };
  const r = await call("POST", `/v10/projects/${project()}/domains`, { name: domain });
  if (r.ok || r.status === 409) return { ok: true };
  return { ok: false, error: (r.json?.error?.message as string | undefined) ?? `Vercel responded ${r.status}` };
}

export async function removeDomain(domain: string) {
  if (!vercelConfigured()) return { ok: true };
  const r = await call("DELETE", `/v9/projects/${project()}/domains/${encodeURIComponent(domain)}`);
  return { ok: r.ok || r.status === 404, error: r.json?.error?.message as string | undefined };
}
