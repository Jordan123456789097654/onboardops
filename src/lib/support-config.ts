import { cache } from "react";
import { prisma } from "./prisma";
import type { PlatformRole } from "./platform-role";

import { CORE_STATUSES } from "./support-constants";
export { CORE_STATUSES, PRIORITIES, PRIORITY_RANK, CATEGORIES, DEFAULT_TAGS } from "./support-constants";
export type { Priority } from "./support-constants";

export type InboxRule = {
  id: string;
  name: string;
  match: { source?: string; topic?: string; pagePrefix?: string; tag?: string };
  reps: string[];
};

export type ApiKeyMeta = { id: string; name: string; hash: string; prefix: string; createdAt: string; lastUsedAt: string | null };

export type SupportPerm = "close" | "delete" | "export" | "block" | "settings";

export type SupportConfig = {
  hours: { tz: string; days: boolean[]; from: string; to: string };
  awayMessage: string;
  responseTarget: string;
  sla: { warnMin: number; breachMin: number };
  statuses: string[];
  autoAssign: { enabled: boolean; reps: string[] };
  inboxes: InboxRule[];
  idle: { enabled: boolean; nudgeDays: number; closeDays: number };
  retentionMonths: number;
  webhook: { urlSealed: string | null; secretSealed: string | null; host: string | null; events: string[] };
  apiKeys: ApiKeyMeta[];
  perms: Record<SupportPerm, PlatformRole[]>;
  brand: { name: string; subtitle: string; color: string; greeting: string; avatar: string };
};

export const DEFAULT_CONFIG: SupportConfig = {
  hours: { tz: "America/New_York", days: [false, true, true, true, true, true, false], from: "09:00", to: "17:00" },
  awayMessage: "Our team is away right now. Leave your details and we will reply when we are back.",
  responseTarget: "within 2 business days",
  sla: { warnMin: 240, breachMin: 1440 },
  statuses: [],
  autoAssign: { enabled: false, reps: [] },
  inboxes: [],
  idle: { enabled: true, nudgeDays: 3, closeDays: 3 },
  retentionMonths: 0,
  webhook: { urlSealed: null, secretSealed: null, host: null, events: ["ticket.created", "ticket.visitor_message", "ticket.replied", "ticket.solved"] },
  apiKeys: [],
  perms: { close: ["OWNER", "SUPPORT"], delete: ["OWNER"], export: ["OWNER"], block: ["OWNER", "SUPPORT"], settings: ["OWNER"] },
  brand: { name: "Maya", subtitle: "Here to help", color: "", greeting: "I'm Maya, your OnboardOps guide. Ask me anything. I know the docs inside out!", avatar: "" },
};

function mergeConfig(raw: unknown): SupportConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<SupportConfig>;
  const d = DEFAULT_CONFIG;
  return {
    ...d,
    ...r,
    hours: { ...d.hours, ...(r.hours ?? {}), days: Array.isArray(r.hours?.days) && r.hours.days.length === 7 ? r.hours.days : d.hours.days },
    sla: { ...d.sla, ...(r.sla ?? {}) },
    autoAssign: { ...d.autoAssign, ...(r.autoAssign ?? {}) },
    idle: { ...d.idle, ...(r.idle ?? {}) },
    webhook: { ...d.webhook, ...(r.webhook ?? {}) },
    perms: { ...d.perms, ...(r.perms ?? {}) },
    brand: { ...d.brand, ...(r.brand ?? {}) },
    statuses: Array.isArray(r.statuses) ? r.statuses : [],
    inboxes: Array.isArray(r.inboxes) ? r.inboxes : [],
    apiKeys: Array.isArray(r.apiKeys) ? r.apiKeys : [],
  };
}

export const getSupportConfig = cache(async (): Promise<SupportConfig> => {
  const row = await prisma.supportConfig.findUnique({ where: { id: "main" } }).catch(() => null);
  return mergeConfig(row?.data);
});

export async function saveSupportConfig(patch: Partial<SupportConfig>): Promise<SupportConfig> {
  const row = await prisma.supportConfig.findUnique({ where: { id: "main" } });
  const next = mergeConfig({ ...(row?.data as object | undefined), ...patch });
  await prisma.supportConfig.upsert({ where: { id: "main" }, create: { id: "main", data: next as object }, update: { data: next as object } });
  return next;
}

export function can(cfg: SupportConfig, role: PlatformRole, perm: SupportPerm): boolean {
  if (role === "OWNER") return true;
  return cfg.perms[perm]?.includes(role) ?? false;
}

export function allStatuses(cfg: SupportConfig): string[] {
  return [...CORE_STATUSES, ...cfg.statuses.filter((s) => !(CORE_STATUSES as readonly string[]).includes(s))];
}

/* ---------------- Business hours ---------------- */

function localParts(date: Date, tz: string): { dow: number; minutes: number } {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const parts = Object.fromEntries(f.formatToParts(date).map((p) => [p.type, p.value]));
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { dow, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export function isOpenAt(cfg: SupportConfig, date: Date): boolean {
  try {
    const { dow, minutes } = localParts(date, cfg.hours.tz);
    return !!cfg.hours.days[dow] && minutes >= toMin(cfg.hours.from) && minutes < toMin(cfg.hours.to);
  } catch {
    return true;
  }
}

export type HoursStatus = { open: boolean; nextOpenLabel: string | null };

export function hoursStatus(cfg: SupportConfig, now = new Date()): HoursStatus {
  if (isOpenAt(cfg, now)) return { open: true, nextOpenLabel: null };
  if (!cfg.hours.days.some(Boolean)) return { open: false, nextOpenLabel: null };
  for (let i = 1; i <= 8 * 24 * 4; i++) {
    let t = new Date(now.getTime() + i * 15 * 60000);
    if (isOpenAt(cfg, t)) {
      // Step back to the exact minute the desk opens.
      for (let b = 0; b < 15 && isOpenAt(cfg, new Date(t.getTime() - 60000)); b++) t = new Date(t.getTime() - 60000);
      const label = new Intl.DateTimeFormat("en-US", { timeZone: cfg.hours.tz, weekday: "long", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(t);
      return { open: false, nextOpenLabel: label.replace(",", " at") };
    }
  }
  return { open: false, nextOpenLabel: null };
}

/** What a visitor may see. No secrets. */
export function publicSupportStatus(cfg: SupportConfig) {
  const h = hoursStatus(cfg);
  return {
    open: h.open,
    nextOpenLabel: h.nextOpenLabel,
    awayMessage: cfg.awayMessage,
    responseTarget: cfg.responseTarget,
    brand: cfg.brand,
  };
}
