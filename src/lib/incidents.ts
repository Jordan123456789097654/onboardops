import { prisma } from "./prisma";

/** Better Stack incidents that are open right now. Kept by the webhook, read by the site on each request. */
export const INCIDENTS_ROW_ID = "__platform_betterstack_incidents__";
export const PLATFORM_INCIDENT_IDS = [INCIDENTS_ROW_ID];

export type OpenIncident = { id: string; name: string; cause: string | null; startedAt: string | null; status: string };

export async function getOpenIncidents(): Promise<OpenIncident[]> {
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
