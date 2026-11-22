"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Megaphone, Wrench, X } from "lucide-react";
import { MaintenanceScreen } from "./maintenance-screen";
import type { AnnouncementState, MaintenanceState } from "@/lib/maintenance";

export function MaintenanceGate({
  maintenance,
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

  if (!maintenance.enabled && isOwner && previewMnt) {
    const sample: MaintenanceState = { ...maintenance, enabled: true, message: maintenance.message || "We are making improvements and will be back shortly.", eta: maintenance.eta ?? "In about 30 minutes", startsAt: new Date().toISOString() };
    return <MaintenanceScreen m={sample} isOwner={isOwner} onPreview={() => {}} preview />;
  }

  if (!maintenance.enabled) {
    return (
      <>
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
            <span>Maintenance Mode is ACTIVE — Visitors and customers see the maintenance lock screen.</span>
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
