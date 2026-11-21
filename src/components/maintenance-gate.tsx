"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert, Wrench } from "lucide-react";
import { Brand, ThemeToggle } from "./ui";
import type { MaintenanceState } from "@/lib/maintenance";

export function MaintenanceGate({
  maintenance,
  isOwner,
  children,
}: {
  maintenance: MaintenanceState;
  isOwner: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "/";

  if (!maintenance.enabled) {
    return <>{children}</>;
  }

  // Site owners can browse and use the entire website while maintenance mode is on
  if (isOwner) {
    return (
      <>
        <div className="no-print sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 border-b border-amber-400/50 bg-amber-500/15 px-4 py-1.5 text-xs text-amber-950 backdrop-blur dark:text-amber-200">
          <div className="flex items-center gap-2 font-medium">
            <Wrench className="h-3.5 w-3.5 shrink-0" />
            <span>Maintenance Mode is ACTIVE — The entire website is locked for visitors and customers. You have full access as Site Owner.</span>
          </div>
          <Link href="/admin" className="mono underline font-semibold">Manage in Staff Console →</Link>
        </div>
        {children}
      </>
    );
  }

  // Allow /login and /magic so a logged-out site owner can sign in to turn off maintenance
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

  // Lock the entire website for everyone else
  return (
    <div className="flex min-h-screen flex-col justify-between bg-canvas px-4 py-6 text-ink">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between">
        <Brand />
        <ThemeToggle />
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
        <div className="mt-6 flex items-center justify-center gap-3">
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            Check again
          </button>
        </div>
      </main>

      <footer className="mx-auto flex w-full max-w-4xl items-center justify-between border-t border-line pt-4 text-xs text-soft">
        <span>OnboardOps</span>
        <Link href="/login" className="hover:text-ink underline">Site owner sign in</Link>
      </footer>
    </div>
  );
}
