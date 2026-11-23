"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ComponentHealth } from "@/lib/status";
import type { OpenIncident } from "@/lib/incidents";

export type OutageView = {
  active: boolean;
  services: string[];
  until: string | null;
  components: ComponentHealth[];
  incidents: OpenIncident[];
};

const LABEL: Record<string, string> = { frontend: "Website", database: "Database", auth: "Sign-in", api: "Core API", email: "Email", storage: "File storage", domains: "Domains" };
const OPEN_PATHS = ["/admin", "/login", "/magic"];

function fmtLeft(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** While an outage test is running, every page except the Staff Console (and sign-in) shows this screen with the status details. */
export function OutageGate({ outage, children }: { outage: OutageView; children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const endMs = outage.until ? Date.parse(outage.until) : NaN;
  const open = OPEN_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  useEffect(() => {
    if (!outage.active) return;
    const id = window.setInterval(() => {
      setNow(Date.now());
      if (!isNaN(endMs) && Date.now() >= endMs) window.location.reload();
    }, 1000);
    // Pick up a resolved incident or a finished test without a manual reload.
    const refresh = window.setInterval(() => router.refresh(), 30000);
    return () => { window.clearInterval(id); window.clearInterval(refresh); };
  }, [outage.active, endMs, router]);

  if (!outage.active || open) return <>{children}</>;

  const left = isNaN(endMs) ? null : fmtLeft(endMs - now);
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col overflow-y-auto bg-white px-4 py-8 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto w-full max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">OnboardOps status</p>
        <h1 className="mt-2 text-2xl font-semibold">We are experiencing issues</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Some parts of OnboardOps are not working right now. Your data is safe. We are working on it and the app will return automatically.
        </p>
        {outage.incidents.length > 0 && (
          <ul className="mt-4 space-y-2">
            {outage.incidents.map((i) => (
              <li key={i.id} className="rounded-lg border border-red-300/60 bg-red-50 px-4 py-3 text-sm dark:border-red-900 dark:bg-red-950/40">
                <p className="font-medium">{i.name}</p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">{i.cause ?? "Under investigation"}{i.startedAt ? ` · started ${new Date(i.startedAt).toLocaleString("en-US", { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" })}` : ""}</p>
              </li>
            ))}
          </ul>
        )}
        {left && <p className="mt-3 text-sm">Expected back in <span className="font-mono font-semibold">{left}</span>.</p>}
        <div className="mt-6 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {outage.components.map((c) => (
            <div key={c.service} className="flex items-start justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-medium">{LABEL[c.service] ?? c.service}</p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{c.message}</p>
              </div>
              <span className={`shrink-0 text-xs font-semibold ${c.status === "up" ? "text-emerald-600" : c.status === "degraded" ? "text-amber-600" : "text-red-600"}`}>
                {c.status === "up" ? "Operational" : c.status === "degraded" ? "Degraded" : c.status === "maintenance" ? "Maintenance" : "Down"}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-zinc-500">Staff can still reach the admin panel and sign-in. This page reloads when service returns.</p>
      </div>
    </div>
  );
}
