import { BookOpen, CalendarCheck, CheckCircle2, ClipboardList, LayoutDashboard, Search, ScrollText, Settings, ShieldAlert, Users } from "lucide-react";
import { Badge, Logo } from "./ui";
import { Bar, CountUp, Reveal } from "./motion";
import { AuditFeed } from "./audit-feed";
import { cn } from "@/lib/utils";

/* Static, theme-aware replicas of the real screens. Fictional data. */

const I = (n: number) => ({ "--i": n }) as React.CSSProperties;

export function BrowserFrame({ url, children, className }: { url: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-line bg-surface shadow-[0_24px_60px_-24px_rgba(9,9,11,0.28)]", className)}>
      <div className="flex h-9 items-center gap-3 border-b border-line bg-muted px-3">
        <div className="flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-line" /><i className="h-2.5 w-2.5 rounded-full bg-line" /><i className="h-2.5 w-2.5 rounded-full bg-line" /></div>
        <div className="mono mx-auto flex h-6 w-full max-w-sm items-center justify-center rounded-md border border-line bg-surface text-[11px] text-soft">{url}</div>
        <div className="w-12" />
      </div>
      {children}
    </div>
  );
}

const nav = [
  ["Command Center", LayoutDashboard, true], ["Staff Directory", Users], ["Shift Checklists", ClipboardList], ["Training Academy", BookOpen], ["Compliance Matrix", CalendarCheck], ["Infractions", ShieldAlert], ["Audit Log", ScrollText], ["Settings", Settings],
] as const;

export function DashboardShot() {
  const bars: [string, number, string][] = [["Warehouse Safety Fundamentals", 88, "7 / 8"], ["Dock & Forklift Operations", 50, "1 / 2"], ["Safety Retraining: Incident Review", 0, "0 / 1"]];
  const kpis: [string, number, string, string][] = [["Active staff", 7, "", "currently working"], ["Pending onboarding", 1, "", "not yet certified"], ["Training compliance", 73, "%", "0 overdue"], ["Unacknowledged", 1, "", "awaiting signature"]];
  return (
    <BrowserFrame url="/app/overview">
      <div className="grid grid-cols-[168px_1fr] text-[11px] sm:grid-cols-[200px_1fr]">
        <Reveal group className="hidden border-r border-line bg-surface p-3 sm:block">
          <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold"><Logo size={18} />Onboard<span className="-ml-1.5 text-soft">Ops</span></div>
          <div className="mb-3 rounded-md border border-line px-2 py-1.5 text-soft">Northside Supply &amp; Logistics</div>
          <div className="space-y-0.5">{nav.map(([l, Icon, a], i) => <div key={l} style={I(i)} className={cn("item left flex items-center gap-2 rounded-md px-2 py-1.5", a ? "bg-muted font-medium text-ink" : "text-soft")}><Icon className={cn("h-3.5 w-3.5", a && "text-accent")} />{l}</div>)}</div>
        </Reveal>
        <div className="col-span-2 bg-canvas p-4 sm:col-span-1">
          <div className="mb-3 flex items-center justify-between">
            <div><div className="text-base font-semibold">Command Center</div><div className="text-soft">Northside Supply &amp; Logistics</div></div>
            <div className="hidden items-center gap-1.5 sm:flex"><span className="flex h-7 items-center gap-1.5 rounded-md border border-line bg-surface px-2 text-soft"><Search className="h-3 w-3" />Jump to…</span><span className="flex h-7 items-center rounded-md bg-accent px-2.5 font-medium text-accent-fg">Add employee</span></div>
          </div>
          <Reveal group className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {kpis.map(([l, v, s, n], i) => (
              <div key={l} style={I(i + 2)} className="item rounded-lg border border-line bg-surface p-2.5"><div className="text-soft">{l}</div><div className="mono mt-0.5 text-xl font-semibold"><CountUp to={v} suffix={s} /></div><div className="text-soft">{n}</div></div>
            ))}
          </Reveal>
          <div className="mt-2 grid gap-2 lg:grid-cols-[1.6fr_1fr]">
            <div className="rounded-lg border border-line bg-surface p-3">
              <div className="mb-2 text-[12px] font-semibold">Completion by course</div>
              <div className="space-y-2.5">{bars.map(([t, p, c], i) => <div key={t}><div className="mb-1 flex justify-between"><span className="font-medium">{t}</span><span className="mono text-soft">{c}</span></div><Bar pct={p} index={i} className="!h-1.5" /></div>)}</div>
            </div>
            <Reveal group className="rounded-lg border border-line bg-surface p-3">
              <div className="mb-2 text-[12px] font-semibold">Needs attention</div>
              <div style={I(4)} className="item flex items-center justify-between py-1"><span><b className="font-medium">Devon Pruitt</b> <span className="mono text-soft">EMP-1005</span></span><Badge value="RETRAINING_REQUIRED" label="Retraining" /></div>
              <div style={I(5)} className="item flex items-center justify-between border-t border-line py-1"><span><b className="font-medium">Rosa Delgado</b> <span className="mono text-soft">EMP-1008</span></span><Badge value="ONBOARDING" /></div>
            </Reveal>
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

/** Notifications that float over the hero screenshot to show the automations firing. */
export function HeroToasts() {
  const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-6 hidden justify-end gap-3 pr-6 lg:flex">
      <div className="anim-pop" style={d(1700)}>
        <div className="anim-float flex w-72 items-start gap-2.5 rounded-lg border border-line bg-surface p-3 text-[12px] shadow-xl" style={d(2200)}>
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div><div className="font-semibold">Rosa Delgado is certified</div><div className="text-soft">Passed Warehouse Safety with 92%. Status changed to Active.</div></div>
        </div>
      </div>
      <div className="anim-pop" style={d(2600)}>
        <div className="anim-float flex w-72 items-start gap-2.5 rounded-lg border border-line bg-surface p-3 text-[12px] shadow-xl" style={d(3400)}>
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div><div className="font-semibold">Retraining assigned</div><div className="text-soft">INF-2026-001 triggered the remedial safety course for Devon Pruitt.</div></div>
        </div>
      </div>
    </div>
  );
}

export function CaseShot() {
  const timeline = [["Nov 3, 3:20 PM", "Case created by Marcus Reyes"], ["Nov 3, 3:20 PM", "Remedial course assigned automatically"], ["Nov 4, 2:05 PM", "Marcus Reyes: reviewed in person, Devon said they were behind on picks"]];
  return (
    <BrowserFrame url="/app/infractions">
      <Reveal group className="space-y-3 bg-surface p-5 text-[12px]">
        <div style={I(0)} className="item flex flex-wrap items-center gap-2"><span className="mono text-[13px] font-semibold">INF-2026-001</span><Badge value="WRITTEN_INFRACTION" /><span className="mono">+2 pts</span><span className="ml-auto"><Badge value="PENDING" label="Awaiting signature" /></span></div>
        <div style={I(1)} className="item grid gap-3 sm:grid-cols-2">
          <div><div className="text-soft">Employee</div><div className="font-medium">EMP-1005 Devon Pruitt</div></div>
          <div><div className="text-soft">Policy</div><div className="font-medium">Safe Lifting &amp; Aisle Traffic, 4.2</div></div>
        </div>
        <div style={I(2)} className="item"><div className="text-soft">Summary</div><p className="mt-0.5 leading-relaxed">Crossed the aisle 7 intersection with a loaded pallet jack without stopping at the blind corner. A lift truck braked within two feet. No injury or damage.</p></div>
        <div style={I(3)} className="item rounded-md border border-amber-300 bg-amber-50 p-2.5 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"><div className="text-[11px] font-semibold">Confidential, managers only</div>Second near miss this quarter. Pick-rate target for aisle 7 under review with HR.</div>
        <ol className="space-y-2 border-l border-line pl-3">{timeline.map(([t, n], i) => <li key={n} style={I(i + 4)} className="item left"><div className="mono text-[11px] text-soft">{t}</div>{n}</li>)}</ol>
      </Reveal>
    </BrowserFrame>
  );
}

export function MatrixShot() {
  const cols = ["Safety", "Forklift", "Retraining"];
  const rows: [string, string, (string | null)[]][] = [
    ["Marcus Reyes", "EMP-1001", ["100%", "100%", null]], ["Tomas Alvarez", "EMP-1003", ["90%", "In progress", null]], ["Keisha Brooks", "EMP-1004", ["100%", null, null]], ["Devon Pruitt", "EMP-1005", ["85%", null, "Assigned"]], ["Rosa Delgado", "EMP-1008", ["Assigned", null, null]],
  ];
  const tone = (v: string | null) => (!v ? "" : /%/.test(v) ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300");
  return (
    <BrowserFrame url="/app/training/compliance">
      <Reveal group className="bg-surface text-[12px]">
        <div className="grid grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="th !static">Employee</div>{cols.map((c) => <div key={c} className="th !static text-center">{c}</div>)}
          {rows.map(([n, id, v], r) => (
            <div key={id} className="contents">
              <div style={I(r * 4)} className="item border-b border-line px-3 py-2"><span className="font-medium">{n}</span> <span className="mono text-[11px] text-soft">{id}</span></div>
              {v.map((x, i) => <div key={i} style={I(r * 4 + i + 1)} className={cn("item pop mono border-b border-l border-line px-3 py-2 text-center text-[11px]", tone(x))}>{x ?? ""}</div>)}
            </div>
          ))}
        </div>
      </Reveal>
    </BrowserFrame>
  );
}

export function AuditShot() {
  return (
    <BrowserFrame url="/app/audit">
      <AuditFeed />
    </BrowserFrame>
  );
}
