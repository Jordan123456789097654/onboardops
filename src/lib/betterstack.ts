import { prisma } from "./prisma";
import { BETTERSTACK_ROW_ID, getMaintenanceState } from "./maintenance";
import { ALL_AREAS, AREA_LABEL, type MaintArea } from "./maintenance-areas";

/**
 * Keeps the public status page (Better Stack) in step with what really happens:
 *  - maintenance mode shows up as scheduled and in-progress maintenance for the parts it affects;
 *  - a service that stays degraded opens a "degraded" report, and closes it when it recovers.
 * It does nothing unless BETTERSTACK_API_TOKEN is set. Failures never break the site.
 */
const BASE = "https://uptime.betterstack.com/api";
const token = () => process.env.BETTERSTACK_API_TOKEN?.trim();
const pageId = () => process.env.BETTERSTACK_STATUS_PAGE_ID?.trim() || "272831";
export const betterstackConfigured = () => !!token();

/** Public names of the status page resources. They must match the names shown on the page. */
const SERVICE_RESOURCE: Record<string, string> = { database: "Database", storage: "File storage", email: "Email", auth: "Sign-in", api: "Core API", domains: "Domains", frontend: "Website" };
const AREA_RESOURCES: Record<MaintArea, string[]> = { site: ["Website"], app: ["Sign-in", "Core API"], portal: ["Core API"], api: ["Public API"] };
const ALWAYS_MARKED = ["Overall status", "Maintenance status"];

type Resp = { ok: boolean; status: number; json: Record<string, any> };
async function call(method: string, path: string, body?: unknown): Promise<Resp> {
  const res = await fetch(`${BASE}${path}`, { method, headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  const json = res.status === 204 ? {} : await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json: json as Record<string, any> };
}

let resCache: { at: number; map: Map<string, string> } | null = null;
async function resourceIds(): Promise<Map<string, string>> {
  if (resCache && Date.now() - resCache.at < 600_000) return resCache.map;
  const r = await call("GET", `/v3/status-pages/${pageId()}/resources?per_page=100`);
  if (!r.ok) throw new Error(`Better Stack resources ${r.status}`);
  const map = new Map<string, string>();
  for (const x of (r.json.data ?? []) as { id: string; attributes: { public_name?: string } }[]) if (x.attributes?.public_name) map.set(x.attributes.public_name, String(x.id));
  resCache = { at: Date.now(), map };
  return map;
}

type State = {
  maint?: { id: string; sig: string; startMs: number; endMs: number };
  degraded?: Record<string, { id: string; names: string[] }>;
  streak?: Record<string, { n: number; at: number }>;
};
async function readState(): Promise<State> {
  const row = await prisma.jobRun.findUnique({ where: { id: BETTERSTACK_ROW_ID } }).catch(() => null);
  return ((row?.summary ?? {}) as State) || {};
}
async function saveState(s: State) {
  await prisma.jobRun.upsert({ where: { id: BETTERSTACK_ROW_ID }, create: { id: BETTERSTACK_ROW_ID, name: "platform:betterstack", ok: true, summary: s as object, durationMs: 0 }, update: { summary: s as object } });
}

/* ---------------- Maintenance ---------------- */
async function endReport(cur: NonNullable<State["maint"]>) {
  const now = Date.now();
  if (cur.startMs <= now) await call("PATCH", `/v2/status-pages/${pageId()}/status-reports/${cur.id}`, { ends_at: new Date(Math.max(now, cur.startMs + 1000)).toISOString() });
  else await call("DELETE", `/v2/status-pages/${pageId()}/status-reports/${cur.id}`);
}

/** Makes the status page match the current maintenance state. Safe to run as often as you like: it only calls Better Stack when something changed. */
export async function reconcileMaintenance(): Promise<{ changed: boolean; note?: string }> {
  if (!betterstackConfigured()) return { changed: false, note: "not configured" };
  const m = await getMaintenanceState();
  const st = await readState();
  const cur = st.maint;
  const now = Date.now();

  if (!(m.enabled || m.upcoming)) {
    if (!cur) return { changed: false };
    await endReport(cur);
    delete st.maint;
    await saveState(st);
    return { changed: true, note: "ended" };
  }

  const explicitEnd = m.endsAt ? Date.parse(m.endsAt) : NaN;
  const scheduledStart = m.startsAt ? Date.parse(m.startsAt) : NaN;
  const sig = [[...m.areas].sort().join(","), m.startsAt ?? "", m.endsAt ?? ""].join("|");

  if (cur && cur.sig === sig) {
    // A lock with no end time keeps the report open: push the end out while it lasts.
    if (m.enabled && isNaN(explicitEnd) && cur.endMs - now < 20 * 60_000) {
      const endMs = now + 2 * 3600_000;
      const r = await call("PATCH", `/v2/status-pages/${pageId()}/status-reports/${cur.id}`, { ends_at: new Date(endMs).toISOString() });
      if (r.ok) { cur.endMs = endMs; await saveState(st); return { changed: true, note: "extended" }; }
    }
    return { changed: false };
  }

  const ids = await resourceIds();
  const names = new Set<string>(ALWAYS_MARKED);
  if (m.areas.length === ALL_AREAS.length) ids.forEach((_, n) => names.add(n));
  else m.areas.forEach((a) => AREA_RESOURCES[a].forEach((n) => names.add(n)));
  const affected = [...names].filter((n) => ids.has(n)).map((n) => ({ status_page_resource_id: ids.get(n) as string, status: "maintenance" }));
  if (!affected.length) return { changed: false, note: "no matching status page resources" };

  const startMs = !isNaN(scheduledStart) && scheduledStart > now ? scheduledStart : cur?.startMs ?? (isNaN(scheduledStart) ? now : Math.min(scheduledStart, now));
  const endMs = !isNaN(explicitEnd) ? explicitEnd : m.enabled ? now + 2 * 3600_000 : startMs + 3600_000;
  if (endMs <= startMs) return { changed: false, note: "end is before start" };
  const areaText = m.areas.length === ALL_AREAS.length ? "OnboardOps" : m.areas.map((a) => AREA_LABEL[a]).join(", ");
  const r = await call("POST", `/v2/status-pages/${pageId()}/status-reports`, {
    title: `Maintenance: ${areaText}`,
    message: m.message,
    report_type: "maintenance",
    starts_at: new Date(startMs).toISOString(),
    ends_at: new Date(endMs).toISOString(),
    affected_resources: affected,
  });
  if (!r.ok) throw new Error(`Better Stack report ${r.status}: ${JSON.stringify(r.json).slice(0, 200)}`);
  if (cur) await endReport(cur).catch(() => {});
  st.maint = { id: String(r.json.data?.id), sig, startMs, endMs };
  await saveState(st);
  return { changed: true, note: "created" };
}

/* ---------------- Degraded ---------------- */
const SAMPLES = 2;            // consecutive checks before a report opens or closes, so one slow request does not flap the page
const MIN_GAP_MS = 60_000;    // monitors poll from several regions: count at most one sample a minute

/** Call with each service check result. Opens a "degraded" report after repeated degraded checks and resolves it after repeated healthy ones. */
export async function syncDegraded(service: string, h: { status: string; message: string }): Promise<void> {
  if (!betterstackConfigured()) return;
  const name = SERVICE_RESOURCE[service];
  if (!name || (h.status !== "degraded" && h.status !== "up")) return;
  const st = await readState();
  const now = Date.now();
  const streak = (st.streak ??= {});
  const s = streak[service] ?? { n: 0, at: 0 };
  if (now - s.at < MIN_GAP_MS) return;
  const degraded = h.status === "degraded";
  s.n = degraded ? (s.n > 0 ? s.n + 1 : 1) : (s.n < 0 ? s.n - 1 : -1);
  s.at = now;
  streak[service] = s;
  const open = st.degraded?.[service];
  let changed = true;

  if (degraded && !open && s.n >= SAMPLES) {
    const ids = await resourceIds();
    const names = [name, "Overall status"].filter((n) => ids.has(n));
    if (!names.length) { await saveState(st); return; }
    const r = await call("POST", `/v2/status-pages/${pageId()}/status-reports`, {
      title: `${name} is degraded`,
      message: `${name} is slower than usual or partly unavailable. We are looking into it. ${h.message}`.slice(0, 500),
      report_type: "manual",
      affected_resources: names.map((n) => ({ status_page_resource_id: ids.get(n) as string, status: "degraded" })),
    });
    if (r.ok) (st.degraded ??= {})[service] = { id: String(r.json.data?.id), names };
  } else if (!degraded && open && s.n <= -SAMPLES) {
    const ids = await resourceIds();
    const r = await call("POST", `/v2/status-pages/${pageId()}/status-reports/${open.id}/status-updates`, {
      message: `${name} is back to normal.`,
      affected_resources: open.names.filter((n) => ids.has(n)).map((n) => ({ status_page_resource_id: ids.get(n) as string, status: "resolved" })),
    });
    if (r.ok || r.status === 404) delete st.degraded![service];
  } else changed = true; // the streak counter changed
  if (changed) await saveState(st);
}

let lastReconcile = 0;
/** Run the maintenance reconcile at most once a minute. Used by the status endpoints, which monitors poll. */
export async function maybeReconcile() {
  if (!betterstackConfigured() || Date.now() - lastReconcile < 60_000) return;
  lastReconcile = Date.now();
  await reconcileMaintenance().catch((e) => console.error("betterstack reconcile failed", e instanceof Error ? e.message : e));
}
