"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const BAKED = process.env.NEXT_PUBLIC_BUILD_ID ?? "local";
const SECONDS = 7;
const STEPS = ["New version found", "Loading the new files", "Reloading"];

/** Gear outline with trapezoid teeth. Drawn as a line, not filled. */
function gearPath(teeth: number, rOuter: number, rRoot: number, phase = 0) {
  const a = (Math.PI * 2) / teeth;
  const p = (ang: number, r: number) => `${(Math.cos(ang) * r).toFixed(2)},${(Math.sin(ang) * r).toFixed(2)}`;
  const pts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const t = phase + i * a;
    pts.push(p(t - a * 0.36, rRoot), p(t - a * 0.2, rOuter), p(t + a * 0.2, rOuter), p(t + a * 0.36, rRoot));
  }
  return `M ${pts.join(" L ")} Z`;
}

// Two gears that really mesh: centres are the sum of the pitch radii apart, and the second is half a tooth out of phase.
const M = 3.6, N1 = 14, N2 = 9;
const R1 = (N1 * M) / 2, R2 = (N2 * M) / 2;
const G1 = gearPath(N1, R1 + 3, R1 - 3);
const G2 = gearPath(N2, R2 + 3, R2 - 3, Math.PI + Math.PI / N2);
const ANG = (-30 * Math.PI) / 180;
const C1 = { x: 36, y: 62 };
const C2 = { x: C1.x + Math.cos(ANG) * (R1 + R2), y: C1.y + Math.sin(ANG) * (R1 + R2) };

export function UpdateOverlay() {
  const path = usePathname();
  const [mode, setMode] = useState<"off" | "reload" | "preview">("off");
  const [t, setT] = useState(0);
  const [news, setNews] = useState("");
  const [bullets, setBullets] = useState<string[]>([]);
  // A newer version is waiting. We show a bar and only reload once the person is idle with nothing unsaved.
  const [pending, setPending] = useState<{ version: string; news: string; bullets: string[] } | null>(null);
  const [snoozeUntil, setSnoozeUntil] = useState(0);
  const [dirty, setDirty] = useState(false);
  const lastAct = useRef(Date.now());
  const running = useRef(false);
  const noPrint = !path?.startsWith("/print");

  const start = useCallback((m: "reload" | "preview") => {
    if (running.current) return;
    running.current = true;
    setT(0);
    setNews("");
    setBullets([]);
    setMode(m);
    fetch("/api/version", { cache: "no-store" }).then((r) => r.json()).then((j: { whatsNew?: string; bullets?: string[] }) => { setNews(j.whatsNew ?? ""); setBullets(j.bullets ?? []); }).catch(() => {});
    document.body.style.overflow = "hidden";
    const began = Date.now();
    const tick = window.setInterval(() => setT(Math.min(SECONDS, (Date.now() - began) / 1000)), 80);
    window.setTimeout(() => {
      window.clearInterval(tick);
      if (m === "reload") { window.location.reload(); return; }
      document.body.style.overflow = "";
      running.current = false;
      setMode("off");
      const u = new URL(window.location.href);
      u.searchParams.delete("preview-update");
      window.history.replaceState(null, "", u.pathname + u.search + u.hash);
    }, SECONDS * 1000);
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.has("preview-update")) start("preview");
    if (q.has("preview-update-bar")) setPending({ version: "preview", news: "Stronger encryption and new tools", bullets: ["Sensitive records are encrypted with a key for each workspace", "A What's new button in the app"] });
    const onEvent = () => { if (!window.location.pathname.startsWith("/print")) start("reload"); };
    window.addEventListener("oo:update", onEvent);
    if (process.env.NODE_ENV !== "production" || !noPrint) return () => window.removeEventListener("oo:update", onEvent);

    let busy = false;
    type V = { id?: string; version?: string; whatsNew?: string; bullets?: string[]; required?: boolean };
    const read = async (): Promise<V | null> => {
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        return (await r.json()) as V;
      } catch { return null; }
    };
    const check = async () => {
      if (busy || running.current || document.visibilityState === "hidden") return;
      busy = true;
      const v = await read();
      if (v?.id && v.id !== BAKED) {
        // Confirm once, so a deploy that is still rolling out does not flicker.
        await new Promise((res) => setTimeout(res, 3000));
        const again = await read();
        if (again?.id && again.id !== BAKED) {
          if (again.required) start("reload");
          else setPending({ version: again.version ?? "", news: again.whatsNew ?? "", bullets: again.bullets ?? [] });
        }
      }
      busy = false;
    };
    const timer = window.setInterval(check, 60000);
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", check);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("online", check); window.removeEventListener("oo:update", onEvent); };
  }, [start, noPrint]);

  // Track whether the person is active and whether a form has unsaved typing.
  useEffect(() => {
    const act = () => { lastAct.current = Date.now(); };
    const edit = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.matches?.("input, textarea, select") || t.isContentEditable)) setDirty(true);
    };
    const sent = () => window.setTimeout(() => setDirty(false), 1500);
    for (const ev of ["keydown", "pointerdown", "touchstart", "wheel", "scroll"]) window.addEventListener(ev, act, { passive: true, capture: true });
    document.addEventListener("input", edit, true);
    document.addEventListener("submit", sent, true);
    return () => {
      for (const ev of ["keydown", "pointerdown", "touchstart", "wheel", "scroll"]) window.removeEventListener(ev, act, { capture: true } as EventListenerOptions);
      document.removeEventListener("input", edit, true);
      document.removeEventListener("submit", sent, true);
    };
  }, []);
  useEffect(() => { setDirty(false); }, [path]);
  // Apply the waiting update when the person has been idle for 30 seconds with nothing unsaved.
  useEffect(() => {
    if (!pending || pending.version === "preview" || !noPrint) return;
    const id = window.setInterval(() => {
      if (running.current || dirty || Date.now() < snoozeUntil) return;
      if (Date.now() - lastAct.current >= 30000) start("reload");
    }, 5000);
    return () => window.clearInterval(id);
  }, [pending, dirty, snoozeUntil, start, noPrint]);

  if (mode === "off") {
    if (!pending || !noPrint || Date.now() < snoozeUntil) return null;
    return (
      <div role="status" aria-live="polite" className="no-print fixed bottom-4 right-4 z-[9990] w-[min(92vw,360px)] rounded-lg border border-line bg-surface p-4 shadow-lg">
        <div className="flex items-center gap-2"><span className="h-2 w-2 bg-accent" aria-hidden /><span className="text-sm font-semibold">A new version is ready</span>{pending.version && pending.version !== "preview" && <span className="mono ml-auto text-[11px] text-soft">v{pending.version}</span>}</div>
        {pending.bullets.length > 0 ? (
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[13px] text-soft">{pending.bullets.slice(0, 2).map((b) => <li key={b}>{b}</li>)}</ul>
        ) : pending.news ? <p className="mt-2 text-[13px] text-soft">{pending.news}.</p> : null}
        <p className="mt-2 text-[12px] text-soft">{dirty ? "You have unsaved changes, so we will wait. Update when you are done." : "This page updates on its own when you stop for a moment."}</p>
        <div className="mt-3 flex items-center gap-2">
          <button type="button" className="btn-primary !h-8 !text-xs" onClick={() => { if (pending.version === "preview") { setPending(null); return; } start("reload"); }}>Update now</button>
          <button type="button" className="btn !h-8 !text-xs" onClick={() => setSnoozeUntil(Date.now() + 15 * 60000)}>Later</button>
          <a href="/changelog" className="ml-auto text-[12px] text-accent underline underline-offset-2" target="_blank" rel="noopener noreferrer">What&apos;s new</a>
        </div>
      </div>
    );
  }
  const frac = t / SECONDS;
  const pct = Math.round(frac * 100);
  const stepLen = SECONDS / STEPS.length;
  const state = (i: number) => (t >= (i + 1) * stepLen - 0.1 ? "done" : t >= i * stepLen ? "active" : "wait");
  const spin = (s: number, reverse = false): React.CSSProperties => ({ animation: `oo-spin ${s}s linear infinite ${reverse ? "reverse" : ""}`, transformBox: "fill-box", transformOrigin: "center" });

  return (
    <div role="alertdialog" aria-live="polite" aria-label="Updating OnboardOps" className="oo-upd fixed inset-0 z-[9999] flex items-center justify-center bg-black p-4 text-ink">
      <style>{`
        @keyframes oo-spin{to{transform:rotate(360deg)}}
        @keyframes oo-in{from{opacity:0}to{opacity:1}}
        @keyframes oo-blink{50%{opacity:.25}}
        .oo-upd .panel{animation:oo-in .25s ease both}
        .oo-upd .live{animation:oo-blink 1.1s steps(1) infinite}
        @media (prefers-reduced-motion: reduce){ .oo-upd *{animation:none!important} }
      `}</style>

      <div className="panel w-full max-w-[520px] overflow-hidden rounded-lg border border-line bg-surface">
        <div className="flex items-center gap-2.5 border-b border-line px-5 py-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent" aria-hidden>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="rgb(var(--accent-fg))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </span>
          <span className="text-sm font-semibold tracking-tightest">OnboardOps</span>
          <span className="mono ml-auto flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-soft"><i className="live block h-1.5 w-1.5 bg-accent" />{mode === "preview" ? "Preview" : "Updating"}</span>
        </div>

        <div className="px-5 pb-5 pt-6 sm:px-6">
          <h2 className="text-[22px] font-semibold leading-snug tracking-tightest sm:text-2xl">Please wait while we update OnboardOps</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-soft">{mode === "preview" ? "This is only a preview. Nothing is being updated." : "A new version is live. This page will refresh on its own in a few seconds."}</p>

          <div className="mt-5 flex items-center gap-4 rounded-md border border-line bg-muted px-4 py-3">
            <svg viewBox="0 0 90 100" className="h-[84px] w-[76px] shrink-0 text-ink" role="img" aria-label="Two gears turning">
              <g transform={`translate(${C1.x} ${C1.y})`}><g style={spin(12)}><path d={G1} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><circle r="6" fill="none" stroke="currentColor" strokeWidth="1.6" /></g></g>
              <g transform={`translate(${C2.x.toFixed(2)} ${C2.y.toFixed(2)})`}><g style={spin((12 * N2) / N1, true)}><path d={G2} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><circle r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" /></g></g>
            </svg>
            <div className="min-w-0 flex-1">
              <div className="mono text-[11px] uppercase tracking-wider text-soft">What&apos;s new</div>
              {bullets.length > 0 ? (
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[13px] leading-snug">{bullets.slice(0, 3).map((b) => <li key={b}>{b}</li>)}</ul>
              ) : (
                <div className="mt-1 text-[13px] leading-snug">{news ? `New: ${news.charAt(0).toLowerCase()}${news.slice(1)}.` : "Loading the details of this update."}</div>
              )}
              <a href="/changelog" target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[12px] text-accent underline underline-offset-2">See the full changelog</a>
            </div>
          </div>

          <ul className="mono mt-5 space-y-2 text-[12.5px]">
            {STEPS.map((s, i) => {
              const st = state(i);
              return (
                <li key={s} className="flex items-center gap-3" style={{ opacity: st === "wait" ? 0.45 : 1 }}>
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {st === "done" && <span className="flex h-4 w-4 items-center justify-center bg-accent" aria-label="done"><svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="rgb(var(--accent-fg))" strokeWidth="3.4" strokeLinecap="square" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>}
                    {st === "active" && <span className="h-3.5 w-3.5 rounded-full border-2 border-line border-t-accent" style={{ animation: "oo-spin .8s linear infinite" }} aria-label="in progress" />}
                    {st === "wait" && <span className="h-3.5 w-3.5 border border-line" aria-label="waiting" />}
                  </span>
                  <span className={st === "wait" ? "text-soft" : "text-ink"}>{s}</span>
                  <span className="ml-auto text-[11px] text-soft">{st === "done" ? `${Math.min((i + 1) * stepLen, t).toFixed(1)}s` : ""}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="h-[3px] bg-line"><div className="h-full bg-accent" style={{ width: `${pct}%`, transition: "width .1s linear" }} /></div>
        <div className="mono flex items-center justify-between px-5 py-2.5 text-[11px] text-soft"><span>Refreshing on its own</span><span>{t.toFixed(1)}s / {SECONDS}.0s</span></div>
      </div>
    </div>
  );
}
