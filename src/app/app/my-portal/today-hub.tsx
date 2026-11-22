"use client";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarOff, CheckCircle2, Clock, FileSignature, GraduationCap, ListChecks, ShieldAlert, Sun } from "lucide-react";

export type TodayProps = {
  clock: React.ReactNode;
  locationName: string | null;
  myShifts: { id: string; label: string; startsAt: string; endsAt: string }[];
  teamShifts: { id: string; name: string; label: string; startsAt: string; endsAt: string }[];
  weekEntries: { clockIn: string; clockOut: string | null }[];
  templates: { id: string; title: string; dueToday?: boolean; dueTime?: string }[];
  submittedTemplateIds: { id: string; at: string }[];
  unsignedCases: { id: string; caseNumber: string }[];
  policies: { id: string; title: string; signed: boolean }[];
  enrollments: { id: string; title: string; status: string; due: string | null; courseId: string }[];
  credentials: { id: string; name: string; expires: string }[];
  requests: { id: string; kind: string; status: string; start: string | null; end: string | null; subtype?: string | null }[];
};

const DAY = 86400000;
const sod = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const same = (a: Date, b: Date) => sod(a).getTime() === sod(b).getTime();
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const TAB_OF: Record<string, string> = { checklists: "checklists", policies: "policies", notices: "records", documents: "records" };
const jump = (id: string) => {
  window.dispatchEvent(new CustomEvent("oo:tab", { detail: TAB_OF[id] ?? "home" }));
  setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
};
const open = (what: string) => window.dispatchEvent(new CustomEvent("oo:open", { detail: what }));

type Todo = { key: string; label: string; due: Date | null; Icon: typeof Clock; go: () => void; hot?: boolean };

export function TodayHub(p: TodayProps) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); }, []);

  const d = useMemo(() => {
    if (!now) return null;
    const today = sod(now);
    const myToday = p.myShifts.filter((s) => same(new Date(s.startsAt), now)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const mates = (s: { startsAt: string; endsAt: string }) => p.teamShifts.filter((t) => new Date(t.startsAt) < new Date(s.endsAt) && new Date(t.endsAt) > new Date(s.startsAt)).map((t) => t.name);
    const dueTemplates = p.templates.filter((t) => t.dueToday && !p.submittedTemplateIds.some((s) => s.id === t.id && same(new Date(s.at), now)));
    const todos: Todo[] = [];
    for (const c of p.unsignedCases) todos.push({ key: `case-${c.id}`, label: `Sign notice ${c.caseNumber}`, due: null, Icon: ShieldAlert, go: () => jump("notices"), hot: true });
    for (const x of p.policies.filter((x) => !x.signed)) todos.push({ key: `pol-${x.id}`, label: `Sign policy: ${x.title}`, due: null, Icon: FileSignature, go: () => jump("policies"), hot: true });
    for (const e of p.enrollments.filter((e) => e.status !== "PASSED")) todos.push({ key: `enr-${e.id}`, label: `Course: ${e.title}`, due: e.due ? new Date(e.due) : null, Icon: GraduationCap, go: () => { window.location.href = `/app/training/course/${e.courseId}`; } });
    for (const t of dueTemplates) todos.push({ key: `chk-${t.id}`, label: `Checklist: ${t.title}${t.dueTime ? ` (by ${t.dueTime})` : ""}`, due: today, Icon: ListChecks, go: () => jump("checklists") });
    for (const c of p.credentials) todos.push({ key: `cred-${c.id}`, label: `${new Date(c.expires) < now ? "Expired" : "Expiring"}: ${c.name}`, due: new Date(c.expires), Icon: AlertCircle, go: () => jump("documents") });
    todos.sort((a, b) => (a.due && b.due ? a.due.getTime() - b.due.getTime() : a.due ? -1 : b.due ? 1 : 0) || Number(!!b.hot) - Number(!!a.hot));
    const assigned = p.enrollments.length + p.policies.length;
    const done = p.enrollments.filter((e) => e.status === "PASSED").length + p.policies.filter((x) => x.signed).length;
    const weekStart = sod(new Date(now.getTime() - ((now.getDay() + 6) % 7) * DAY));
    const hours = p.weekEntries.reduce((sum, e) => { const a = new Date(e.clockIn); if (a < weekStart) return sum; const b = e.clockOut ? new Date(e.clockOut) : now; return sum + (b.getTime() - a.getTime()) / 3600000; }, 0);
    const days = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(today.getTime() + i * DAY);
      const items: string[] = [];
      for (const s of p.myShifts.filter((s) => same(new Date(s.startsAt), day))) items.push(`${time(s.startsAt)}–${time(s.endsAt)} ${s.label || "Shift"}`);
      for (const r of p.requests.filter((r) => r.status === "APPROVED" && r.start && (r.kind === "TIMEOFF" || r.kind === "LOA"))) { const a = sod(new Date(r.start!)), b = sod(new Date(r.end ?? r.start!)); if (day >= a && day <= b) items.push(r.kind === "TIMEOFF" ? `Time off${r.subtype ? ` (${r.subtype.toLowerCase()})` : ""}` : "Leave"); }
      for (const e of p.enrollments.filter((e) => e.status !== "PASSED" && e.due && same(new Date(e.due), day))) items.push(`Due: ${e.title}`);
      for (const c of p.credentials.filter((c) => same(new Date(c.expires), day))) items.push(`Expires: ${c.name}`);
      return { day, items };
    });
    return { myToday, mates, dueTemplates, todos, assigned, done, hours, days };
  }, [now, p]);

  if (!d || !now) return <div className="card mb-6 h-40 animate-pulse" aria-hidden />;
  const next = p.myShifts.find((s) => new Date(s.startsAt) > now);
  const unsigned = p.unsignedCases.length + p.policies.filter((x) => !x.signed).length;
  const pct = d.assigned ? Math.round((d.done / d.assigned) * 100) : 100;

  return (
    <div className="mb-6 space-y-4">
      <section className="card p-4 text-[13px]" aria-label="Today">
        <div className="flex flex-wrap items-center gap-2"><Sun className="h-4 w-4 text-accent" aria-hidden /><h2 className="text-sm font-semibold">Today, {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</h2>
          <span className="ml-auto mono text-xs text-soft">{d.hours.toFixed(1)} h worked this week</span></div>
        <div className="mt-3 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-3">
            {d.myToday.length > 0 ? d.myToday.map((s) => (
              <div key={s.id} className="rounded-md border border-line p-3">
                <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{s.label || "Shift"}</span><span className="mono text-xs text-soft">{time(s.startsAt)} to {time(s.endsAt)}</span>{p.locationName && <span className="text-xs text-soft">· {p.locationName}</span>}</div>
                {d.mates(s).length > 0 ? <p className="mt-1 text-xs text-soft">Also on: {d.mates(s).slice(0, 6).join(", ")}{d.mates(s).length > 6 ? ` and ${d.mates(s).length - 6} more` : ""}</p> : <p className="mt-1 text-xs text-soft">You are the only one scheduled at this time.</p>}
              </div>
            )) : <div className="rounded-md border border-dashed border-line p-3 text-soft">No shift today.{next ? ` Next: ${new Date(next.startsAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}, ${time(next.startsAt)}.` : ""}</div>}
            {p.clock}
          </div>
          <div className="space-y-2">
            <button className="flex w-full items-center gap-2 rounded-md border border-line px-3 py-2 text-left hover:bg-muted" onClick={() => jump("checklists")}><ListChecks className="h-4 w-4 text-soft" aria-hidden /><span className="flex-1">{d.dueTemplates.length ? `${d.dueTemplates.length} checklist${d.dueTemplates.length > 1 ? "s" : ""} due today` : "No checklists due today"}</span></button>
            <button className="flex w-full items-center gap-2 rounded-md border border-line px-3 py-2 text-left hover:bg-muted" onClick={() => jump(p.unsignedCases.length ? "notices" : "policies")}><FileSignature className="h-4 w-4 text-soft" aria-hidden /><span className="flex-1">{unsigned ? `${unsigned} thing${unsigned > 1 ? "s" : ""} ${unsigned > 1 ? "need" : "needs"} your signature` : "Nothing to sign"}</span></button>
            <div className="flex flex-wrap gap-2 pt-1">
              <button className="btn" onClick={() => open("request")}>Request time off</button>
              <button className="btn" onClick={() => open("incident")}>Report a concern</button>
            </div>
          </div>
        </div>
      </section>

      <section className="card p-4 text-[13px]" aria-label="To do">
        <div className="flex flex-wrap items-center gap-3"><h2 className="text-sm font-semibold">To do</h2>
          {d.assigned > 0 && <><div className="h-2 w-40 overflow-hidden rounded bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Courses and policies completed"><div className="h-2 rounded bg-accent" style={{ width: `${pct}%` }} /></div><span className="mono text-xs text-soft">{d.done} of {d.assigned} courses and policies done</span></>}</div>
        {d.todos.length === 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md bg-muted p-3"><CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden /><div className="min-w-0 flex-1"><div className="font-medium">You are all caught up</div><div className="text-soft">Nothing is waiting for you. If you need something, you can ask for time off, report a concern, or check your documents.</div></div>
            <div className="flex flex-wrap gap-2"><button className="btn" onClick={() => open("request")}><CalendarOff className="h-3.5 w-3.5" />Request time off</button><button className="btn" onClick={() => open("incident")}>Report a concern</button><button className="btn" onClick={() => jump("documents")}>My documents</button></div></div>
        ) : (
          <ul className="mt-3 divide-y divide-line">{d.todos.slice(0, 8).map((t) => {
            const late = t.due && t.due < sod(now);
            return (
              <li key={t.key}><button className="flex w-full items-center gap-3 py-2 text-left hover:bg-muted" onClick={t.go}><t.Icon className="h-4 w-4 shrink-0 text-soft" aria-hidden /><span className="min-w-0 flex-1 truncate">{t.label}</span>
                {t.due ? <span className={`mono text-xs ${late ? "text-rose-600" : "text-soft"}`}>{late ? "overdue · " : ""}{t.due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span> : t.hot ? <span className="text-xs text-amber-700 dark:text-amber-300">needs you</span> : null}</button></li>
            );
          })}{d.todos.length > 8 && <li className="py-2 text-xs text-soft">and {d.todos.length - 8} more below</li>}</ul>
        )}
      </section>

      <section className="card p-4 text-[13px]" aria-label="Next 7 days">
        <h2 className="mb-2 text-sm font-semibold">Next 7 days</h2>
        <div className="grid gap-2 sm:grid-cols-7">{d.days.map(({ day, items }, i) => (
          <div key={i} className={`rounded-md border p-2 ${i === 0 ? "border-accent" : "border-line"}`}>
            <div className="text-xs font-medium">{i === 0 ? "Today" : day.toLocaleDateString("en-US", { weekday: "short" })} <span className="text-soft">{day.getDate()}</span></div>
            {items.length === 0 ? <div className="mt-1 text-xs text-soft">Nothing</div> : <ul className="mt-1 space-y-1">{items.map((t, j) => <li key={j} className="rounded bg-muted px-1.5 py-0.5 text-xs leading-snug">{t}</li>)}</ul>}
          </div>
        ))}</div>
      </section>
    </div>
  );
}
