"use client";
import { useState } from "react";
import { Download } from "lucide-react";

const OPTIONS = [["auto", "Automatic"], ["degraded", "Degraded"], ["outage", "Outage"], ["restored", "Restored"], ["maintenance", "Maintenance"]] as const;

/** Download a status graphic for one incident. The style defaults to whatever fits the incident; staff can force another. */
export function GraphicMenu({ id }: { id: string }) {
  const [style, setStyle] = useState<string>("auto");
  const href = `/api/admin/incident-graphic?id=${encodeURIComponent(id)}${style === "auto" ? "" : `&style=${style}`}`;
  return (
    <div className="flex items-center gap-1.5">
      <select className="input !h-8 !w-auto !py-0 text-xs" value={style} onChange={(e) => setStyle(e.target.value)} aria-label="Graphic style">
        {OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <a className="btn !h-8 text-xs" href={href} download><Download className="h-3.5 w-3.5" />Graphic</a>
    </div>
  );
}
