import { ImageResponse } from "next/og";

export const alt = "OnboardOps: staff records, discipline and training in one place";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0f172a", color: "#f8fafc", padding: 72 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 36, fontWeight: 700 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "#1d4ed8", display: "flex" }} />
          OnboardOps
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.08, maxWidth: 980 }}>Staff records, discipline and training in one place.</div>
          <div style={{ fontSize: 30, color: "#94a3b8" }}>For shift-based teams. Free during the beta.</div>
        </div>
        <div style={{ fontSize: 26, color: "#64748b" }}>onboardops.org</div>
      </div>
    ),
    size,
  );
}
