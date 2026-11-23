import { prisma } from "./prisma";
import { getOutageTest, INCIDENT_SETTINGS_ROW_ID } from "./maintenance";
import { checkAllServices, type ComponentHealth } from "./status";
import { open as unseal, seal } from "./secret-box";
import { COLORS, sendEmbed, validWebhookUrl } from "./webhooks";

/** Better Stack incidents & resource states. Kept by polling + webhook, read by the site on each request. */
export const INCIDENTS_ROW_ID = "__platform_betterstack_incidents__";
export const PLATFORM_INCIDENT_IDS = [INCIDENTS_ROW_ID, INCIDENT_SETTINGS_ROW_ID];

export type IncidentUpdate = { id: string; message: string; publishedAt: string | null };
export type IncidentAffected = { name: string; status: string };
export type OpenIncident = {
  id: string;
  name: string;
  cause: string | null;
  startedAt: string | null;
  status: string;
  reportType?: string;
  affected?: IncidentAffected[];
  updates?: IncidentUpdate[];
};
export type ResourceState = { name: string; status: string };
export type OutageOverrideMode = "auto" | "banner" | "muted";
export type OutageDisplayMode = "none" | "banner" | "lock";

export type OutageView = {
  active: boolean;
  /** "lock" = full-screen outage page; "banner" = sticky top degraded/partial-outage banner; "none" = operational or muted. */
  mode: OutageDisplayMode;
  overrideMode: OutageOverrideMode;
  simulated: boolean;
  services: string[];
  until: string | null;
  components: ComponentHealth[];
  incidents: OpenIncident[];
  checkedAt: string;
};

export type IncidentSettings = {
  overrideMode: OutageOverrideMode;
  webhookConfigured: boolean;
  webhookLabel: string;
  updatedBy: string | null;
  updatedAt: string | null;
};

type IncidentSettingsRow = {
  overrideMode?: OutageOverrideMode;
  webhookSealed?: string | null;
  webhookLabel?: string | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
};

type IncidentStore = {
  open?: Record<string, OpenIncident>;
  statusPage?: Record<string, OpenIncident>;
  webhook?: Record<string, OpenIncident>;
  resources?: ResourceState[];
  syncedAt?: string;
};

const CORE_RESOURCE_NAMES = new Set(["database", "sign-in", "core api", "website"]);
const CORE_SERVICE_IDS = new Set(["database", "auth", "api", "frontend"]);

const RESOURCE_TO_SERVICE: Record<string, string> = {
  website: "frontend",
  database: "database",
  "sign-in": "auth",
  "core api": "api",
  email: "email",
  "file storage": "storage",
  domains: "domains",
  "public api": "public_api",
};

const CHECK_EVERY_MS = 25_000;
let lastCheck = 0;
let checking: Promise<void> | null = null;

const str = (v: unknown, max = 240) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** True when a Better Stack status report represents an active outage (automatic monitor outage or manual incident, excluding maintenance). */
export function isActiveOutageReport(a: Record<string, unknown>, nowMs = Date.now()): boolean {
  const type = String(a.report_type ?? "").toLowerCase();
  const state = String(a.aggregate_state ?? "").toLowerCase();
  const isOutageType = type === "automatic" || type === "manual" || type === "incident";
  const isActiveState = state !== "resolved" && state !== "operational" && state !== "maintenance" && state !== "";
  const ended = typeof a.ends_at === "string" && a.ends_at.trim() !== "" && !isNaN(Date.parse(a.ends_at)) && Date.parse(a.ends_at) <= nowMs;
  return isOutageType && isActiveState && !ended;
}

/* ---------------- Incident settings (override mode + staff ops alert webhook) ---------------- */

let settingsCache: { at: number; v: IncidentSettings & { webhookUrl: string | null } } | null = null;

async function readSettingsFull(): Promise<IncidentSettings & { webhookUrl: string | null }> {
  if (settingsCache && Date.now() - settingsCache.at < 5000) return settingsCache.v;
  const fallback: IncidentSettings & { webhookUrl: string | null } = {
    overrideMode: "auto",
    webhookConfigured: false,
    webhookLabel: "",
    updatedBy: null,
    updatedAt: null,
    webhookUrl: null,
  };
  try {
    const row = await prisma.jobRun.findUnique({ where: { id: INCIDENT_SETTINGS_ROW_ID } });
    if (!row) {
      settingsCache = { at: Date.now(), v: fallback };
      return fallback;
    }
    const s = (row.summary ?? {}) as IncidentSettingsRow;
    const overrideMode: OutageOverrideMode = s.overrideMode === "banner" || s.overrideMode === "muted" ? s.overrideMode : "auto";
    const webhookUrl = typeof s.webhookSealed === "string" && s.webhookSealed ? unseal(s.webhookSealed) : null;
    const v = {
      overrideMode,
      webhookConfigured: !!webhookUrl,
      webhookLabel: typeof s.webhookLabel === "string" ? s.webhookLabel : "",
      updatedBy: typeof s.updatedBy === "string" ? s.updatedBy : null,
      updatedAt: typeof s.updatedAt === "string" ? s.updatedAt : row.createdAt.toISOString(),
      webhookUrl,
    };
    settingsCache = { at: Date.now(), v };
    return v;
  } catch {
    return fallback;
  }
}

export async function getIncidentSettings(): Promise<IncidentSettings> {
  const { webhookUrl: _hidden, ...pub } = await readSettingsFull();
  return pub;
}

export async function saveIncidentOverride(overrideMode: OutageOverrideMode, by: string): Promise<IncidentSettings> {
  const cur = await prisma.jobRun.findUnique({ where: { id: INCIDENT_SETTINGS_ROW_ID } }).catch(() => null);
  const prev = (cur?.summary ?? {}) as IncidentSettingsRow;
  const summary: IncidentSettingsRow = { ...prev, overrideMode, updatedBy: by, updatedAt: new Date().toISOString() };
  await prisma.jobRun.upsert({
    where: { id: INCIDENT_SETTINGS_ROW_ID },
    create: { id: INCIDENT_SETTINGS_ROW_ID, name: "platform:incident-settings", ok: true, summary, durationMs: 0 },
    update: { summary },
  });
  settingsCache = null;
  return getIncidentSettings();
}

export async function saveOpsAlertWebhook(rawUrl: string | null, by: string): Promise<IncidentSettings> {
  const cur = await prisma.jobRun.findUnique({ where: { id: INCIDENT_SETTINGS_ROW_ID } }).catch(() => null);
  const prev = (cur?.summary ?? {}) as IncidentSettingsRow;
  let webhookSealed: string | null = null;
  let webhookLabel = "";
  if (rawUrl && rawUrl.trim()) {
    const clean = rawUrl.trim();
    if (!validWebhookUrl(clean)) throw new Error("Use an https Discord, Slack, or Microsoft Teams webhook URL.");
    webhookSealed = seal(clean);
    const u = new URL(clean);
    webhookLabel = `${u.hostname}/…${clean.slice(-6)}`;
  }
  const summary: IncidentSettingsRow = { ...prev, webhookSealed, webhookLabel, updatedBy: by, updatedAt: new Date().toISOString() };
  await prisma.jobRun.upsert({
    where: { id: INCIDENT_SETTINGS_ROW_ID },
    create: { id: INCIDENT_SETTINGS_ROW_ID, name: "platform:incident-settings", ok: true, summary, durationMs: 0 },
    update: { summary },
  });
  settingsCache = null;
  return getIncidentSettings();
}

export async function notifyOpsAlert(embed: { title: string; description?: string; color?: number; fields?: { name: string; value: string; inline?: boolean }[] }) {
  const s = await readSettingsFull();
  if (!s.webhookUrl) return { ok: false as const, error: "No ops alert webhook configured" };
  return sendEmbed(s.webhookUrl, { ...embed, footer: "OnboardOps Incident Alerts" });
}

/* ---------------- Better Stack live sync ---------------- */

async function syncFromBetterStack(force = false) {
  const token = process.env.BETTERSTACK_API_TOKEN?.trim();
  if (!token || (!force && Date.now() - lastCheck < CHECK_EVERY_MS)) return;
  if (checking) return checking;
  lastCheck = Date.now();
  checking = (async () => {
    try {
      const pageId = process.env.BETTERSTACK_STATUS_PAGE_ID?.trim() || "272831";
      const headers = { Authorization: `Bearer ${token}`, "User-Agent": "OnboardOps/1.0" };
      const [repRes, resRes] = await Promise.all([
        fetch(`https://uptime.betterstack.com/api/v2/status-pages/${pageId}/status-reports?per_page=20&sort=-starts_at`, { headers, signal: AbortSignal.timeout(3500) }),
        fetch(`https://uptime.betterstack.com/api/v3/status-pages/${pageId}/resources?per_page=100`, { headers, signal: AbortSignal.timeout(3500) }).catch(() => null),
      ]);
      if (!repRes.ok) return;

      const repJson = (await repRes.json().catch(() => ({}))) as { data?: { id: unknown; attributes: Record<string, unknown> }[] };
      const resJson = resRes && resRes.ok ? ((await resRes.json().catch(() => ({}))) as { data?: { id: unknown; attributes: { public_name?: string; status?: string } }[] }) : null;

      const resourceNameById = new Map<string, string>();
      const resources: ResourceState[] = [];
      for (const r of resJson?.data ?? []) {
        const name = str(r.attributes?.public_name, 80);
        const status = str(r.attributes?.status, 32)?.toLowerCase() ?? "operational";
        if (name) {
          resourceNameById.set(String(r.id), name);
          resources.push({ name, status });
        }
      }

      const activeReports = (repJson.data ?? []).filter((r) => isActiveOutageReport(r.attributes ?? {}));

      // Fetch live status_updates timeline for open reports (usually 0-2 reports) in parallel.
      const updatesByReport = new Map<string, IncidentUpdate[]>();
      await Promise.all(
        activeReports.slice(0, 4).map(async (r) => {
          const rid = String(r.id).slice(0, 64);
          try {
            const ur = await fetch(`https://uptime.betterstack.com/api/v2/status-pages/${pageId}/status-reports/${rid}/status-updates?per_page=15`, {
              headers,
              signal: AbortSignal.timeout(2500),
            });
            if (!ur.ok) return;
            const uj = (await ur.json().catch(() => ({}))) as { data?: { id: unknown; attributes?: { message?: string; published_at?: string } }[] };
            const list: IncidentUpdate[] = (uj.data ?? [])
              .map((u) => ({
                id: String(u.id).slice(0, 64),
                message: str(u.attributes?.message, 1500) ?? "",
                publishedAt: str(u.attributes?.published_at, 64),
              }))
              .filter((u) => u.message.length > 0)
              .sort((a, b) => Date.parse(b.publishedAt ?? "") - Date.parse(a.publishedAt ?? ""))
              .slice(0, 8);
            updatesByReport.set(rid, list);
          } catch {
            // non-fatal: keep incident without updates
          }
        })
      );

      const statusPage: Record<string, OpenIncident> = {};
      for (const r of activeReports) {
        const a = r.attributes ?? {};
        const id = String(r.id).slice(0, 64);
        const rawAffected = Array.isArray(a.affected_resources) ? (a.affected_resources as { status_page_resource_id?: unknown; status?: string }[]) : [];
        const affected: IncidentAffected[] = rawAffected
          .map((x) => ({
            name: resourceNameById.get(String(x.status_page_resource_id ?? "")) ?? "",
            status: String(x.status ?? a.aggregate_state ?? "downtime").toLowerCase(),
          }))
          .filter((x) => x.name.length > 0);
        const updates = updatesByReport.get(id) ?? [];
        const latestMsg = updates[0]?.message ?? null;
        const fallbackCause = affected.length > 0
          ? `${affected.map((x) => x.name).slice(0, 4).join(", ")}${affected.length > 4 ? ` +${affected.length - 4} more` : ""}`
          : rawAffected.length > 0
            ? `${rawAffected.length} service${rawAffected.length === 1 ? "" : "s"} affected`
            : null;
        statusPage[id] = {
          id,
          name: str(a.title, 200) ?? "Service incident",
          cause: str(a.message, 400) ?? (latestMsg ? latestMsg.slice(0, 300) : fallbackCause),
          startedAt: str(a.starts_at, 64),
          status: str(a.aggregate_state, 32)?.toLowerCase() ?? "downtime",
          reportType: str(a.report_type, 32)?.toLowerCase() ?? "automatic",
          affected,
          updates,
        };
      }

      const existing = await prisma.jobRun.findUnique({ where: { id: INCIDENTS_ROW_ID } });
      const prev = (existing?.summary ?? {}) as IncidentStore;
      const prevSp = prev.statusPage ?? {};

      const summary: IncidentStore = {
        statusPage,
        webhook: prev.webhook ?? {},
        resources: resources.length ? resources : (prev.resources ?? []),
        syncedAt: new Date().toISOString(),
      };
      await prisma.jobRun.upsert({
        where: { id: INCIDENTS_ROW_ID },
        create: { id: INCIDENTS_ROW_ID, name: "platform:betterstack-incidents", ok: true, summary, durationMs: 0 },
        update: { summary },
      });

      // Notify ops Discord/Slack webhook on newly opened or newly resolved status-page incidents.
      for (const [id, inc] of Object.entries(statusPage)) {
        if (!prevSp[id]) {
          await notifyOpsAlert({
            title: `Incident opened: ${inc.name}`,
            description: inc.cause ?? "Better Stack reported an active service incident.",
            color: inc.status === "degraded" ? COLORS.warn : COLORS.danger,
            fields: [
              { name: "Status", value: inc.status, inline: true },
              { name: "Source", value: inc.reportType ?? "status page", inline: true },
              ...(inc.affected?.length ? [{ name: "Affected", value: inc.affected.map((x) => x.name).join(", ") }] : []),
            ],
          }).catch(() => {});
        }
      }
      for (const [id, old] of Object.entries(prevSp)) {
        if (!statusPage[id]) {
          await notifyOpsAlert({
            title: `Incident resolved: ${old.name}`,
            description: "The Better Stack status report is no longer active.",
            color: COLORS.ok,
          }).catch(() => {});
        }
      }
    } catch {
      // Better Stack unreachable: keep what we have. The site must never break because of this.
    }
  })().finally(() => { checking = null; });
  return checking;
}

export async function getIncidentSnapshot(opts?: { force?: boolean }): Promise<{ incidents: OpenIncident[]; resources: ResourceState[]; syncedAt: string | null }> {
  await syncFromBetterStack(!!opts?.force);
  try {
    const row = await prisma.jobRun.findUnique({ where: { id: INCIDENTS_ROW_ID } });
    const s = (row?.summary ?? {}) as IncidentStore;
    const merged = new Map<string, OpenIncident>();
    for (const [k, v] of Object.entries(s.statusPage ?? s.open ?? {})) merged.set(`sp:${k}`, v);
    for (const [k, v] of Object.entries(s.webhook ?? {})) merged.set(`wh:${k}`, v);
    return { incidents: [...merged.values()], resources: s.resources ?? [], syncedAt: s.syncedAt ?? null };
  } catch {
    return { incidents: [], resources: [], syncedAt: null };
  }
}

export async function getOpenIncidents(): Promise<OpenIncident[]> {
  return (await getIncidentSnapshot()).incidents;
}

/* ---------------- Component merging & severity classification ---------------- */

const RANK: Record<ComponentHealth["status"], number> = { up: 0, maintenance: 1, degraded: 2, down: 3 };

function mapResourceStatus(s: string): ComponentHealth["status"] {
  const k = s.toLowerCase();
  if (k === "downtime" || k === "down" || k === "major_outage") return "down";
  if (k === "degraded" || k === "partial_outage") return "degraded";
  if (k === "maintenance") return "maintenance";
  return "up";
}

/**
 * Combines local health probes with Better Stack's live status-page resources so OutageGate
 * never shows green "Operational" rows when external monitors report a service is down.
 */
function mergeComponents(local: ComponentHealth[], resources: ResourceState[], incidents: OpenIncident[]): ComponentHealth[] {
  const now = new Date().toISOString();
  const byService = new Map<string, ComponentHealth>(local.map((c) => [c.service, { ...c }]));

  const applyExternal = (rawName: string, rawStatus: string) => {
    const svc = RESOURCE_TO_SERVICE[rawName.trim().toLowerCase()];
    if (!svc) return;
    const extStatus = mapResourceStatus(rawStatus);
    const existing = byService.get(svc);
    if (!existing) {
      if (svc === "public_api" && extStatus !== "up") {
        byService.set(svc, {
          service: "public_api",
          status: extStatus,
          ok: extStatus !== "down",
          latencyMs: 0,
          message: extStatus === "down" ? "External monitor reported Public API downtime" : "External monitor reported Public API degradation",
          timestamp: now,
        });
      }
      return;
    }
    if (RANK[extStatus] > RANK[existing.status]) {
      byService.set(svc, {
        ...existing,
        status: extStatus,
        ok: extStatus !== "down",
        message:
          extStatus === "down"
            ? "External monitor reported service downtime"
            : extStatus === "degraded"
              ? "External monitor reported degraded performance"
              : existing.message,
      });
    }
  };

  for (const r of resources) applyExternal(r.name, r.status);
  for (const inc of incidents) {
    for (const a of inc.affected ?? []) applyExternal(a.name, a.status);
  }

  return [...byService.values()];
}

function classifyMode(opts: {
  outageTestActive: boolean;
  overrideMode: OutageOverrideMode;
  incidents: OpenIncident[];
  components: ComponentHealth[];
}): OutageDisplayMode {
  if (opts.outageTestActive) return "lock";
  if (opts.incidents.length === 0) return "none";
  if (opts.overrideMode === "muted") return "none";
  if (opts.overrideMode === "banner") return "banner";

  // Auto severity split: full-screen lock for core downtime or widespread outage; non-blocking banner for degraded / non-core issues.
  const coreComponentDown = opts.components.some((c) => CORE_SERVICE_IDS.has(c.service) && c.status === "down");
  if (coreComponentDown) return "lock";

  for (const inc of opts.incidents) {
    const st = inc.status.toLowerCase();
    const isDown = st === "downtime" || st === "down" || st === "started";
    if (!isDown) continue;
    const affected = inc.affected ?? [];
    if (affected.length === 0) return "lock"; // webhook or unknown scope with downtime -> play it safe
    const coreAffectedDown = affected.some((a) => CORE_RESOURCE_NAMES.has(a.name.toLowerCase()) && (a.status === "downtime" || a.status === "down"));
    if (coreAffectedDown) return "lock";
  }

  return "banner";
}

/** Builds the complete live OutageView used by RootLayout and GET /api/incidents. */
export async function buildOutageView(opts?: { forceSync?: boolean }): Promise<OutageView> {
  const [outageTest, snap, settings] = await Promise.all([
    getOutageTest(),
    getIncidentSnapshot({ force: opts?.forceSync }),
    getIncidentSettings(),
  ]);
  const hasAny = outageTest.active || snap.incidents.length > 0;
  if (!hasAny) {
    return {
      active: false,
      mode: "none",
      overrideMode: settings.overrideMode,
      simulated: false,
      services: [],
      until: null,
      components: [],
      incidents: [],
      checkedAt: new Date().toISOString(),
    };
  }
  const local = await checkAllServices().catch(() => null);
  const components = mergeComponents(local ? Object.values(local.services) : [], snap.resources, snap.incidents);
  const mode = classifyMode({
    outageTestActive: outageTest.active,
    overrideMode: settings.overrideMode,
    incidents: snap.incidents,
    components,
  });
  return {
    active: mode !== "none",
    mode,
    overrideMode: settings.overrideMode,
    simulated: outageTest.active,
    services: outageTest.services,
    until: outageTest.active ? outageTest.until : null,
    components,
    incidents: snap.incidents,
    checkedAt: new Date().toISOString(),
  };
}

/* ---------------- Better Stack incident webhook ---------------- */

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
  const name = str(a.name) ?? str(a.url) ?? "Service incident";
  const cause = str(a.cause);
  if (resolved) {
    delete webhook[id];
    await notifyOpsAlert({ title: `Monitor recovered: ${name}`, description: "Better Stack webhook reported this monitor as resolved.", color: COLORS.ok }).catch(() => {});
  } else {
    const isNew = !webhook[id];
    webhook[id] = {
      id,
      name,
      cause,
      startedAt: str(a.started_at),
      status: str(a.status) ?? "downtime",
      reportType: "webhook",
    };
    if (isNew) {
      await notifyOpsAlert({
        title: `Monitor down: ${name}`,
        description: cause ?? "Better Stack webhook reported downtime.",
        color: COLORS.danger,
      }).catch(() => {});
    }
  }
  const summary: IncidentStore = { statusPage: prev.statusPage ?? {}, webhook, resources: prev.resources ?? [], syncedAt: prev.syncedAt };
  await prisma.jobRun.upsert({
    where: { id: INCIDENTS_ROW_ID },
    create: { id: INCIDENTS_ROW_ID, name: "platform:betterstack-incidents", ok: true, summary, durationMs: 0 },
    update: { summary },
  });
  return { ok: true as const, open: Object.keys(webhook).length };
}
