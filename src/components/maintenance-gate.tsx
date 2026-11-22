"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Eye, Megaphone, ShieldAlert, ShieldCheck, Wrench, X } from "lucide-react";
import { Brand, ThemeToggle } from "./ui";
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

  // Show the Maintenance Lock Screen
  return (
    <div className="flex min-h-screen flex-col justify-between bg-canvas px-4 py-6 text-ink">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between">
        <Brand />
        <div className="flex items-center gap-2">
          {isOwner && (
            <Link href="/admin" className="btn-primary !h-8 !text-xs">
              <ShieldCheck className="h-3.5 w-3.5" />
              Access Admin Panel
            </Link>
          )}
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto my-auto max-w-lg py-16 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Wrench className="h-6 w-6" />
        </div>
        <div className="mono inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-amber-700 dark:text-amber-300">
          <ShieldAlert className="h-3.5 w-3.5" />
          Website in Maintenance
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">We&apos;ll be right back</h1>
        <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-soft">
          {maintenance.message}
        </p>
        {maintenance.eta && (
          <div className="card mx-auto mt-5 inline-block px-4 py-2 text-xs">
            <span className="text-soft">Estimated return: </span>
            <span className="mono font-semibold text-ink">{maintenance.eta}</span>
          </div>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            Check again
          </button>
        </div>

        {isOwner && (
          <div className="card mx-auto mt-8 max-w-md border-accent/40 bg-surface p-4 text-left shadow-md">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
              <ShieldCheck className="h-4 w-4" />
              Site Owner Controls (Visible Only to You)
            </div>
            <p className="mt-1 text-xs text-soft">
              You are viewing the live maintenance screen that visitors and customers currently see.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/admin" className="btn-primary flex-1 justify-center">
                <ShieldCheck className="h-3.5 w-3.5" />
                Access Admin Panel
              </Link>
              <button type="button" className="btn" onClick={() => setOwnerBypass(true)}>
                <Eye className="h-3.5 w-3.5" />
                Preview Site
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="mx-auto flex w-full max-w-4xl items-center justify-between border-t border-line pt-4 text-xs text-soft">
        <span>OnboardOps</span>
        {isOwner ? (
          <Link href="/admin" className="font-medium text-accent underline">Open Staff Console (/admin)</Link>
        ) : (
          <Link href="/login" className="hover:text-ink underline">Site owner sign in</Link>
        )}
      </footer>
    </div>
  );
}
