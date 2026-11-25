import type { BsReport } from "@/lib/betterstack";

export type Style = "degraded" | "outage" | "restored" | "maintenance" | "falsepositive";
export const STYLE_LIST: Style[] = ["degraded", "outage", "restored", "maintenance", "falsepositive"];

/** How each graphic style is named and described in the admin menu. */
export const STYLE_INFO: Record<Style, { label: string; desc: string; color: string }> = {
  outage: { label: "Outage", desc: "Something is down", color: "#F87171" },
  degraded: { label: "Degraded", desc: "Slow or partly working", color: "#FBBF24" },
  restored: { label: "Restored", desc: "Fixed, all clear", color: "#34D399" },
  maintenance: { label: "Maintenance", desc: "Planned work", color: "#60A5FA" },
  falsepositive: { label: "False alarm", desc: "Alert was a false positive", color: "#2DD4BF" },
};
export const MENU_ORDER: Style[] = ["outage", "degraded", "restored", "maintenance", "falsepositive"];

const isDone = (r: Pick<BsReport, "endsAt" | "state">) => !!r.endsAt || /resolved|completed/i.test(r.state);
/** The style that fits an incident when staff do not choose one. */
export function autoStyle(r: Pick<BsReport, "endsAt" | "state" | "type" | "affected">): Style {
  if (isDone(r)) return "restored";
  if (/maint/i.test(r.type)) return "maintenance";
  return r.affected.some((a) => /down/i.test(a.status)) ? "outage" : "degraded";
}
