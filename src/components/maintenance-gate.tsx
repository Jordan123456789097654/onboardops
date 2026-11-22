"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Megaphone, Wrench, X } from "lucide-react";
import { MaintenanceScreen } from "./maintenance-screen";
import type { AnnouncementState, MaintenanceState } from "@/lib/maintenance";
import { areaFor, areasSentence, fmtLeft, lockedFor } from "@/lib/maintenance-areas";

type Live = Pick<MaintenanceState, "enabled" | "upcoming" | "areas" | "noticeMinutes" | "message" | "eta" | "startsAt" | "endsAt">;

export function MaintenanceGate({
  maintenance: initial,
  announcement,
  isOwner,
  children,
}: {
  maintenance: MaintenanceState;
  announcement: AnnouncementState;
  isOwner: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "/";
  const [live, setLive] = useState<Live>(initial);
  const [skew, setSkew] = useState(0); // server time minus browser time
  const [now, setNow] = useState(() => Date.now());
  const maintenance: MaintenanceState = { ...initial, ...live };
  // Keep the status fresh: slowly normally, quickly when a start or end time is close.
  useEffect(() => {
    let stop = false;
    const pull = async () => {
      try {
        const j = (await (await fetch("/api/maintenance", { cache: "no-store" })).json()) as Live & { now?: number };
        if (stop) return;
        setLive({ enabled: j.enabled, upcoming: j.upcoming, areas: j.areas?.length ? j.areas : initial.areas, noticeMinutes: j.noticeMinutes, message: j.message || initial.message, eta: j.eta, startsAt: j.startsAt, endsAt: j.endsAt });
        if (typeof j.now === "number") setSkew(j.now - Date.now());
      } catch { /* offline: keep what we have */ }
    };
    const near = () => { const t = Date.now() + skew; return [live.startsAt, live.endsAt].some((x) => x && Math.abs(Date.parse(x) - t) < 120000); };
    const id = window.setInterval(() => { if (document.visibilityState === "visible" || near()) pull(); }, 20000);
    const vis = () => { if (document.visibilityState === "visible") pull(); };
    document.addEventListener("visibilitychange", vis);
    pull();
    return () => { stop = true; window.clearInterval(id); document.removeEventListener("visibilitychange", vis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.startsAt, live.endsAt]);
  const ticking = maintenance.upcoming || !!maintenance.endsAt;
  useEffect(() => { if (!ticking) return; const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, [ticking]);
  // When a scheduled start passes, ask the server right away instead of waiting for the next poll.
  useEffect(() => {
    if (!maintenance.upcoming || !maintenance.startsAt) return;
    const t = Date.parse(maintenance.startsAt);
    if (now + skew >= t) fetch("/api/maintenance", { cache: "no-store" }).then((r) => r.json()).then((j: Live) => setLive({ enabled: j.enabled, upcoming: j.upcoming, areas: j.areas, noticeMinutes: j.noticeMinutes, message: j.message, eta: j.eta, startsAt: j.startsAt, endsAt: j.endsAt })).catch(() => {});
  }, [now, skew, maintenance.upcoming, maintenance.startsAt]);
  const locked = lockedFor(maintenance, pathname);
  const [ownerBypass, setOwnerBypass] = useState(false);
  const [previewMnt, setPreviewMnt] = useState(false);
  useEffect(() => { setPreviewMnt(new URLSearchParams(window.location.search).has("preview-maintenance")); }, [pathname]);
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);
  const lastTracked = useRef<string>("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("oo_ann_dismissed");
      if (saved) setDismissedAt(saved);
    } catch {}
  }, []);

  useEffect(() => {
    if (!pathname || pathname === lastTracked.current || pathname.startsWith("/admin")) return;
    lastTracked.current = pathname;
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  const [noticeDismissed, setNoticeDismissed] = useState<string | null>(null);
  useEffect(() => { try { setNoticeDismissed(localStorage.getItem("oo_notice_dismissed")); } catch {} }, []);
  const startMs = maintenance.startsAt ? Date.parse(maintenance.startsAt) : NaN;
  const leftMs = startMs - (now + skew);
  const inNotice = leftMs <= maintenance.noticeMinutes * 60000;
  const affectsHere = maintenance.areas.includes(areaFor(pathname));
  const noticeKey = maintenance.startsAt ?? "";
  const showNotice = maintenance.upcoming && !isNaN(startMs) && leftMs > 0 && affectsHere && !pathname.startsWith("/admin") && !pathname.startsWith("/print") && (inNotice || noticeDismissed !== noticeKey);
  const notice = showNotice ? (
    <div className={`no-print sticky top-0 z-40 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b px-4 py-2 text-xs font-medium backdrop-blur ${inNotice ? "border-amber-400/60 bg-amber-500/20 text-amber-950 dark:text-amber-200" : "border-amber-400/40 bg-amber-500/10 text-amber-950 dark:text-amber-200"}`} role="status">
      <Wrench className="h-3.5 w-3.5 shrink-0" />
      <span>Scheduled maintenance for {areasSentence(maintenance.areas)} starts in <span className="mono font-semibold">{fmtLeft(leftMs)}</span> ({new Date(startMs).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}). Please save your work before then.</span>
      {maintenance.endsAt && <span className="text-soft">Expected back {new Date(maintenance.endsAt).toLocaleString("en-US", { hour: "numeric", minute: "2-digit" })}.</span>}
      {!inNotice && (
        <button type="button" aria-label="Dismiss notice" className="ml-2 rounded p-0.5 opacity-70 hover:opacity-100" onClick={() => { setNoticeDismissed(noticeKey); try { localStorage.setItem("oo_notice_dismissed", noticeKey); } catch {} }}><X className="h-3.5 w-3.5" /></button>
      )}
    </div>
  ) : null;

  const showAnnouncement =
    announcement.enabled &&
    announcement.message.trim().length > 0 &&
    (!announcement.dismissible || dismissedAt !== (announcement.updatedAt ?? "1"));

  const toneClass =
    announcement.tone === "warning"
      ? "border-amber-400/50 bg-amber-500/15 text-amber-950 dark:text-amber-200"
      : announcement.tone === "success"
        ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-950 dark:text-emerald-200"
        : "border-accent/40 bg-accent/10 text-ink";

  const banner = showAnnouncement ? (
    <div className={`no-print sticky top-0 z-40 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b px-4 py-2 text-xs font-medium backdrop-blur ${toneClass}`}>
      <Megaphone className="h-3.5 w-3.5 shrink-0" />
      <span>{announcement.message}</span>
      {announcement.linkUrl && (
        <a
          href={announcement.linkUrl}
          target={announcement.linkUrl.startsWith("http") ? "_blank" : undefined}
          rel={announcement.linkUrl.startsWith("http") ? "noreferrer" : undefined}
          className="font-semibold underline underline-offset-2"
        >
          {announcement.linkLabel || "Learn more"} →
        </a>
      )}
      {announcement.dismissible && (
        <button
          type="button"
          aria-label="Dismiss announcement"
          className="ml-2 rounded p-0.5 opacity-70 hover:opacity-100"
          onClick={() => {
            const stamp = announcement.updatedAt ?? "1";
            setDismissedAt(stamp);
            try {
              localStorage.setItem("oo_ann_dismissed", stamp);
            } catch {}
          }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  ) : null;

  if (!locked && isOwner && previewMnt) {
    const sample: MaintenanceState = { ...maintenance, enabled: true, message: maintenance.message || "We are making improvements and will be back shortly.", eta: maintenance.eta ?? "In about 30 minutes", startsAt: new Date().toISOString() };
    return <MaintenanceScreen m={sample} isOwner={isOwner} onPreview={() => {}} preview />;
  }

  if (!locked && !(maintenance.enabled && isOwner && pathname.startsWith("/admin"))) {
    return (
      <>
        {notice}
        {banner}
        {children}
      </>
    );
  }

  // Always allow the Site Owner to use the /admin Staff Console
  if (isOwner && pathname.startsWith("/admin")) {
    return (
      <>
        <div className="no-print sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 border-b border-amber-400/50 bg-amber-500/15 px-4 py-1.5 text-xs text-amber-950 backdrop-blur dark:text-amber-200">
          <div className="flex items-center gap-2 font-medium">
            <Wrench className="h-3.5 w-3.5 shrink-0" />
            <span>Maintenance mode is ON for {areasSentence(maintenance.areas)}. Visitors there see the lock screen.</span>
          </div>
          <Link href="/" className="mono font-semibold underline">View Maintenance Screen →</Link>
        </div>
        {children}
      </>
    );
  }

  // If the Site Owner explicitly clicked "Preview Site (Owner Bypass)" on the maintenance screen
  if (isOwner && ownerBypass) {
    return (
      <>
        <div className="no-print sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 border-b border-amber-400/50 bg-amber-500/15 px-4 py-1.5 text-xs text-amber-950 backdrop-blur dark:text-amber-200">
          <div className="flex items-center gap-2 font-medium">
            <Wrench className="h-3.5 w-3.5 shrink-0" />
            <span>Owner Preview Mode — Site is locked in Maintenance Mode for everyone else.</span>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setOwnerBypass(false)} className="mono underline">
              Show Lock Screen
            </button>
            <Link href="/admin" className="mono font-semibold underline">Access Admin Panel →</Link>
          </div>
        </div>
        {banner}
        {children}
      </>
    );
  }

  // Allow /login and /magic so a logged-out site owner can sign in
  if (pathname === "/login" || pathname === "/magic") {
    return (
      <>
        <div className="border-b border-amber-400/50 bg-amber-500/15 px-4 py-2 text-center text-xs font-medium text-amber-950 dark:text-amber-200">
          OnboardOps is currently in maintenance mode. Site owner sign-in only.
        </div>
        {children}
      </>
    );
  }

  // Show the maintenance screen
  return <MaintenanceScreen m={maintenance} isOwner={isOwner} onPreview={() => setOwnerBypass(true)} />;
}
