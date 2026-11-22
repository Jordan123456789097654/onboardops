/**
 * Spaceship DNS API (https://docs.spaceship.dev). Used only to create and remove the CNAME that points a workspace
 * subdomain at Vercel. The API key should have only the dnsrecords:read and dnsrecords:write permissions.
 */
const API = "https://spaceship.dev/api/v1";
const key = () => process.env.SPACESHIP_API_KEY?.trim();
const secret = () => process.env.SPACESHIP_API_SECRET?.trim();

export const ZONE = (process.env.SUBDOMAIN_ZONE || "onboardops.org").toLowerCase();
export const VERCEL_CNAME = (process.env.VERCEL_CNAME_TARGET || "cname.vercel-dns.com").toLowerCase().replace(/\.$/, "");

export const spaceshipConfigured = () => !!key() && !!secret();

type Rec = { type?: string; name?: string; cname?: string; address?: string; value?: string };

async function call(method: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; json: Record<string, any> }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "X-API-Key": key() ?? "", "X-API-Secret": secret() ?? "", "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const json = res.status === 204 ? {} : await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json: json as Record<string, any> };
}

const fail = (r: { status: number; json: Record<string, any> }, what: string) => {
  const detail = typeof r.json?.detail === "string" ? r.json.detail : "";
  if (r.status === 401 || r.status === 403) return new Error("The DNS provider rejected our API key. Check its permissions in Spaceship.");
  if (r.status === 429) return new Error("The DNS provider is busy. Try again in a minute.");
  return new Error(`${what} failed (${r.status})${detail ? `: ${detail}` : ""}`);
};

/** Lists records (first page of up to 500). Read-only. */
export async function listRecords(take = 500): Promise<{ items: Rec[]; total: number }> {
  const r = await call("GET", `/dns/records/${ZONE}?take=${take}&skip=0`);
  if (!r.ok) throw fail(r, "Reading DNS records");
  return { items: (r.json.items ?? []) as Rec[], total: Number(r.json.total ?? 0) };
}

/** Any Vercel DNS target: the old shared one (cname.vercel-dns.com) or a project one (abc123.vercel-dns-017.com). */
export const isVercelTarget = (t: string | undefined) => /(^|\.)vercel-dns(-\d+)?\.com\.?$/i.test((t ?? "").trim());
const sameName = (a: string | undefined, b: string) => (a ?? "").toLowerCase() === b.toLowerCase();
const sameTarget = (a: string | undefined, b: string) => (a ?? "").toLowerCase().replace(/\.$/, "") === b.toLowerCase().replace(/\.$/, "");

/** Creates host.<zone> CNAME -> Vercel. Refuses if any other record already uses that name. */
export async function createSubdomainRecord(host: string, target: string = VERCEL_CNAME) {
  const { items } = await listRecords();
  const existing = items.filter((r) => sameName(r.name, host));
  const ours = existing.find((r) => (r.type ?? "").toUpperCase() === "CNAME" && isVercelTarget(r.cname ?? r.value));
  if (ours) return { created: false };
  if (existing.length) throw new Error("That name already has a DNS record that we did not create.");
  const r = await call("PUT", `/dns/records/${ZONE}`, { items: [{ type: "CNAME", name: host, cname: target, ttl: 300 }] });
  if (!r.ok) throw fail(r, "Creating the DNS record");
  return { created: true };
}

/** Deletes host.<zone> only if it is a CNAME pointing at Vercel. Never touches any other record. */
export async function deleteSubdomainRecord(host: string) {
  const { items } = await listRecords();
  const ours = items.find((r) => sameName(r.name, host) && (r.type ?? "").toUpperCase() === "CNAME" && isVercelTarget(r.cname ?? r.value));
  if (!ours) return { deleted: false };
  const r = await call("DELETE", `/dns/records/${ZONE}`, [{ type: "CNAME", name: host, cname: (ours.cname ?? ours.value ?? VERCEL_CNAME).replace(/\.$/, "") }]);
  if (!r.ok && r.status !== 404) throw fail(r, "Removing the DNS record");
  return { deleted: true };
}

/** Read-only connection test for the staff console. */
export async function testDns() {
  const r = await listRecords(1);
  return { total: r.total };
}

/**
 * Points existing Vercel CNAMEs for the given hosts at a new target (used when Vercel recommends a new one).
 * Only records that already point at Vercel are touched. Each is removed and re-created at the new target.
 */
export async function retargetRecords(hosts: string[], target: string) {
  const { items } = await listRecords();
  let updated = 0, already = 0, skipped = 0;
  for (const host of hosts) {
    const rec = items.find((r) => sameName(r.name, host) && (r.type ?? "").toUpperCase() === "CNAME");
    const current = rec?.cname ?? rec?.value;
    if (!rec || !isVercelTarget(current)) { skipped++; continue; }
    if (sameTarget(current, target)) { already++; continue; }
    const del = await call("DELETE", `/dns/records/${ZONE}`, [{ type: "CNAME", name: host, cname: (current ?? "").replace(/\.$/, "") }]);
    if (!del.ok && del.status !== 404) throw fail(del, `Removing the old record for ${host}`);
    const add = await call("PUT", `/dns/records/${ZONE}`, { items: [{ type: "CNAME", name: host, cname: target, ttl: 300 }] });
    if (!add.ok) {
      // Put the old record back so the address keeps working.
      await call("PUT", `/dns/records/${ZONE}`, { items: [{ type: "CNAME", name: host, cname: (current ?? "").replace(/\.$/, ""), ttl: 300 }] }).catch(() => {});
      throw fail(add, `Updating ${host}`);
    }
    updated++;
  }
  return { updated, already, skipped };
}
