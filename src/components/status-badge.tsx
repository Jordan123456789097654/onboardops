"use client";
import { useEffect, useState } from "react";

type BadgeState = "ok" | "degraded" | "down";

/** Live status badge backed by our status feed and linked to status.onboardops.org. Follows light/dark theme automatically. */
export function StatusBadge() {
  const [state, setState] = useState<BadgeState>("ok");

  useEffect(() => {
    let alive = true;
    fetch("/api/incidents", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { active?: boolean; mode?: string } | null) => {
        if (!alive || !d) return;
        if (d.active && d.mode === "lock") setState("down");
        else if (d.active) setState("degraded");
        else setState("ok");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const dot =
    state === "down"
      ? "bg-rose-500"
      : state === "degraded"
        ? "bg-amber-500"
        : "bg-emerald-500";
  const label =
    state === "down"
      ? "Service disruption"
      : state === "degraded"
        ? "Partial degradation"
        : "All systems operational";

  return (
    <a
      href="https://status.onboardops.org"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-[30px] items-center gap-2 rounded-full border border-line bg-surface px-3 text-xs font-medium text-ink transition-colors hover:border-ink/30 hover:bg-muted"
      title="View live system status on status.onboardops.org"
    >
      <span className="relative flex h-2 w-2">
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-50 ${dot}`} />
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} />
      </span>
      <span>{label}</span>
    </a>
  );
}
