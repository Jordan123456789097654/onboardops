"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink, RefreshCw, ShieldAlert } from "lucide-react";
import type { OutageView } from "@/lib/incidents";

export type { OutageView };

const LABEL: Record<string, string> = {
  frontend: "Website",
  database: "Database",
  auth: "Sign-in",
  api: "Core API",
  email: "Email",
  storage: "File storage",
  domains: "Domains",
  public_api: "Public API",
};

const OPEN_PATHS = ["/admin", "/login", "/magic"];

function fmtLeft(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function fmtAgo(iso: string, nowMs: number) {
  const s = Math.max(0, Math.floor((nowMs - Date.parse(iso)) / 1000));
  if (isNaN(s) || s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return `${m}m ago`;
}

function fmtStamp(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function OutageGate({ outage: initial, isOwner = false, children }: { outage: OutageView; isOwner?: boolean; children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const [live, setLive] = useState<OutageView>(initial);
  const [now, setNow] = useState(() => Date.now());
  const [checking, setChecking] = useState(false);
  const [ownerBypass, setOwnerBypass] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [previewOutage, setPreviewOutage] = useState(false);

  useEffect(() => {
    setLive(initial);
  }, [initial]);

  useEffect(() => {
    setPreviewOutage(new URLSearchParams(window.location.search).has("preview-outage"));
  }, [pathname]);

  const pull = useCallback(async (force = false) => {
    if (force) setChecking(true);
    try {
      const r = await fetch(force ? "/api/incidents?refresh=1" : "/api/incidents", { cache: "no-store" });
      if (!r.ok) return;
      const next = (await r.json()) as OutageView;
      setLive(next);
    } catch {
      // keep current state when offline
    } finally {
      if (force) setChecking(false);
    }
  }, []);

  // Poll /api/incidents so already-open tabs react automatically when an outage starts, updates, or clears.
  useEffect(() => {
    const intervalMs = live.active ? 20_000 : 60_000;
    const id = window.setInterval(() => {
      if (live.active || document.visibilityState === "visible") pull(false);
    }, intervalMs);
    const vis = () => {
      if (document.visibilityState === "visible") pull(false);
    };
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [live.active, pull]);

  const endMs = live.until ? Date.parse(live.until) : NaN;
  useEffect(() => {
    if (!live.active) return;
    const id = window.setInterval(() => {
      setNow(Date.now());
      if (!isNaN(endMs) && Date.now() >= endMs) pull(true);
    }, 1000);
    return () => window.clearInterval(id);
  }, [live.active, endMs, pull]);

  const openPath = OPEN_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  // Allow owner to preview the outage screen via /?preview-outage=1
  const view: OutageView =
    !live.active && isOwner && previewOutage
      ? {
          active: true,
          mode: "lock",
          overrideMode: live.overrideMode,
          simulated: true,
          services: ["database", "api"],
          until: null,
          checkedAt: new Date().toISOString(),
          incidents: [
            {
              id: "preview",
              name: "Preview: Core API and Database disruption",
              cause: "This is a staff-only preview of the outage screen. Real services are operational.",
              startedAt: new Date().toISOString(),
              status: "downtime",
              affected: [
                { name: "Database", status: "downtime" },
                { name: "Core API", status: "downtime" },
              ],
              updates: [
                { id: "u1", message: "Our engineering team is investigating elevated error rates across Core API and Database connections. No workspace data has been affected.", publishedAt: new Date().toISOString() },
              ],
            },
          ],
          components: [
            { service: "frontend", status: "up", ok: true, latencyMs: 5, message: "Next.js App Router frontend and SSR operational", timestamp: new Date().toISOString() },
            { service: "database", status: "down", ok: false, latencyMs: 0, message: "External monitor reported service downtime", timestamp: new Date().toISOString() },
            { service: "api", status: "down", ok: false, latencyMs: 0, message: "External monitor reported service downtime", timestamp: new Date().toISOString() },
            { service: "auth", status: "degraded", ok: true, latencyMs: 0, message: "External monitor reported degraded performance", timestamp: new Date().toISOString() },
          ],
        }
      : live;

  // No active outage
  if (!view.active || view.mode === "none") {
    return <>{children}</>;
  }

  // Staff Console banner while an outage is active for visitors
  if (isOwner && pathname.startsWith("/admin")) {
    return (
      <>
        <div className="no-print sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 border-b border-rose-400/50 bg-rose-500/15 px-4 py-1.5 text-xs text-rose-950 backdrop-blur dark:text-rose-200">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>
              Outage {view.mode === "lock" ? "lock screen" : "banner"} is LIVE for visitors
              {view.incidents[0]?.name ? ` — ${view.incidents[0].name}` : ""}.
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin/status" className="mono font-semibold underline">Manage Status</Link>
            <Link href="/" className="mono font-semibold underline">View Outage Screen →</Link>
          </div>
        </div>
        {children}
      </>
    );
  }

  // Never block /login or /magic (so site owner can still sign in to reach /admin)
  if (openPath) return <>{children}</>;

  // Non-blocking sticky banner for degraded performance or non-core partial outages (or when owner set overrideMode="banner")
  if (view.mode === "banner") {
    const primary = view.incidents[0];
    const hasDowntime = view.incidents.some((i) => i.status === "downtime" || i.status === "down") || view.components.some((c) => c.status === "down");
    const affectedNames = view.components.filter((c) => c.status === "down" || c.status === "degraded").map((c) => LABEL[c.service] ?? c.service);
    const updates = view.incidents.flatMap((i) => i.updates ?? []).slice(0, 4);
    return (
      <>
        <div
          role="status"
          className={`no-print sticky top-0 z-40 border-b px-4 py-2 text-xs backdrop-blur ${
            hasDowntime
              ? "border-rose-400/60 bg-rose-500/15 text-rose-950 dark:text-rose-100"
              : "border-amber-400/60 bg-amber-500/15 text-amber-950 dark:text-amber-100"
          }`}
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 font-medium">
              <span className={`h-2 w-2 shrink-0 rounded-full ${hasDowntime ? "bg-rose-500 animate-pulse" : "bg-amber-500 animate-pulse"}`} />
              <span className="truncate">
                {primary?.name ?? "Partial service disruption"}
                {affectedNames.length > 0 ? ` · Affected: ${affectedNames.join(", ")}` : ""}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {(updates.length > 0 || view.components.length > 0) && (
                <button type="button" onClick={() => setBannerOpen((o) => !o)} className="inline-flex items-center gap-1 font-semibold underline underline-offset-2">
                  {bannerOpen ? "Hide details" : "Details & updates"}
                  {bannerOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              )}
              <a href="https://status.onboardops.org" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold underline underline-offset-2">
                status.onboardops.org <ExternalLink className="h-3 w-3" />
              </a>
              {isOwner && (
                <Link href="/admin/status" className="mono font-semibold underline underline-offset-2">
                  Admin →
                </Link>
              )}
            </div>
          </div>
          {bannerOpen && (
            <div className="mx-auto mt-2.5 max-w-6xl space-y-2 border-t border-current/15 pt-2.5 text-xs">
              {updates.length > 0 ? (
                <div className="space-y-1.5">
                  {updates.map((u) => (
                    <div key={u.id} className="rounded bg-white/60 px-3 py-2 text-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-200">
                      {u.publishedAt && <div className="mono mb-0.5 text-[10px] text-zinc-500">{fmtStamp(u.publishedAt)}</div>}
                      <p className="whitespace-pre-line">{u.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                primary?.cause && <p className="opacity-90">{primary.cause}</p>
              )}
            </div>
          )}
        </div>
        {children}
      </>
    );
  }

  // Owner Bypass mode on full-screen outage lock
  if (isOwner && ownerBypass) {
    return (
      <>
        <div className="no-print sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 border-b border-rose-400/50 bg-rose-500/15 px-4 py-1.5 text-xs text-rose-950 backdrop-blur dark:text-rose-200">
          <div className="flex items-center gap-2 font-medium">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
            <span>Owner Bypass Mode — Outage screen is active for everyone else.</span>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setOwnerBypass(false)} className="mono underline">
              Show Outage Screen
            </button>
            <Link href="/admin/status" className="mono font-semibold underline">Manage Status →</Link>
          </div>
        </div>
        {children}
      </>
    );
  }

  // Full-screen outage page (major / core downtime or outage test)
  const left = isNaN(endMs) ? null : fmtLeft(endMs - now);
  const rank = (s: string) => (s === "down" ? 0 : s === "degraded" ? 1 : s === "maintenance" ? 2 : 3);
  const sortedComponents = [...view.components].sort((a, b) => rank(a.status) - rank(b.status));
  const downCount = sortedComponents.filter((c) => c.status === "down").length;
  const degradedCount = sortedComponents.filter((c) => c.status === "degraded").length;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col overflow-y-auto bg-white px-4 py-8 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
            <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
            OnboardOps Status
          </p>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>Checked {fmtAgo(view.checkedAt, now)}</span>
            <button
              type="button"
              onClick={() => pull(true)}
              disabled={checking}
              className="inline-flex items-center gap-1 rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <RefreshCw className={`h-3 w-3 ${checking ? "animate-spin" : ""}`} />
              Check now
            </button>
          </div>
        </div>

        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">We are experiencing issues</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Some core OnboardOps services are currently unavailable. Your workspace data is safe and unaffected. Our team is investigating and this page will restore automatically once service returns.
        </p>

        {left && (
          <p className="mt-3 text-sm">
            Expected back in <span className="font-mono font-semibold">{left}</span>.
          </p>
        )}

        {/* Active incidents & live Better Stack timeline */}
        {view.incidents.length > 0 && (
          <div className="mt-5 space-y-3">
            {view.incidents.map((inc) => (
              <div key={inc.id} className="rounded-lg border border-red-300/70 bg-red-50/70 p-4 text-sm dark:border-red-900/80 dark:bg-red-950/35">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">{inc.name}</p>
                    <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                      {inc.startedAt ? `Started ${fmtStamp(inc.startedAt)}` : "Active incident"}
                      {inc.affected && inc.affected.length > 0 ? ` · ${inc.affected.length} service${inc.affected.length === 1 ? "" : "s"} affected` : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-red-600/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
                    {inc.status === "degraded" ? "Degraded" : "Investigating"}
                  </span>
                </div>

                {inc.updates && inc.updates.length > 0 ? (
                  <ol className="mt-3 space-y-2.5 border-t border-red-200/80 pt-3 dark:border-red-900/60">
                    {inc.updates.map((u, idx) => (
                      <li key={u.id} className="relative pl-4 text-xs">
                        <span className={`absolute left-0 top-1.5 h-2 w-2 rounded-full ${idx === 0 ? "bg-red-600" : "bg-zinc-400 dark:bg-zinc-600"}`} />
                        {u.publishedAt && <div className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{fmtStamp(u.publishedAt)}</div>}
                        <p className="mt-0.5 whitespace-pre-line leading-relaxed text-zinc-800 dark:text-zinc-200">{u.message}</p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  inc.cause && <p className="mt-2 text-xs text-zinc-700 dark:text-zinc-300">{inc.cause}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Merged Component Status (Better Stack + Live Health Probes) */}
        {sortedComponents.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wide text-zinc-500">Service status</span>
              <span className="text-zinc-500">
                {downCount > 0 ? `${downCount} down` : ""}
                {downCount > 0 && degradedCount > 0 ? " · " : ""}
                {degradedCount > 0 ? `${degradedCount} degraded` : ""}
              </span>
            </div>
            <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {sortedComponents.map((c) => (
                <div key={c.service} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{LABEL[c.service] ?? c.service}</p>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{c.message}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      c.status === "up"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : c.status === "degraded"
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                          : c.status === "maintenance"
                            ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                            : "bg-red-500/15 text-red-700 dark:text-red-400"
                    }`}
                  >
                    {c.status === "up" ? "Operational" : c.status === "degraded" ? "Degraded" : c.status === "maintenance" ? "Maintenance" : "Down"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subscribe / status links */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-xs dark:border-zinc-800 dark:bg-zinc-900/50">
          <div>
            <p className="font-medium text-zinc-900 dark:text-zinc-100">Want email or webhook updates?</p>
            <p className="mt-0.5 text-zinc-500 dark:text-zinc-400">Follow real-time monitor checks and subscribe to alerts on our public status page.</p>
          </div>
          <a
            href="https://status.onboardops.org"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Open status.onboardops.org
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Owner-only control card */}
        {isOwner && (
          <div className="mt-4 rounded-lg border border-amber-400/50 bg-amber-50/70 p-4 text-xs dark:border-amber-800 dark:bg-amber-950/30">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-amber-950 dark:text-amber-200">Site Owner Controls</p>
                <p className="mt-0.5 text-amber-900/80 dark:text-amber-300/80">
                  Manage Better Stack reports, override the outage screen, or preview the live site.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOwnerBypass(true)}
                  className="rounded-md border border-amber-400/70 bg-white px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100 dark:border-amber-700 dark:bg-zinc-900 dark:text-amber-200 dark:hover:bg-amber-950"
                >
                  Preview Site (Owner Bypass)
                </button>
                <Link
                  href="/admin/status"
                  className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
                >
                  Open Status Manager →
                </Link>
              </div>
            </div>
          </div>
        )}

        <p className="mt-5 text-center text-xs text-zinc-500">
          Staff can still reach{" "}
          <Link href="/admin" className="underline">Admin</Link> and{" "}
          <Link href="/login" className="underline">Sign-in</Link>. This page checks automatically every 20 seconds.
        </p>
      </div>
    </div>
  );
}
