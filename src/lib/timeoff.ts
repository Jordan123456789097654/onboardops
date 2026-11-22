export const TIMEOFF_TYPES = ["VACATION", "SICK", "PERSONAL"] as const;
export type TimeOffType = (typeof TIMEOFF_TYPES)[number];

export const daysBetween = (start: Date, end: Date) => Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);

export function allowanceOf(raw: unknown): Record<TimeOffType, number> {
  const m = (raw ?? {}) as Record<string, unknown>;
  const n = (k: string) => { const v = Number(m[k] ?? 0); return Number.isFinite(v) && v >= 0 && v <= 365 ? v : 0; };
  return { VACATION: n("VACATION"), SICK: n("SICK"), PERSONAL: n("PERSONAL") };
}

type Req = { subtype: string | null; status: string; startDate: Date | null; endDate: Date | null };

/** Days used this calendar year (approved) and days waiting on a decision (pending), per type. */
export function usage(reqs: Req[], year = new Date().getUTCFullYear()) {
  const out: Record<TimeOffType, { used: number; pending: number }> = { VACATION: { used: 0, pending: 0 }, SICK: { used: 0, pending: 0 }, PERSONAL: { used: 0, pending: 0 } };
  for (const r of reqs) {
    if (!r.subtype || !r.startDate || !r.endDate || !(r.subtype in out)) continue;
    if (r.startDate.getUTCFullYear() !== year) continue;
    const d = daysBetween(r.startDate, r.endDate);
    if (r.status === "APPROVED") out[r.subtype as TimeOffType].used += d;
    else if (r.status === "PENDING") out[r.subtype as TimeOffType].pending += d;
  }
  return out;
}
