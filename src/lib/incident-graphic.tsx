import React from "react";
import { ImageResponse } from "next/og";
import { incidentNumber } from "@/lib/incident-number";
import type { BsReport } from "@/lib/betterstack";

const STATUS_HOST = "status.onboardops.org";

export type Style = "degraded" | "outage" | "restored" | "maintenance";
const STYLES: Style[] = ["degraded", "outage", "restored", "maintenance"];

const THEME: Record<Style, { tag: string; line1: string; line2: string; c1: string; c2: string; accent: string; icon: string }> = {
  degraded: { tag: "Degraded performance", line1: "Some things are", line2: "running slow.", c1: "#B45309", c2: "#78350F", accent: "#FCD34D", icon: "M12 9v4M10.4 3.9 2.6 17.4A2 2 0 0 0 4.3 20.4h15.4a2 2 0 0 0 1.7-3L13.6 3.9a2 2 0 0 0-3.2 0zM12 17h.01" },
  outage: { tag: "Service disruption", line1: "We're having", line2: "an outage.", c1: "#B91C1C", c2: "#7F1D1D", accent: "#FCA5A5", icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 9l6 6M15 9l-6 6" },
  restored: { tag: "Resolved", line1: "We're back.", line2: "All clear.", c1: "#047857", c2: "#064E3B", accent: "#6EE7B7", icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8.5 12.5l2.5 2.5 4.5-5" },
  maintenance: { tag: "Planned maintenance", line1: "Scheduled", line2: "maintenance.", c1: "#1D4ED8", c2: "#1E3A8A", accent: "#93C5FD", icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2" },
};

const isDone = (r: BsReport) => !!r.endsAt || /resolved|completed/i.test(r.state);
function autoStyle(r: BsReport): Style {
  if (isDone(r)) return "restored";
  if (/maint/i.test(r.type)) return "maintenance";
  return r.affected.some((a) => /down/i.test(a.status)) ? "outage" : "degraded";
}

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) + " UTC";
const duration = (a: string, b: string) => { const m = Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)); return m < 90 ? `${m} min` : `${Math.round(m / 6) / 10} hours`; };
const dot = (s: string) => (/down|outage/i.test(s) ? "#F87171" : /degrad/i.test(s) ? "#FBBF24" : /maint/i.test(s) ? "#60A5FA" : "#34D399");


export const STYLE_LIST = STYLES;

export function renderIncidentGraphic(r: BsReport, forced: Style | null) {
  const style: Style = forced && STYLES.includes(forced) ? forced : autoStyle(r);
  const t = THEME[style];
  const num = incidentNumber(r);
  const services = r.affected.slice(0, 6);
  const more = r.affected.length - services.length;
  const timeLine = r.endsAt && style === "restored" ? `Started ${when(r.startsAt)}  ·  Resolved ${when(r.endsAt)}  ·  ${duration(r.startsAt, r.endsAt)}` : `${style === "maintenance" ? "Starts" : "Started"} ${when(r.startsAt)}`;
  const title = r.title.length > 90 ? `${r.title.slice(0, 87)}...` : r.title;

  const img = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: `radial-gradient(circle at 85% 12%, ${t.c1} 0%, #0B1220 62%)`, color: "#fff", padding: "76px 84px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", fontSize: 36, fontWeight: 700 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "#2563EB", display: "flex", marginRight: 16 }} />
            OnboardOps
          </div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: t.accent, border: "2px solid rgba(255,255,255,0.3)", borderRadius: 14, padding: "10px 22px", background: "rgba(255,255,255,0.08)" }}>{num}</div>
        </div>
        <div style={{ display: "flex", marginTop: 54, alignItems: "center" }}>
          <div style={{ display: "flex", width: 120, height: 120, borderRadius: 32, background: "rgba(255,255,255,0.12)", border: "2px solid rgba(255,255,255,0.3)", alignItems: "center", justifyContent: "center", marginRight: 26 }}>
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={t.icon} /></svg>
          </div>
          <div style={{ display: "flex", fontSize: 32, fontWeight: 700, color: t.accent, textTransform: "uppercase", letterSpacing: 2 }}>{t.tag}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 100, lineHeight: 1.04, fontWeight: 800, marginTop: 28 }}>
          <div style={{ display: "flex" }}>{t.line1}</div>
          <div style={{ display: "flex", color: t.accent }}>{t.line2}</div>
        </div>
        <div style={{ display: "flex", fontSize: 34, lineHeight: 1.35, color: "#E2E8F0", marginTop: 26 }}>{title}</div>
        {services.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 30 }}>
            <div style={{ display: "flex", fontSize: 24, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Affected services</div>
            <div style={{ display: "flex", flexWrap: "wrap" }}>
              {services.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.1)", border: "1.5px solid rgba(255,255,255,0.22)", borderRadius: 999, padding: "10px 22px", marginRight: 12, marginBottom: 12, fontSize: 28 }}>
                  <div style={{ display: "flex", width: 16, height: 16, borderRadius: 8, background: style === "restored" ? "#34D399" : dot(s.status), marginRight: 12 }} />
                  {s.name}
                </div>
              ))}
              {more > 0 && <div style={{ display: "flex", alignItems: "center", fontSize: 28, color: "#CBD5E1", padding: "10px 6px" }}>{`+${more} more`}</div>}
            </div>
          </div>
        )}
        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 28, color: "#CBD5E1" }}>{timeLine}</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 30, color: "#94A3B8" }}>
            <div style={{ display: "flex", color: "#fff", fontWeight: 700 }}>{STATUS_HOST}</div>
            <div style={{ display: "flex" }}>{style === "restored" ? "Thank you for your patience" : "We'll post the next update here"}</div>
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 },
  );
  return { img, num, style };
}
