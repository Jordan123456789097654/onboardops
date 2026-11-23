import { prisma } from "./prisma";

/** Better Stack incidents that are open right now. Kept by the webhook, read by the site on each request. */
export const INCIDENTS_ROW_ID = "__platform_betterstack_incidents__";
export const PLATFORM_INCIDENT_IDS = [INCIDENTS_ROW_ID];

export type OpenIncident = { id: string; name: string; cause: string | null; startedAt: string | null; status: string };

const CHECK_EVERY_MS = 60_000;
let lastCheck = 0;
let checking: Promise<void> | null = null;

/** Asks Better Stack for open incident reports, at most once a minute, and stores them. Runs on page loads, so no cron job is needed. */
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
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return;
      const json = (await res.json().catch(() => ({}))) as { data?: { id: unknown; attributes: Record<string, unknown> }[] };
      const open: Record<string, OpenIncident> = {};
      for (const r of json.data ?? []) {
        const a = r.attributes ?? {};
        const isOpen = a.report_type === "incident" && !a.ends_at && String(a.aggregate_state ?? "").toLowerCase() !== "resolved";
        if (!isOpen) continue;
        const id = String(r.id).slice(0, 64);
        open[id] = { id, name: str(a.title) ?? "Service incident", cause: str(a.message) ?? null, startedAt: str(a.starts_at), status: str(a.aggregate_state) ?? "Started" };
      }
      await prisma.jobRun.upsert({
        where: { id: INCIDENTS_ROW_ID },
        create: { id: INCIDENTS_ROW_ID, name: "platform:betterstack-incidents", ok: true, summary: { open }, durationMs: 0 },
        update: { summary: { open } },
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
    const s = (row?.summary ?? {}) as { open?: Record<string, OpenIncident> };
    return Object.values(s.open ?? {});
  } catch {
    return [];
  }
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : null);

/** Applies one Better Stack incident webhook. Open incidents are kept; resolved ones are removed. */
export async function applyIncidentWebhook(body: unknown) {
  const data = (body as { data?: { id?: unknown; attributes?: Record<string, unknown> } })?.data;
  const id = data?.id != null ? String(data.id).slice(0, 64) : null;
  const a = data?.attributes ?? {};
  if (!id) return { ok: false as const };
  const row = await prisma.jobRun.findUnique({ where: { id: INCIDENTS_ROW_ID } });
  const open = { ...(((row?.summary ?? {}) as { open?: Record<string, OpenIncident> }).open ?? {}) };
  const resolved = !!str(a.resolved_at) || String(a.status ?? "").toLowerCase() === "resolved";
  if (resolved) {
    delete open[id];
  } else {
    open[id] = {
      id,
      name: str(a.name) ?? str(a.url) ?? "Service incident",
      cause: str(a.cause),
      startedAt: str(a.started_at),
      status: str(a.status) ?? "Started",
    };
  }
  await prisma.jobRun.upsert({
    where: { id: INCIDENTS_ROW_ID },
    create: { id: INCIDENTS_ROW_ID, name: "platform:betterstack-incidents", ok: true, summary: { open }, durationMs: 0 },
    update: { summary: { open } },
  });
  return { ok: true as const, open: Object.keys(open).length };
}
