"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "oo-launch-progress";
const steps: { id: string; mins: number; t: string; d: string; href?: string; label?: string }[] = [
  { id: "ws", mins: 3, t: "Create your workspace", d: "Pick a company name. Your address, like yourcompany.onboardops.org, is set up for you.", href: "/register", label: "Create workspace" },
  { id: "roles", mins: 5, t: "Add departments and job roles", d: "In Settings, add where people work and the roles they hold. Choose required courses per role." },
  { id: "import", mins: 5, t: "Import your people", d: "From Staff Directory, import a CSV, or add people one at a time.", href: "/migrate/from-spreadsheets", label: "Import guide" },
  { id: "policy", mins: 5, t: "Publish your first policy", d: "Start from the free policy builder, add it to your workspace, review it and publish it.", href: "/tools/policy-builder", label: "Policy builder" },
  { id: "check", mins: 4, t: "Make one shift checklist", d: "Opening or closing. Choose the days it repeats and when it is due." },
  { id: "course", mins: 4, t: "Add a short course", d: "Use a starter course from the Templates library, such as safety or harassment awareness." },
  { id: "invite", mins: 3, t: "Invite your team", d: "Send sign-in invites from Staff Accounts so each person sets their own password." },
  { id: "rules", mins: 1, t: "Set your discipline basics", d: "Review strike thresholds in Settings. Optionally set a ladder.", href: "/tools/discipline-ladder", label: "Ladder builder" },
];
const total = steps.reduce((n, s) => n + s.mins, 0);

export function LaunchChecklist() {
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => { try { setDone(JSON.parse(localStorage.getItem(KEY) ?? "[]")); } catch { /* none */ } }, []);
  const toggle = (id: string) => { const next = done.includes(id) ? done.filter((x) => x !== id) : [...done, id]; setDone(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ } };
  const left = steps.filter((s) => !done.includes(s.id)).reduce((n, s) => n + s.mins, 0);
  const pct = Math.round((done.length / steps.length) * 100);
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="h-2 w-56 overflow-hidden rounded bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Launch progress"><div className="h-2 rounded bg-accent transition-all" style={{ width: `${pct}%` }} /></div>
        <span className="mono text-xs text-soft">{done.length} of {steps.length} done · about {left} of {total} minutes left</span>
        {done.length > 0 && <button className="btn" onClick={() => { setDone([]); try { localStorage.removeItem(KEY); } catch { /* ignore */ } }}>Reset</button>}
      </div>
      <ol className="space-y-2">
        {steps.map((s, i) => {
          const on = done.includes(s.id);
          return (
            <li key={s.id} className={`flex items-start gap-3 rounded-lg border p-3 ${on ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950" : "border-line"}`}>
              <input type="checkbox" className="mt-1 h-4 w-4" checked={on} onChange={() => toggle(s.id)} aria-label={`Mark done: ${s.t}`} />
              <div className="min-w-0 flex-1"><div className={`text-[14px] font-medium ${on ? "line-through opacity-70" : ""}`}>{i + 1}. {s.t} <span className="mono ml-1 text-xs font-normal text-soft">{s.mins} min</span></div><p className="mt-0.5 text-[13px] text-soft">{s.d}</p></div>
              {s.href && <Link href={s.href} className="btn shrink-0">{s.label}</Link>}
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-xs text-soft">Your progress is saved on this device only.</p>
    </div>
  );
}
