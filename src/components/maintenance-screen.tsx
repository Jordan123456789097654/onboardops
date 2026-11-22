"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Brand, ThemeToggle } from "./ui";
import type { MaintenanceState } from "@/lib/maintenance";
import { ALL_AREAS, areasSentence, fmtLeft, lockedFor } from "@/lib/maintenance-areas";

const EVERY = 30;
const fmt = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

/** The page everyone sees while the site is in maintenance mode. Checks on its own and reloads when the site is back. */
export function MaintenanceScreen({ m, isOwner, onPreview, preview }: { m: MaintenanceState; isOwner: boolean; onPreview: () => void; preview?: boolean }) {
  const [left, setLeft] = useState(EVERY);
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const r = await fetch("/api/maintenance", { cache: "no-store" });
      const j = (await r.json()) as { enabled?: boolean; areas?: MaintenanceState["areas"] };
      setLastCheck(new Date());
      if (!preview && !lockedFor({ enabled: j.enabled !== false, areas: j.areas?.length ? j.areas : ALL_AREAS }, window.location.pathname)) { window.location.reload(); return; }
    } catch { /* offline: try again later */ }
    setChecking(false);
    setLeft(EVERY);
  }, [preview]);

  useEffect(() => {
    const t = window.setInterval(() => setLeft((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => { if (left === 0 && !checking) check(); }, [left, checking, check]);

  const [now, setNow] = useState(() => Date.now());
  const endMs = m.endsAt ? Date.parse(m.endsAt) : NaN;
  const counting = !isNaN(endMs) && endMs > now;
  useEffect(() => { if (!counting) return; const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, [counting]);
  const partial = m.areas.length < ALL_AREAS.length;
  const started = fmt(m.startsAt ?? m.updatedAt);
  const back = m.eta || fmt(m.endsAt) || "To be announced";
  const rows: [string, string][] = [
    ["Status", "Maintenance in progress"],
    ...(started ? ([["Started", started]] as [string, string][]) : []),
    ["Expected back", back],
    ...(counting ? ([["Back in", fmtLeft(endMs - now)]] as [string, string][]) : []),
    ["Last checked", lastCheck ? lastCheck.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" }) : "Just now"],
  ];

  return (
    <div className="oo-mnt fixed inset-0 z-[9998] flex flex-col overflow-y-auto bg-black px-4 py-6 text-ink">
      <style>{`
        @keyframes oo-blink{50%{opacity:.25}}
        @keyframes oo-in{from{opacity:0}to{opacity:1}}
        .oo-mnt .panel{animation:oo-in .25s ease both}
        .oo-mnt .live{animation:oo-blink 1.4s steps(1) infinite}
        @media (prefers-reduced-motion: reduce){ .oo-mnt *{animation:none!important} }
      `}</style>

      <div className="mx-auto flex w-full max-w-[560px] items-center justify-between text-white">
        <Link href="/" aria-label="OnboardOps home"><Brand /></Link>
        <div className="flex items-center gap-2">
          {isOwner && !preview && <Link href="/admin" className="btn !h-8 !text-xs">Staff console</Link>}
          {isOwner && !preview && <button type="button" className="btn !h-8 !text-xs" onClick={onPreview}>Preview site</button>}
          {preview && <Link href="/admin/maintenance" className="btn !h-8 !text-xs">Back to settings</Link>}
          <ThemeToggle />
        </div>
      </div>

      <main className="mx-auto my-auto w-full max-w-[560px] py-10">
        <div className="panel overflow-hidden rounded-lg border border-line bg-surface">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3">
            <i className="live block h-2 w-2 bg-amber-500" aria-hidden />
            <span className="mono text-[11px] uppercase tracking-wider text-soft">{preview ? "Maintenance (preview)" : "Maintenance"}</span>
            <span className="mono ml-auto text-[11px] text-soft">{checking ? "Checking..." : `Next check in ${left}s`}</span>
          </div>

          <div className="px-5 pb-6 pt-6 sm:px-7">
            <h1 className="text-[26px] font-semibold leading-tight tracking-tightest sm:text-3xl">{partial ? `We are updating ${areasSentence(m.areas)}` : "We are updating OnboardOps"}</h1>
            <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-soft">{m.message}</p>
            {partial && <p className="mt-2 text-[13px] text-soft">The rest of OnboardOps is still available.</p>}

            <dl className="mono mt-6 divide-y divide-line rounded-md border border-line text-[12.5px]">
              {rows.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 px-3.5 py-2.5"><dt className="text-soft">{k}</dt><dd className="text-right text-ink">{v}</dd></div>
              ))}
            </dl>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button type="button" className="btn-primary" onClick={check} disabled={checking}>{checking ? "Checking..." : "Check now"}</button>
              <span className="text-[13px] text-soft">This page reloads on its own when we are back.</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3 text-[12px] text-soft">
            <span>Need help? <Link className="text-accent underline underline-offset-2" href="/contact">Contact us</Link></span>
            <span className="flex gap-3"><a className="underline underline-offset-2 hover:text-ink" href="https://status.onboardops.org" target="_blank" rel="noopener noreferrer">System status</a>{!isOwner && <Link className="underline underline-offset-2 hover:text-ink" href="/login">Owner sign in</Link>}</span>
          </div>
        </div>
      </main>
    </div>
  );
}
