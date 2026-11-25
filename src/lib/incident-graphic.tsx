import React from "react";
import { ImageResponse } from "next/og";
import { incidentNumber } from "@/lib/incident-number";
import type { BsReport } from "@/lib/betterstack";

const STATUS_HOST = "status.onboardops.org";

import { STYLE_LIST, autoStyle, type Style } from "@/lib/incident-style";

export { STYLE_LIST };
export type { Style };

const THEME: Record<Style, { tag: string; line1: string; line2: string; glow: string; accent: string; soft: string; icon: string }> = {
  degraded: { tag: "Degraded performance", line1: "Things are", line2: "running slow.", glow: "#F59E0B", accent: "#FBBF24", soft: "rgba(251,191,36,0.14)", icon: "M12 9v4M10.4 3.9 2.6 17.4A2 2 0 0 0 4.3 20.4h15.4a2 2 0 0 0 1.7-3L13.6 3.9a2 2 0 0 0-3.2 0zM12 17h.01" },
  outage: { tag: "Service disruption", line1: "We're having", line2: "an outage.", glow: "#EF4444", accent: "#F87171", soft: "rgba(248,113,113,0.14)", icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 9l6 6M15 9l-6 6" },
  restored: { tag: "Resolved", line1: "We're back.", line2: "All clear.", glow: "#10B981", accent: "#34D399", soft: "rgba(52,211,153,0.14)", icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8.5 12.5l2.5 2.5 4.5-5" },
  falsepositive: { tag: "False alarm", line1: "False alarm.", line2: "All is well.", glow: "#14B8A6", accent: "#2DD4BF", soft: "rgba(45,212,191,0.14)", icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8h.01M11 12h1v4h1" },
  maintenance: { tag: "Planned maintenance", line1: "Scheduled", line2: "maintenance.", glow: "#3B82F6", accent: "#60A5FA", soft: "rgba(96,165,250,0.14)", icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2" },
};

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "UTC", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " UTC";
const timeOnly = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "UTC", hour: "numeric", minute: "2-digit" }) + " UTC";
const duration = (a: string, b: string) => { const m = Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)); return m < 90 ? `${m} min` : `${Math.round(m / 6) / 10} hours`; };
const dot = (s: string) => (/down|outage/i.test(s) ? "#F87171" : /degrad/i.test(s) ? "#FBBF24" : /maint/i.test(s) ? "#60A5FA" : "#34D399");

type Font = { name: string; data: ArrayBuffer; weight: 400 | 600 | 800; style: "normal" };
let fontPromise: Promise<Font[] | undefined> | null = null;
/** Inter in three weights, fetched once and kept. If the fetch fails, the built-in font is used so the graphic still renders. */
function loadFonts(): Promise<Font[] | undefined> {
  if (!fontPromise) {
    const get = async (w: 400 | 600 | 800): Promise<Font> => {
      const r = await fetch(`https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-${w}-normal.woff`, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error("font");
      return { name: "Inter", data: await r.arrayBuffer(), weight: w, style: "normal" };
    };
    fontPromise = Promise.all([get(400), get(600), get(800)]).catch(() => { fontPromise = null; return undefined; });
  }
  return fontPromise;
}

export async function renderIncidentGraphic(r: BsReport, forced: Style | null) {
  const style: Style = forced && STYLE_LIST.includes(forced) ? forced : autoStyle(r);
  const t = THEME[style];
  const num = incidentNumber(r);
  const services = r.affected.slice(0, 6);
  const more = r.affected.length - services.length;
  const done = !!r.endsAt && style === "restored";
  const fp = style === "falsepositive";
  const bannerRight = fp ? `Alert at ${timeOnly(r.startsAt)}` : done ? `Resolved after ${duration(r.startsAt, r.endsAt!)}` : `${style === "maintenance" ? "Starts" : "Since"} ${timeOnly(r.startsAt)}`;
  const detail = fp ? `Alert raised ${when(r.startsAt)}` : done ? `Started ${when(r.startsAt)}  ·  Resolved ${when(r.endsAt!)}` : `${style === "maintenance" ? "Starts" : "Started"} ${when(r.startsAt)}`;
  const title = r.title.length > 100 ? `${r.title.slice(0, 97)}...` : r.title;
  const fonts = await loadFonts();
  const F = fonts ? "Inter" : "sans-serif";

  const img = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0A0F1C", color: "#fff", fontFamily: F, position: "relative", padding: "68px 76px" }}>
        <div style={{ position: "absolute", top: 0, left: 0, width: 1080, height: 1080, display: "flex", background: `radial-gradient(circle at 100% 0%, ${t.soft.replace("0.14", "0.34")} 0%, rgba(10,15,28,0) 62%)` }} />
        <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 12, background: t.accent, display: "flex" }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", width: 56, height: 56, borderRadius: 16, background: "#2563EB", alignItems: "center", justifyContent: "center", marginRight: 16 }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></svg>
            </div>
            <div style={{ display: "flex", fontSize: 36, fontWeight: 800, letterSpacing: -0.5 }}>OnboardOps</div>
          </div>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 600, color: "#CBD5E1", border: "2px solid rgba(255,255,255,0.18)", borderRadius: 12, padding: "9px 20px", background: "rgba(255,255,255,0.05)" }}>{num}</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 52, background: t.soft, border: `2px solid ${t.accent}`, borderRadius: 26, padding: "20px 28px" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={t.icon} /></svg>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: t.accent, marginLeft: 18, letterSpacing: 1.2, textTransform: "uppercase", whiteSpace: "nowrap" }}>{t.tag}</div>
          </div>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 600, color: "#E2E8F0", whiteSpace: "nowrap", marginLeft: 20 }}>{bannerRight}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 44, fontSize: 124, lineHeight: 1.0, fontWeight: 800, letterSpacing: -4 }}>
          <div style={{ display: "flex" }}>{t.line1}</div>
          <div style={{ display: "flex", color: t.accent }}>{t.line2}</div>
        </div>

        {fp ? (
          <div style={{ display: "flex", alignItems: "center", marginTop: 34, background: "rgba(255,255,255,0.06)", border: "2px solid rgba(255,255,255,0.14)", borderRadius: 24, padding: "26px 30px" }}>
            <div style={{ display: "flex", width: 64, height: 64, borderRadius: 32, background: t.soft, border: `2px solid ${t.accent}`, alignItems: "center", justifyContent: "center", marginRight: 24, flexShrink: 0 }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" /></svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 34, fontWeight: 800 }}>We're sorry for the inconvenience.</div>
              <div style={{ display: "flex", fontSize: 26, lineHeight: 1.35, color: "#CBD5E1", marginTop: 6 }}>Our monitoring flagged a problem that wasn't real. Nothing was wrong, and you don't need to do anything.</div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", fontSize: 34, lineHeight: 1.35, color: "#CBD5E1", marginTop: 30, maxWidth: 920 }}>{title}</div>
        )}

        {services.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 34 }}>
            <div style={{ display: "flex", fontSize: 22, fontWeight: 600, color: "#64748B", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14 }}>{fp ? "Checked and working" : "Affected services"}</div>
            <div style={{ display: "flex", flexWrap: "wrap" }}>
              {services.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.07)", border: "2px solid rgba(255,255,255,0.14)", borderRadius: 14, padding: "10px 20px", marginRight: 12, marginBottom: 12, fontSize: 27, fontWeight: 600 }}>
                  <div style={{ display: "flex", width: 14, height: 14, borderRadius: 7, background: style === "restored" || fp ? "#34D399" : dot(s.status), marginRight: 12 }} />
                  {s.name}
                </div>
              ))}
              {more > 0 && <div style={{ display: "flex", alignItems: "center", fontSize: 26, fontWeight: 600, color: "#94A3B8", padding: "10px 4px" }}>{`+${more} more`}</div>}
            </div>
          </div>
        )}

        <div style={{ display: "flex", flex: 1 }} />
        {detail && <div style={{ display: "flex", fontSize: 24, color: "#94A3B8", marginBottom: 18 }}>{detail}</div>}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "2px solid rgba(255,255,255,0.12)", paddingTop: 22 }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 800 }}>{STATUS_HOST}</div>
          <div style={{ display: "flex", fontSize: 26, color: "#94A3B8" }}>{fp ? "Thank you for your patience" : style === "restored" ? "Thank you for your patience" : style === "maintenance" ? "We'll post when it's finished" : "We'll post the next update here"}</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080, ...(fonts ? { fonts } : {}) },
  );
  return { img, num, style };
}
