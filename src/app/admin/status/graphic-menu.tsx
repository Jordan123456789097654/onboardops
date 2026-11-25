"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Download } from "lucide-react";
import type { BsReport } from "@/lib/betterstack";
import { MENU_ORDER, STYLE_INFO, autoStyle, type Style } from "@/lib/incident-style";

/** Download a status graphic for one incident. It picks the style that fits; staff can choose another from the menu. */
export function GraphicMenu({ report }: { report: Pick<BsReport, "id" | "endsAt" | "state" | "type" | "affected"> }) {
  const auto = autoStyle(report);
  const [pick, setPick] = useState<Style | "auto">("auto");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const shown = pick === "auto" ? auto : pick;
  const info = STYLE_INFO[shown];
  const href = `/api/admin/incident-graphic?id=${encodeURIComponent(report.id)}${pick === "auto" ? "" : `&style=${pick}`}`;

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const choose = (v: Style | "auto") => { setPick(v); setOpen(false); };
  const row = "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] hover:bg-muted";

  return (
    <div ref={box} className="relative inline-flex">
      <div className="inline-flex h-8 items-stretch overflow-hidden rounded-md border border-line bg-surface text-xs">
        <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 px-2.5 hover:bg-muted">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: info.color }} />
          <span className="font-medium">{info.label}</span>
          {pick === "auto" && <span className="text-soft">auto</span>}
          <ChevronDown className={`h-3.5 w-3.5 text-soft transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        <a href={href} download className="flex items-center gap-1.5 border-l border-line px-3 font-medium hover:bg-muted"><Download className="h-3.5 w-3.5" />Graphic</a>
      </div>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-xl">
          <button type="button" role="menuitem" className={row} onClick={() => choose("auto")}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STYLE_INFO[auto].color }} />
            <span className="flex-1"><span className="block font-medium">Automatic</span><span className="block text-xs text-soft">Suggests {STYLE_INFO[auto].label.toLowerCase()}</span></span>
            {pick === "auto" && <Check className="h-3.5 w-3.5" />}
          </button>
          <div className="my-1 border-t border-line" />
          {MENU_ORDER.map((s) => (
            <button key={s} type="button" role="menuitem" className={row} onClick={() => choose(s)}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STYLE_INFO[s].color }} />
              <span className="flex-1"><span className="block font-medium">{STYLE_INFO[s].label}</span><span className="block text-xs text-soft">{STYLE_INFO[s].desc}</span></span>
              {pick === s && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
