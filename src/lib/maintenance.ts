import { prisma } from "./prisma";
import { ALL_AREAS, type MaintArea } from "./maintenance-areas";

export const MAINTENANCE_ROW_ID = "__platform_maintenance__";
export const ANNOUNCEMENT_ROW_ID = "__platform_announcement__";
export const VISITS_ROW_ID = "__platform_visits__";
export const BETTERSTACK_ROW_ID = "__platform_betterstack__";
export const SIMULATION_ROW_ID = "__platform_outage_test__";
export const PLATFORM_META_IDS = [MAINTENANCE_ROW_ID, ANNOUNCEMENT_ROW_ID, VISITS_ROW_ID, BETTERSTACK_ROW_ID, SIMULATION_ROW_ID, "__platform_betterstack_incidents__"];

/**
 * Outage test. While active, the health checks for the chosen services report "down" (HTTP 503), so monitors and the public status
 * page react exactly as in a real outage. Nothing else changes: the app and the real database keep working. It always expires.
 */
export type OutageTest = { active: boolean; services: string[]; until: string | null; startedBy: string | null };
export const OUTAGE_SERVICES = ["database", "storage", "auth", "api", "email", "frontend", "domains"] as const;
/** A database outage also takes down everything that depends on it. */
export const OUTAGE_CASCADE: Record<string, string[]> = { database: ["database", "storage", "auth", "api"] };
export const MAX_OUTAGE_MINUTES = 60;

let simCache: { at: number; v: OutageTest } | null = null;
export async function getOutageTest(): Promise<OutageTest> {
  if (simCache && Date.now() - simCache.at < 2000) return simCache.v;
  let v: OutageTest = { active: false, services: [], until: null, startedBy: null };
  try {
    const row = await prisma.jobRun.findUnique({ where: { id: SIMULATION_ROW_ID } });
    const s = (row?.summary ?? {}) as Record<string, unknown>;
    const until = typeof s.until === "string" ? s.until : null;
    const services = Array.isArray(s.services) ? (s.services as unknown[]).filter((x): x is string => typeof x === "string") : [];
    if (row?.ok && until && Date.parse(until) > Date.now() && services.length) v = { active: true, services, until, startedBy: typeof s.startedBy === "string" ? s.startedBy : null };
  } catch { /* a database problem must never turn the test on */ }
  simCache = { at: Date.now(), v };
  return v;
}
/** True when the outage test is forcing this service down. */
export async function isSimulatedDown(service: string): Promise<boolean> {
  const t = await getOutageTest();
  return t.active && t.services.some((s) => (OUTAGE_CASCADE[s] ?? [s]).includes(service));
}
export async function startOutageTest(services: string[], minutes: number, by: string) {
  const mins = Math.max(1, Math.min(MAX_OUTAGE_MINUTES, Math.round(minutes)));
  const until = new Date(Date.now() + mins * 60_000).toISOString();
  const summary = { services, until, startedBy: by };
  await prisma.jobRun.upsert({ where: { id: SIMULATION_ROW_ID }, create: { id: SIMULATION_ROW_ID, name: "platform:outage-test", ok: true, summary, durationMs: 0 }, update: { ok: true, summary } });
  simCache = null;
  return until;
}
export async function stopOutageTest() {
  await prisma.jobRun.updateMany({ where: { id: SIMULATION_ROW_ID }, data: { ok: false } });
  simCache = null;
}

export type MaintenanceState = {
  enabled: boolean;
  manualEnabled: boolean;
  scheduledActive: boolean;
  /** Which areas are locked while enabled. */
  areas: MaintArea[];
  /** How many minutes before a window starts the notice banner begins (it also shows earlier if a window is scheduled further out, with a longer countdown). */
  noticeMinutes: number;
  /** A future window is scheduled and has not started. */
  upcoming: boolean;
  message: string;
  eta: string | null;
  startsAt: string | null;
  endsAt: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
};

export type AnnouncementState = {
  enabled: boolean;
  message: string;
  tone: "info" | "warning" | "success";
  linkUrl: string | null;
  linkLabel: string | null;
  dismissible: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
};

export type SiteVisitsState = {
  total: number;
  today: number;
  last7d: number;
  last30d: number;
  dailyLabels: string[];
  dailyCounts: number[];
  topPaths: { path: string; count: number }[];
};

const DEFAULT_MESSAGE = "OnboardOps is currently undergoing scheduled maintenance and upgrades. Your workspace data is safe and we will be back shortly.";

export async function getMaintenanceState(): Promise<MaintenanceState> {
  try {
    const row = await prisma.jobRun.findUnique({ where: { id: MAINTENANCE_ROW_ID } });
    if (!row) {
      return { enabled: false, manualEnabled: false, scheduledActive: false, areas: ALL_AREAS, noticeMinutes: 60, upcoming: false, message: DEFAULT_MESSAGE, eta: null, startsAt: null, endsAt: null, updatedBy: null, updatedAt: null };
    }
    const s = (row.summary ?? {}) as Record<string, unknown>;
    const startsAt = typeof s.startsAt === "string" && s.startsAt.trim() ? s.startsAt.trim() : null;
    const endsAt = typeof s.endsAt === "string" && s.endsAt.trim() ? s.endsAt.trim() : null;
    const now = Date.now();
    const startMs = startsAt ? Date.parse(startsAt) : NaN;
    const endMs = endsAt ? Date.parse(endsAt) : NaN;

    let manualEnabled = !!row.ok;
    let scheduledActive = false;

    // Auto-end check: if endsAt has passed, automatically unlock!
    if (!isNaN(endMs) && now >= endMs) {
      manualEnabled = false;
      scheduledActive = false;
    } else if (!isNaN(startMs)) {
      // Scheduled window: auto-starts when now >= startMs (and before endMs if set)
      if (now >= startMs) {
        scheduledActive = true;
      }
    }

    const enabled = manualEnabled || scheduledActive;
    const upcoming = !enabled && !isNaN(startMs) && startMs > now && !(!isNaN(endMs) && now >= endMs);
    const areas = Array.isArray(s.areas) ? ALL_AREAS.filter((a) => (s.areas as unknown[]).includes(a)) : ALL_AREAS;
    const noticeMinutes = typeof s.noticeMinutes === "number" && s.noticeMinutes >= 0 && s.noticeMinutes <= 10080 ? Math.round(s.noticeMinutes) : 60;
    const autoEta = !s.eta && endsAt && !isNaN(endMs) && endMs > now ? new Date(endMs).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }) : null;

    return {
      enabled,
      manualEnabled,
      scheduledActive,
      areas: areas.length ? areas : ALL_AREAS,
      noticeMinutes,
      upcoming,
      message: typeof s.message === "string" && s.message.trim() ? s.message.trim() : DEFAULT_MESSAGE,
      eta: typeof s.eta === "string" && s.eta.trim() ? s.eta.trim() : autoEta,
      startsAt,
      endsAt,
      updatedBy: typeof s.updatedBy === "string" ? s.updatedBy : null,
      updatedAt: typeof s.updatedAt === "string" ? s.updatedAt : row.createdAt.toISOString(),
    };
  } catch {
    return { enabled: false, manualEnabled: false, scheduledActive: false, areas: ALL_AREAS, noticeMinutes: 60, upcoming: false, message: DEFAULT_MESSAGE, eta: null, startsAt: null, endsAt: null, updatedBy: null, updatedAt: null };
  }
}

export async function saveMaintenanceState(input: {
  enabled: boolean;
  message?: string;
  eta?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  areas?: MaintArea[];
  noticeMinutes?: number;
  updatedBy: string;
}): Promise<MaintenanceState> {
  const message = input.message?.trim() || DEFAULT_MESSAGE;
  const eta = input.eta?.trim() || null;
  const startsAt = input.startsAt?.trim() || null;
  const endsAt = input.endsAt?.trim() || null;
  const updatedAt = new Date().toISOString();
  const areas = (input.areas ?? ALL_AREAS).filter((a) => ALL_AREAS.includes(a));
  const noticeMinutes = Math.min(10080, Math.max(0, Math.round(input.noticeMinutes ?? 60)));
  const summary = { enabled: input.enabled, message, eta, startsAt, endsAt, areas: areas.length ? areas : ALL_AREAS, noticeMinutes, updatedBy: input.updatedBy, updatedAt };
  cached = null;
  await prisma.jobRun.upsert({
    where: { id: MAINTENANCE_ROW_ID },
    create: { id: MAINTENANCE_ROW_ID, name: "platform:maintenance", ok: input.enabled, summary, durationMs: 0 },
    update: { ok: input.enabled, summary },
  });
  return getMaintenanceState();
}

let cached: { at: number; v: MaintenanceState } | null = null;
/** The same state, kept for a few seconds. For guards that run on every request or action. */
export async function getMaintenanceCached(): Promise<MaintenanceState> {
  if (cached && Date.now() - cached.at < 5000) return cached.v;
  const v = await getMaintenanceState();
  cached = { at: Date.now(), v };
  return v;
}

export async function getAnnouncementState(): Promise<AnnouncementState> {
  try {
    const row = await prisma.jobRun.findUnique({ where: { id: ANNOUNCEMENT_ROW_ID } });
    if (!row) return { enabled: false, message: "", tone: "info", linkUrl: null, linkLabel: null, dismissible: true, updatedBy: null, updatedAt: null };
    const s = (row.summary ?? {}) as Record<string, unknown>;
    const tone = s.tone === "warning" || s.tone === "success" ? s.tone : "info";
    return {
      enabled: !!row.ok && typeof s.message === "string" && s.message.trim().length > 0,
      message: typeof s.message === "string" ? s.message : "",
      tone,
      linkUrl: typeof s.linkUrl === "string" && s.linkUrl.trim() ? s.linkUrl.trim() : null,
      linkLabel: typeof s.linkLabel === "string" && s.linkLabel.trim() ? s.linkLabel.trim() : null,
      dismissible: s.dismissible !== false,
      updatedBy: typeof s.updatedBy === "string" ? s.updatedBy : null,
      updatedAt: typeof s.updatedAt === "string" ? s.updatedAt : row.createdAt.toISOString(),
    };
  } catch {
    return { enabled: false, message: "", tone: "info", linkUrl: null, linkLabel: null, dismissible: true, updatedBy: null, updatedAt: null };
  }
}

export async function saveAnnouncementState(input: {
  enabled: boolean;
  message: string;
  tone: "info" | "warning" | "success";
  linkUrl?: string | null;
  linkLabel?: string | null;
  dismissible?: boolean;
  updatedBy: string;
}): Promise<AnnouncementState> {
  const updatedAt = new Date().toISOString();
  const summary = {
    enabled: input.enabled,
    message: input.message.trim(),
    tone: input.tone,
    linkUrl: input.linkUrl?.trim() || null,
    linkLabel: input.linkLabel?.trim() || null,
    dismissible: input.dismissible !== false,
    updatedBy: input.updatedBy,
    updatedAt,
  };
  await prisma.jobRun.upsert({
    where: { id: ANNOUNCEMENT_ROW_ID },
    create: { id: ANNOUNCEMENT_ROW_ID, name: "platform:announcement", ok: input.enabled, summary, durationMs: 0 },
    update: { ok: input.enabled, summary },
  });
  return getAnnouncementState();
}

export async function recordSiteVisit(rawPath: string) {
  try {
    const cleanPath = (rawPath || "/").split("?")[0].slice(0, 80) || "/";
    if (cleanPath.startsWith("/api/") || cleanPath.startsWith("/_next/")) return;
    const todayKey = new Date().toISOString().slice(0, 10);
    const existing = await prisma.jobRun.findUnique({ where: { id: VISITS_ROW_ID } });
    const data = (existing?.summary ?? {}) as { total?: number; byDay?: Record<string, number>; paths?: Record<string, number> };
    const total = (Number(data.total) || 0) + 1;
    const byDay: Record<string, number> = { ...(data.byDay ?? {}) };
    byDay[todayKey] = (byDay[todayKey] || 0) + 1;
    // Keep last 90 days only
    const keys = Object.keys(byDay).sort();
    while (keys.length > 90) {
      const oldest = keys.shift();
      if (oldest) delete byDay[oldest];
    }
    const paths: Record<string, number> = { ...(data.paths ?? {}) };
    paths[cleanPath] = (paths[cleanPath] || 0) + 1;
    const sortedPaths = Object.entries(paths)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30);
    const trimmedPaths = Object.fromEntries(sortedPaths);
    const summary = { total, byDay, paths: trimmedPaths };
    await prisma.jobRun.upsert({
      where: { id: VISITS_ROW_ID },
      create: { id: VISITS_ROW_ID, name: "platform:visits", ok: true, summary, durationMs: 0 },
      update: { summary },
    });
  } catch {
    // Non-fatal analytics write
  }
}

export async function getSiteVisits(): Promise<SiteVisitsState> {
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const dailyLabels = days.map((d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`);
  try {
    const row = await prisma.jobRun.findUnique({ where: { id: VISITS_ROW_ID } });
    if (!row) {
      return { total: 0, today: 0, last7d: 0, last30d: 0, dailyLabels, dailyCounts: days.map(() => 0), topPaths: [] };
    }
    const data = (row.summary ?? {}) as { total?: number; byDay?: Record<string, number>; paths?: Record<string, number> };
    const byDay = data.byDay ?? {};
    const todayKey = new Date().toISOString().slice(0, 10);
    const d7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const d30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    let last7d = 0;
    let last30d = 0;
    for (const [k, v] of Object.entries(byDay)) {
      if (k >= d7) last7d += Number(v) || 0;
      if (k >= d30) last30d += Number(v) || 0;
    }
    const dailyCounts = days.map((d) => Number(byDay[d]) || 0);
    const topPaths = Object.entries(data.paths ?? {})
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 8)
      .map(([path, count]) => ({ path, count: Number(count) || 0 }));
    return {
      total: Number(data.total) || 0,
      today: Number(byDay[todayKey]) || 0,
      last7d,
      last30d,
      dailyLabels,
      dailyCounts,
      topPaths,
    };
  } catch {
    return { total: 0, today: 0, last7d: 0, last30d: 0, dailyLabels, dailyCounts: days.map(() => 0), topPaths: [] };
  }
}
