import { prisma } from "./prisma";
import { BETTERSTACK_ROW_ID, getMaintenanceState } from "./maintenance";
import { ALL_AREAS, AREA_LABEL, type MaintArea } from "./maintenance-areas";
import { notifyStatusSubscribers } from "./status-subscribers";

/**
 * Keeps the public status page (Kener v4 at status.onboardops.org) in step with what really happens:
 *  - maintenance mode shows up as scheduled/in-progress maintenance for the parts it affects;
 *  - a service that stays degraded opens an incident, and resolves it when it recovers.
 * It does nothing unless KENER_API_KEY is set. Failures never break the site.
 */
export const STATUS_PAGE_URL = (process.env.KENER_URL?.trim() || "https://status.onboardops.org").replace(/\/+$/, "");
const BASE = () => `${STATUS_PAGE_URL}/api/v4`;
const token = () => process.env.KENER_API_KEY?.trim();
export const kenerConfigured = () => !!token();

/** Service key -> candidate monitor tags/names (case-insensitive) on Kener. */
const SERVICE_TARGETS: Record<string, string[]> = {
  database: ["database", "db", "postgres"],
  storage: ["storage", "file-storage", "file storage"],
  email: ["email", "mail"],
  auth: ["auth", "sign-in", "sign in", "authentication"],
  api: ["api", "core-api", "core api"],
  domains: ["domains", "domain"],
  frontend: ["frontend", "website", "web", "site"],
  ai: ["ai", "assistant"],
  oauth: ["oauth", "social-sign-in", "social sign-in"],
  discord: ["discord", "discord-bot", "discord bot"],
  mailauth: ["mailauth", "email-authentication", "email authentication"],
};

const AREA_TARGETS: Record<MaintArea, string[]> = {
  site: ["frontend", "website", "web", "site"],
  app: ["auth", "sign-in", "sign in", "api", "core-api", "core api"],
  portal: ["api", "core-api", "core api"],
  api: ["public-api", "public api", "api", "core-api", "core api"],
};

type Resp = { ok: boolean; status: number; json: Record<string, any> };
export async function kenerCall(method: string, path: string, body?: unknown, timeoutMs = 8000): Promise<Resp> {
  const res = await fetch(`${BASE()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      "User-Agent": "OnboardOps/1.0",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const json = res.status === 204 ? {} : await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json: json as Record<string, any> };
}

type KenerMonitorRow = {
  id: number;
  tag: string;
  name: string;
  status?: string | null;
  default_status?: string | null;
  monitor_type?: string | null;
  type_data?: Record<string, unknown> | null;
  is_hidden?: string | null;
  updated_at?: string | null;
};

type KenerIncidentRow = {
  id: number;
  title: string;
  start_date_time: number;
  end_date_time: number | null;
  state: string;
  incident_source?: string;
  monitors?: { monitor_tag: string; impact?: string }[];
  created_at?: string;
  updated_at?: string;
};

type KenerMaintenanceRow = {
  id: number;
  title: string;
  description?: string | null;
  start_date_time: number;
  rrule?: string;
  duration_seconds: number;
  status: string;
  monitors?: { monitor_tag: string; impact?: string }[];
  created_at?: string;
  updated_at?: string;
};

let monCache: { at: number; list: KenerMonitorRow[] } | null = null;
async function listMonitors(force = false): Promise<KenerMonitorRow[]> {
  if (!force && monCache && Date.now() - monCache.at < 300_000) return monCache.list;
  const r = await kenerCall("GET", "/monitors");
  if (!r.ok) throw new Error(r.status === 401 ? "Kener rejected the API key." : `Kener monitors responded ${r.status}`);
  const list = (r.json.monitors ?? []) as KenerMonitorRow[];
  monCache = { at: Date.now(), list };
  return list;
}

function matchMonitorTags(monitors: KenerMonitorRow[], candidates: string[]): string[] {
  const wanted = new Set(candidates.map((c) => c.toLowerCase()));
  const matched = new Set<string>();
  for (const m of monitors) {
    if (m.status === "INACTIVE") continue;
    const tagL = m.tag.toLowerCase();
    const nameL = m.name.toLowerCase();
    if (wanted.has(tagL) || wanted.has(nameL)) matched.add(m.tag);
  }
  return [...matched];
}

type State = {
  maint?: { id: string; sig: string; startMs: number; endMs: number };
  degraded?: Record<string, { id: string; tags: string[] }>;
  streak?: Record<string, { n: number; at: number }>;
};

async function readState(): Promise<State> {
  const row = await prisma.jobRun.findUnique({ where: { id: BETTERSTACK_ROW_ID } }).catch(() => null);
  return ((row?.summary ?? {}) as State) || {};
}

async function saveState(s: State) {
  await prisma.jobRun.upsert({
    where: { id: BETTERSTACK_ROW_ID },
    create: { id: BETTERSTACK_ROW_ID, name: "platform:statuspage", ok: true, summary: s as object, durationMs: 0 },
    update: { summary: s as object },
  });
}

/* ---------------- Maintenance ---------------- */
async function endMaint(cur: NonNullable<State["maint"]>) {
  const numId = cur.id.replace(/^m-/, "");
  const nowSec = Math.floor(Date.now() / 1000);
  const startSec = Math.floor(cur.startMs / 1000);
  if (startSec <= nowSec) {
    await kenerCall("PATCH", `/maintenances/${numId}`, {
      status: "INACTIVE",
      duration_seconds: Math.max(60, nowSec - startSec),
    });
  } else {
    await kenerCall("DELETE", `/maintenances/${numId}`);
  }
}

/** Makes the status page match the current maintenance state. Safe to run as often as you like: it only calls Kener when something changed. */
export async function reconcileMaintenance(): Promise<{ changed: boolean; note?: string }> {
  if (!kenerConfigured()) return { changed: false, note: "not configured" };
  const m = await getMaintenanceState();
  const st = await readState();
  const cur = st.maint;
  const now = Date.now();

  if (!(m.enabled || m.upcoming)) {
    if (!cur) return { changed: false };
    await endMaint(cur);
    delete st.maint;
    await saveState(st);
    return { changed: true, note: "ended" };
  }

  const explicitEnd = m.endsAt ? Date.parse(m.endsAt) : NaN;
  const scheduledStart = m.startsAt ? Date.parse(m.startsAt) : NaN;
  const sig = [[...m.areas].sort().join(","), m.startsAt ?? "", m.endsAt ?? ""].join("|");

  if (cur && cur.sig === sig) {
    if (m.enabled && isNaN(explicitEnd) && cur.endMs - now < 20 * 60_000) {
      const endMs = now + 2 * 3600_000;
      const numId = cur.id.replace(/^m-/, "");
      const durationSec = Math.max(60, Math.floor((endMs - cur.startMs) / 1000));
      const r = await kenerCall("PATCH", `/maintenances/${numId}`, { duration_seconds: durationSec });
      if (r.ok) {
        cur.endMs = endMs;
        await saveState(st);
        return { changed: true, note: "extended" };
      }
    }
    return { changed: false };
  }

  const monitors = await listMonitors();
  const tags = new Set<string>();
  if (m.areas.length === ALL_AREAS.length) {
    monitors.filter((x) => x.status !== "INACTIVE").forEach((x) => tags.add(x.tag));
  } else {
    for (const a of m.areas) {
      for (const tag of matchMonitorTags(monitors, AREA_TARGETS[a])) tags.add(tag);
    }
  }
  const affected = [...tags].map((monitor_tag) => ({ monitor_tag, impact: "MAINTENANCE" as const }));
  if (!affected.length) return { changed: false, note: "no matching status page monitors" };

  const startMs = !isNaN(scheduledStart) && scheduledStart > now ? scheduledStart : cur?.startMs ?? (isNaN(scheduledStart) ? now : Math.min(scheduledStart, now));
  const endMs = !isNaN(explicitEnd) ? explicitEnd : m.enabled ? now + 2 * 3600_000 : startMs + 3600_000;
  if (endMs <= startMs) return { changed: false, note: "end is before start" };
  const areaText = m.areas.length === ALL_AREAS.length ? "OnboardOps" : m.areas.map((a) => AREA_LABEL[a]).join(", ");

  const r = await kenerCall("POST", "/maintenances", {
    title: `Maintenance: ${areaText}`,
    description: m.message,
    start_date_time: Math.floor(startMs / 1000),
    rrule: "FREQ=DAILY;COUNT=1",
    duration_seconds: Math.max(60, Math.floor((endMs - startMs) / 1000)),
    monitors: affected,
  });
  if (!r.ok) throw new Error(`Kener maintenance ${r.status}: ${JSON.stringify(r.json).slice(0, 200)}`);
  if (cur) await endMaint(cur).catch(() => {});
  st.maint = { id: `m-${String(r.json.maintenance?.id)}`, sig, startMs, endMs };
  await saveState(st);
  return { changed: true, note: "created" };
}

/* ---------------- Degraded ---------------- */
const SAMPLES = 2;
const MIN_GAP_MS = 60_000;

/** Call with each service check result. Opens a degraded incident after repeated degraded checks and resolves it after repeated healthy ones. */
export async function syncDegraded(service: string, h: { status: string; message: string }): Promise<void> {
  if (!kenerConfigured()) return;
  const targets = SERVICE_TARGETS[service];
  if (!targets || (h.status !== "degraded" && h.status !== "up")) return;
  const st = await readState();
  const now = Date.now();
  const streak = (st.streak ??= {});
  const s = streak[service] ?? { n: 0, at: 0 };
  if (now - s.at < MIN_GAP_MS) return;
  const degraded = h.status === "degraded";
  s.n = degraded ? (s.n > 0 ? s.n + 1 : 1) : s.n < 0 ? s.n - 1 : -1;
  s.at = now;
  streak[service] = s;
  const open = st.degraded?.[service];

  if (degraded && !open && s.n >= SAMPLES) {
    const monitors = await listMonitors();
    const tags = matchMonitorTags(monitors, targets);
    if (!tags.length) {
      await saveState(st);
      return;
    }
    const label = monitors.find((m) => m.tag === tags[0])?.name ?? service;
    const nowSec = Math.floor(now / 1000);
    const r = await kenerCall("POST", "/incidents", {
      title: `${label} is degraded`,
      start_date_time: nowSec,
      monitors: tags.map((monitor_tag) => ({ monitor_tag, impact: "DEGRADED" })),
    });
    if (r.ok && r.json.incident?.id != null) {
      const id = String(r.json.incident.id);
      await kenerCall("POST", `/incidents/${id}/comments`, {
        comment: `${label} is slower than usual or partly unavailable. We are looking into it. ${h.message}`.slice(0, 500),
        state: "INVESTIGATING",
        timestamp: nowSec,
      }).catch(() => {});
      (st.degraded ??= {})[service] = { id, tags };
    }
  } else if (!degraded && open && s.n <= -SAMPLES) {
    const monitors = await listMonitors().catch(() => []);
    const label = monitors.find((m) => m.tag === open.tags?.[0])?.name ?? service;
    const r = await kenerCall("POST", `/incidents/${open.id}/comments`, {
      comment: `${label} is back to normal.`,
      state: "RESOLVED",
      timestamp: Math.floor(now / 1000),
    });
    if (r.ok || r.status === 404) delete st.degraded![service];
  }
  await saveState(st);
}

let lastReconcile = 0;
/** Run the maintenance reconcile at most once a minute. Used by the status endpoints, which monitors poll. */
export async function maybeReconcile() {
  if (!kenerConfigured() || Date.now() - lastReconcile < 60_000) return;
  lastReconcile = Date.now();
  await reconcileMaintenance().catch((e) => console.error("kener reconcile failed", e instanceof Error ? e.message : e));
}

/* ---------------- Staff console (status manager) ---------------- */
export type StatusResource = { id: string; name: string; status: string };
export type StatusReport = {
  id: string;
  title: string;
  type: string;
  state: string;
  startsAt: string;
  endsAt: string | null;
  affected: { id: string; name: string; status: string }[];
};
export type StatusMonitor = { id: string; name: string; status: string; url: string; lastCheckedAt: string | null };

// Backwards-compatible type aliases
export type BsResource = StatusResource;
export type BsReport = StatusReport;
export type BsMonitor = StatusMonitor;

function mapImpact(impact?: string): "downtime" | "degraded" | "maintenance" | "operational" {
  const k = (impact ?? "").toUpperCase();
  if (k === "DOWN") return "downtime";
  if (k === "DEGRADED") return "degraded";
  if (k === "MAINTENANCE") return "maintenance";
  return "operational";
}

function mapMonitorPointStatus(raw?: string | null): "up" | "down" | "degraded" | "maintenance" | "pending" {
  const k = (raw ?? "").toUpperCase();
  if (k === "UP") return "up";
  if (k === "DOWN") return "down";
  if (k === "DEGRADED") return "degraded";
  if (k === "MAINTENANCE") return "maintenance";
  return "pending";
}

function monitorEndpointLabel(m: KenerMonitorRow): string {
  const td = m.type_data ?? {};
  if (typeof td.url === "string" && td.url) return td.url;
  if (typeof td.host === "string" && td.host) return `${m.monitor_type ?? "Check"}: ${td.host}`;
  return m.monitor_type ? `${m.monitor_type} (${m.tag})` : m.tag;
}

/** Fetches the most recent monitoring data point for every monitor (last 15 minutes), in parallel batches. */
export async function fetchLatestMonitorStatuses(tags: string[]): Promise<Map<string, { status: string; checkedAt: string | null }>> {
  const out = new Map<string, { status: string; checkedAt: string | null }>();
  const nowSec = Math.floor(Date.now() / 1000);
  const startSec = nowSec - 900;
  const endSec = nowSec + 60;
  const batchSize = 25;
  for (let i = 0; i < tags.length; i += batchSize) {
    const chunk = tags.slice(i, i + batchSize);
    await Promise.all(
      chunk.map(async (tag) => {
        try {
          const r = await kenerCall("GET", `/monitors/${encodeURIComponent(tag)}/data?start_ts=${startSec}&end_ts=${endSec}`, undefined, 3500);
          if (!r.ok) return;
          const pts = (r.json.data ?? []) as { timestamp: number; status: string }[];
          if (!pts.length) return;
          const latest = pts.reduce((a, b) => (b.timestamp > a.timestamp ? b : a), pts[0]);
          out.set(tag, { status: latest.status, checkedAt: new Date(latest.timestamp * 1000).toISOString() });
        } catch {
          // non-fatal
        }
      }),
    );
  }
  return out;
}

/** Everything the status manager shows: services as the public page sees them, recent incidents/maintenances, and the monitors behind them. */
export async function kenerOverview(): Promise<{ resources: StatusResource[]; reports: StatusReport[]; monitors: StatusMonitor[] }> {
  const [monRes, incRes, maintRes] = await Promise.all([
    kenerCall("GET", "/monitors"),
    kenerCall("GET", "/incidents"),
    kenerCall("GET", "/maintenances"),
  ]);
  if (!monRes.ok) throw new Error(monRes.status === 401 ? "Kener rejected the API key." : `Kener responded ${monRes.status}`);

  const rawMonitors = ((monRes.json.monitors ?? []) as KenerMonitorRow[]).slice().sort((a, b) => a.id - b.id);
  const rawIncidents = (incRes.ok ? (incRes.json.incidents ?? []) : []) as KenerIncidentRow[];
  const rawMaintenances = (maintRes.ok ? (maintRes.json.maintenances ?? []) : []) as KenerMaintenanceRow[];

  const latestByTag = await fetchLatestMonitorStatuses(rawMonitors.map((m) => m.tag));
  const nameByTag = new Map(rawMonitors.map((m) => [m.tag, m.name]));
  const nowMs = Date.now();

  const incidentReports: StatusReport[] = rawIncidents.map((inc) => {
    const resolved = inc.state?.toUpperCase() === "RESOLVED" || (inc.end_date_time != null && inc.end_date_time * 1000 <= nowMs);
    const affected = (inc.monitors ?? []).map((x) => ({
      id: x.monitor_tag,
      name: nameByTag.get(x.monitor_tag) ?? x.monitor_tag,
      status: resolved ? "resolved" : mapImpact(x.impact),
    }));
    const hasDown = affected.some((a) => a.status === "downtime");
    const state = resolved ? "resolved" : hasDown || affected.length === 0 ? "downtime" : "degraded";
    return {
      id: String(inc.id),
      title: inc.title,
      type: inc.incident_source === "API" || inc.incident_source === "MANUAL" ? "manual" : "automatic",
      state,
      startsAt: new Date(inc.start_date_time * 1000).toISOString(),
      endsAt: inc.end_date_time ? new Date(inc.end_date_time * 1000).toISOString() : null,
      affected,
    };
  });

  const maintReports: StatusReport[] = rawMaintenances.map((m) => {
    const startMs = m.start_date_time * 1000;
    const endMs = (m.start_date_time + m.duration_seconds) * 1000;
    const active = m.status === "ACTIVE" && endMs > nowMs;
    return {
      id: `m-${String(m.id)}`,
      title: m.title,
      type: "maintenance",
      state: active ? "maintenance" : "resolved",
      startsAt: new Date(startMs).toISOString(),
      endsAt: new Date(endMs).toISOString(),
      affected: (m.monitors ?? []).map((x) => ({
        id: x.monitor_tag,
        name: nameByTag.get(x.monitor_tag) ?? x.monitor_tag,
        status: active ? "maintenance" : "resolved",
      })),
    };
  });

  const reports = [...incidentReports, ...maintReports]
    .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))
    .slice(0, 40);

  // Determine effective public status per monitor (maintenance > active incident > latest realtime check > default)
  const overrideByTag = new Map<string, string>();
  for (const r of incidentReports) {
    if (r.state === "resolved") continue;
    for (const a of r.affected) {
      if (a.status === "downtime" || !overrideByTag.has(a.id)) overrideByTag.set(a.id, a.status);
    }
  }
  for (const r of maintReports) {
    if (r.state !== "maintenance") continue;
    if (Date.parse(r.startsAt) <= nowMs && r.endsAt && Date.parse(r.endsAt) > nowMs) {
      for (const a of r.affected) overrideByTag.set(a.id, "maintenance");
    }
  }

  const resources: StatusResource[] = rawMonitors
    .filter((m) => m.is_hidden !== "YES")
    .map((m) => {
      const ov = overrideByTag.get(m.tag);
      if (ov) return { id: m.tag, name: m.name, status: ov };
      if (m.status === "INACTIVE") return { id: m.tag, name: m.name, status: "pending" };
      const pt = mapMonitorPointStatus(latestByTag.get(m.tag)?.status ?? m.default_status);
      const status = pt === "up" ? "operational" : pt === "down" ? "downtime" : pt;
      return { id: m.tag, name: m.name, status };
    });

  const monitors: StatusMonitor[] = rawMonitors.map((m) => {
    const latest = latestByTag.get(m.tag);
    const status = m.status === "INACTIVE" ? "pending" : mapMonitorPointStatus(latest?.status ?? m.default_status);
    return {
      id: m.tag,
      name: m.name,
      status,
      url: monitorEndpointLabel(m),
      lastCheckedAt: latest?.checkedAt ?? m.updated_at ?? null,
    };
  });

  return { resources, reports, monitors };
}

const fail = (r: Resp, what: string) =>
  new Error(`${what} failed (${r.status}): ${r.json?.error?.message ?? JSON.stringify(r.json).slice(0, 160)}`);

export async function kenerCreateIncident(i: {
  title: string;
  message: string;
  resourceIds: string[];
  status: "degraded" | "downtime";
  notify: boolean;
}) {
  const nowSec = Math.floor(Date.now() / 1000);
  const impact = i.status === "degraded" ? "DEGRADED" : "DOWN";
  const r = await kenerCall("POST", "/incidents", {
    title: i.title,
    start_date_time: nowSec,
    monitors: i.resourceIds.map((monitor_tag) => ({ monitor_tag, impact })),
  });
  if (!r.ok) throw fail(r, "Creating the incident");
  const id = String(r.json.incident?.id);
  if (i.message.trim()) {
    const c = await kenerCall("POST", `/incidents/${id}/comments`, {
      comment: i.message.trim(),
      state: "INVESTIGATING",
      timestamp: nowSec,
    });
    if (!c.ok) throw fail(c, "Posting the initial incident message");
  }
  if (i.notify) await notifyStatusSubscribers(`Incident: ${i.title}`, i.message.trim() || "We are looking into an issue.");
  return id;
}

/** Posts an update comment on an incident, sets its Kener state, and updates affected monitor impact. */
export async function kenerUpdateIncident(
  reportId: string,
  message: string,
  status: "degraded" | "downtime" | "resolved",
  notify: boolean,
) {
  const id = reportId.replace(/^m-/, "");
  const state = status === "resolved" ? "RESOLVED" : status === "degraded" ? "MONITORING" : "IDENTIFIED";
  const nowSec = Math.floor(Date.now() / 1000);

  if (status !== "resolved") {
    const g = await kenerCall("GET", `/incidents/${id}`);
    if (g.ok) {
      const existing = (g.json.incident?.monitors ?? []) as { monitor_tag: string }[];
      if (existing.length) {
        const impact = status === "degraded" ? "DEGRADED" : "DOWN";
        await kenerCall("PATCH", `/incidents/${id}`, {
          monitors: existing.map((m) => ({ monitor_tag: m.monitor_tag, impact })),
        }).catch(() => {});
      }
    }
  }

  const r = await kenerCall("POST", `/incidents/${id}/comments`, {
    comment: message,
    state,
    timestamp: nowSec,
  });
  if (!r.ok) throw fail(r, "Posting the update");
  if (notify) {
    const label = status === "resolved" ? "Resolved" : status === "degraded" ? "Update" : "Update";
    await notifyStatusSubscribers(`${label}: OnboardOps status`, message);
  }
}

export async function kenerScheduleMaintenance(i: {
  title: string;
  message: string;
  resourceIds: string[];
  startsAt: string;
  endsAt: string;
  notify: boolean;
}) {
  const startSec = Math.floor(Date.parse(i.startsAt) / 1000);
  const endSec = Math.floor(Date.parse(i.endsAt) / 1000);
  const r = await kenerCall("POST", "/maintenances", {
    title: i.title,
    description: i.message,
    start_date_time: startSec,
    rrule: "FREQ=DAILY;COUNT=1",
    duration_seconds: Math.max(60, endSec - startSec),
    monitors: i.resourceIds.map((monitor_tag) => ({ monitor_tag, impact: "MAINTENANCE" })),
  });
  if (!r.ok) throw fail(r, "Scheduling the maintenance");
  return `m-${String(r.json.maintenance?.id)}`;
}

export async function kenerEndMaintenance(reportId: string) {
  const numId = reportId.replace(/^m-/, "");
  const g = await kenerCall("GET", `/maintenances/${numId}`);
  const startSec = g.ok ? Number(g.json.maintenance?.start_date_time ?? 0) : 0;
  const nowSec = Math.floor(Date.now() / 1000);
  const body: Record<string, unknown> = { status: "INACTIVE" };
  if (startSec > 0 && nowSec > startSec) body.duration_seconds = Math.max(60, nowSec - startSec);
  const r = await kenerCall("PATCH", `/maintenances/${numId}`, body);
  if (!r.ok) throw fail(r, "Ending the maintenance");
}

export async function kenerDeleteReport(reportId: string) {
  const isMaint = reportId.startsWith("m-");
  const numId = reportId.replace(/^m-/, "");
  const r = await kenerCall("DELETE", isMaint ? `/maintenances/${numId}` : `/incidents/${numId}`);
  if (!r.ok && r.status !== 404) throw fail(r, "Deleting the report");
}
