import { prisma } from "./prisma";

/** Better Stack incidents that are open right now. Kept by the webhook, read by the site on each request. */
export const INCIDENTS_ROW_ID = "__platform_betterstack_incidents__";
export const PLATFORM_INCIDENT_IDS = [INCIDENTS_ROW_ID];

export type OpenIncident = { id: string; name: string; cause: string | null; startedAt: string | null; status: string };

type IncidentStore = {
  /** Legacy combined map (read-only fallback for pre-split rows). */
  open?: Record<string, OpenIncident>;
  statusPage?: Record<string, OpenIncident>;
  webhook?: Record<string, OpenIncident>;
};

const CHECK_EVERY_MS = 30_000;
let lastCheck = 0;
let checking: Promise<void> | null = null;

/** True when a Better Stack status report represents an active outage (automatic monitor outage or manual incident, excluding maintenance). */
export function isActiveOutageReport(a: Record<string, unknown>, nowMs = Date.now()): boolean {
  const type = String(a.report_type ?? "").toLowerCase();
  const state = String(a.aggregate_state ?? "").toLowerCase();
  const isOutageType = type === "automatic" || type === "manual" || type === "incident";
  const isActiveState = state !== "resolved" && state !== "operational" && state !== "maintenance" && state !== "";
  const ended = typeof a.ends_at === "string" && a.ends_at.trim() !== "" && !isNaN(Date.parse(a.ends_at)) && Date.parse(a.ends_at) <= nowMs;
  return isOutageType && isActiveState && !ended;
}

/** Asks Better Stack for open incident reports, at most every 30s, and stores them without wiping webhook incidents. */
async function syncFromBetterStack() {
  const token = process.env.BETTERSTACK_API_TOKEN?.trim();
  if (!token || Date.now() - lastCheck < CHECK_EVERY_MS) return;
  if (checking) return checking;
  lastCheck = Date.now();
  checking = (async () => {
    try {
      const pageId = process.env.BETTERSTACK_STATUS_PAGE_ID?.trim() || "272831";
      const res = await fetch(`https://uptime.betterstack.com/api/v2/status-pages/${pageId}/status-reports?per_page=30&sort=-starts_at`, {
        headers: { Authorization: `Bearer ${token}`, "User-Agent": "OnboardOps/1.0" },
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return;
      const json = (await res.json().catch(() => ({}))) as { data?: { id: unknown; attributes: Record<string, unknown> }[] };
      const statusPage: Record<string, OpenIncident> = {};
      for (const r of json.data ?? []) {
        const a = r.attributes ?? {};
        if (!isActiveOutageReport(a)) continue;
        const id = String(r.id).slice(0, 64);
        const affected = Array.isArray(a.affected_resources) ? a.affected_resources.length : 0;
        const fallbackCause = affected > 0 ? `${affected} service${affected === 1 ? "" : "s"} affected` : null;
        statusPage[id] = {
          id,
          name: str(a.title) ?? "Service incident",
          cause: str(a.message) ?? fallbackCause,
          startedAt: str(a.starts_at),
          status: str(a.aggregate_state) ?? "downtime",
        };
      }
      const existing = await prisma.jobRun.findUnique({ where: { id: INCIDENTS_ROW_ID } });
      const prev = (existing?.summary ?? {}) as IncidentStore;
      const summary: IncidentStore = { statusPage, webhook: prev.webhook ?? {} };
      await prisma.jobRun.upsert({
        where: { id: INCIDENTS_ROW_ID },
        create: { id: INCIDENTS_ROW_ID, name: "platform:betterstack-incidents", ok: true, summary, durationMs: 0 },
        update: { summary },
      });
    } catch {
      // Better Stack unreachable: keep what we have. The site must never break because of this.
    }
  })().finally(() => { checking = null; });
  return checking;
}

export async function getOpenIncidents(): Promise<OpenIncident[]> {
  await syncFromBetterStack();
  try {
    const row = await prisma.jobRun.findUnique({ where: { id: INCIDENTS_ROW_ID } });
    const s = (row?.summary ?? {}) as IncidentStore;
    const merged = new Map<string, OpenIncident>();
    for (const [k, v] of Object.entries(s.statusPage ?? s.open ?? {})) merged.set(`sp:${k}`, v);
    for (const [k, v] of Object.entries(s.webhook ?? {})) merged.set(`wh:${k}`, v);
    return [...merged.values()];
  } catch {
    return [];
  }
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : null);

/** Applies one Better Stack incident webhook. Open incidents are kept separately from status-page polling; resolved ones are removed. */
export async function applyIncidentWebhook(body: unknown) {
  const data = (body as { data?: { id?: unknown; attributes?: Record<string, unknown> } })?.data;
  const id = data?.id != null ? String(data.id).slice(0, 64) : null;
  const a = data?.attributes ?? {};
  if (!id) return { ok: false as const };
  const row = await prisma.jobRun.findUnique({ where: { id: INCIDENTS_ROW_ID } });
  const prev = (row?.summary ?? {}) as IncidentStore;
  const webhook = { ...(prev.webhook ?? {}) };
  const resolved = !!str(a.resolved_at) || String(a.status ?? "").toLowerCase() === "resolved";
  if (resolved) {
    delete webhook[id];
  } else {
    webhook[id] = {
      id,
      name: str(a.name) ?? str(a.url) ?? "Service incident",
      cause: str(a.cause),
      startedAt: str(a.started_at),
      status: str(a.status) ?? "Started",
    };
  }
  const summary: IncidentStore = { statusPage: prev.statusPage ?? {}, webhook };
  await prisma.jobRun.upsert({
    where: { id: INCIDENTS_ROW_ID },
    create: { id: INCIDENTS_ROW_ID, name: "platform:betterstack-incidents", ok: true, summary, durationMs: 0 },
    update: { summary },
  });
  return { ok: true as const, open: Object.keys(webhook).length };
}
