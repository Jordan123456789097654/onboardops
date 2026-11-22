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

const sameName = (a: string | undefined, b: string) => (a ?? "").toLowerCase() === b.toLowerCase();
const sameTarget = (a: string | undefined, b: string) => (a ?? "").toLowerCase().replace(/\.$/, "") === b.toLowerCase().replace(/\.$/, "");

/** Creates host.<zone> CNAME -> Vercel. Refuses if any other record already uses that name. */
export async function createSubdomainRecord(host: string) {
  const { items } = await listRecords();
  const existing = items.filter((r) => sameName(r.name, host));
  const ours = existing.find((r) => (r.type ?? "").toUpperCase() === "CNAME" && sameTarget(r.cname ?? r.value, VERCEL_CNAME));
  if (ours) return { created: false };
  if (existing.length) throw new Error("That name already has a DNS record that we did not create.");
  const r = await call("PUT", `/dns/records/${ZONE}`, { items: [{ type: "CNAME", name: host, cname: VERCEL_CNAME, ttl: 300 }] });
  if (!r.ok) throw fail(r, "Creating the DNS record");
  return { created: true };
}

/** Deletes host.<zone> only if it is a CNAME pointing at Vercel. Never touches any other record. */
export async function deleteSubdomainRecord(host: string) {
  const { items } = await listRecords();
  const ours = items.find((r) => sameName(r.name, host) && (r.type ?? "").toUpperCase() === "CNAME" && sameTarget(r.cname ?? r.value, VERCEL_CNAME));
  if (!ours) return { deleted: false };
  const r = await call("DELETE", `/dns/records/${ZONE}`, [{ type: "CNAME", name: host, cname: VERCEL_CNAME }]);
  if (!r.ok && r.status !== 404) throw fail(r, "Removing the DNS record");
  return { deleted: true };
}

/** Read-only connection test for the staff console. */
export async function testDns() {
  const r = await listRecords(1);
  return { total: r.total };
}
