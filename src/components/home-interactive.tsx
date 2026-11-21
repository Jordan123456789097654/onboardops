"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Lock, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ Role explorer */
const ROLES = [
  { id: "owner", label: "Owner / Admin", blurb: "Runs the workspace. Sees everything, including confidential notes and the audit log." },
  { id: "manager", label: "Manager", blurb: "Runs people and training. Can issue discipline up to a suspension and read confidential notes." },
  { id: "supervisor", label: "Supervisor", blurb: "Runs a shift. Can give verbal and written warnings and verify checklists, but never sees confidential notes." },
  { id: "employee", label: "Employee", blurb: "Sees only their own portal: training, policies, checklists, requests and notices." },
] as const;
type RoleId = (typeof ROLES)[number]["id"];

const NAV: [string, RoleId[]][] = [
  ["Command Center", ["owner", "manager", "supervisor"]], ["Staff Directory", ["owner", "manager", "supervisor"]], ["Shift Checklists", ["owner", "manager", "supervisor"]], ["Staff Requests", ["owner", "manager", "supervisor"]],
  ["Staff Accounts", ["owner", "manager"]], ["Training Academy", ["owner", "manager", "supervisor"]], ["Course Builder", ["owner", "manager"]], ["Infractions", ["owner", "manager", "supervisor"]],
  ["Incident Reports", ["owner", "manager", "supervisor"]], ["Policies", ["owner", "manager", "supervisor"]], ["Reports", ["owner", "manager"]], ["Audit Log", ["owner"]], ["Settings", ["owner"]], ["My Portal", ["employee", "owner", "manager", "supervisor"]],
];
const CAPS: [string, RoleId[]][] = [
  ["Add and edit employees", ["owner", "manager"]], ["Build courses and quizzes", ["owner", "manager"]], ["Issue verbal and written warnings", ["owner", "manager", "supervisor"]], ["Issue suspensions and strike points", ["owner", "manager"]],
  ["Terminate staff", ["owner"]], ["Read confidential manager notes", ["owner", "manager"]], ["Verify shift checklists", ["owner", "manager", "supervisor"]], ["Approve leave requests", ["owner", "manager"]],
  ["Read the full audit log", ["owner"]], ["Change settings, webhooks and domain", ["owner"]], ["Take courses and sign notices", ["owner", "manager", "supervisor", "employee"]],
];

export function RoleExplorer() {
  const [role, setRole] = useState<RoleId>("manager");
  const cur = ROLES.find((r) => r.id === role)!;
  const navCount = NAV.filter(([, r]) => r.includes(role)).length;
  return (
    <div className="card overflow-hidden">
      <div role="tablist" aria-label="Role" className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line bg-muted p-1.5">
        {ROLES.map((r) => <button key={r.id} role="tab" aria-selected={r.id === role} onClick={() => setRole(r.id)} className={cn("whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium transition-all", r.id === role ? "bg-surface text-ink shadow-sm" : "text-soft hover:text-ink")}>{r.label}</button>)}
      </div>
      <p key={role} className="anim-fade-in border-b border-line px-4 py-3 text-[13px] text-soft">{cur.blurb}</p>
      <div className="grid gap-0 md:grid-cols-[240px_1fr]">
        <div className="border-b border-line p-4 md:border-b-0 md:border-r">
          <div className="mb-2 text-xs font-semibold text-soft">Menu they see ({navCount})</div>
          <ul className="space-y-0.5 text-[13px]">
            {NAV.map(([label, roles]) => { const on = roles.includes(role); return (
              <li key={label} className={cn("flex items-center gap-2 rounded-md px-2 py-1 transition-all duration-300", on ? "bg-muted font-medium" : "text-soft/50")}>
                {on ? <Check className="h-3.5 w-3.5 text-accent" /> : <Lock className="h-3 w-3" />}<span className={on ? "" : "line-through"}>{label}</span>
              </li>); })}
          </ul>
        </div>
        <div className="p-4">
          <div className="mb-2 text-xs font-semibold text-soft">What they can do</div>
          <ul className="grid gap-1.5 text-[13px] sm:grid-cols-2">
            {CAPS.map(([label, roles]) => { const on = roles.includes(role); return (
              <li key={label} className={cn("flex items-start gap-2 rounded-md border px-2.5 py-2 transition-all duration-300", on ? "border-line bg-surface" : "border-transparent bg-muted/60 text-soft/60")}>
                {on ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> : <Minus className="mt-0.5 h-4 w-4 shrink-0" />}{label}
              </li>); })}
          </ul>
          <p className="mt-3 text-xs text-soft">Checked on the server for every request, not just hidden in the menu.</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Flow stepper */
const STEPS = [
  { t: "Hire", d: "Add the employee once, or import a CSV. They get a staff ID and every course their job role requires. An invite lets them choose their own password.", img: "directory", url: "/app/directory" },
  { t: "Train", d: "Markdown lessons with a minimum read time, then a quiz graded on the server. Fail and a retake cooldown applies.", img: "course", url: "/app/training/course" },
  { t: "Certify", d: "Pass every required course and the record flips to Certified and Active. See at a glance who is missing what.", img: "compliance", url: "/app/training/compliance" },
  { t: "Discipline", d: "Log warnings, points and suspensions. The employee signs. Confidential notes stay with managers.", img: "infractions", url: "/app/infractions" },
  { t: "Audit", d: "Every change goes into an append-only log with chained hashes. Nothing is quietly deleted.", img: "audit", url: "/app/audit" },
];

export function FlowStepper() {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!auto || (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    timer.current = setInterval(() => setI((x) => (x + 1) % STEPS.length), 6000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [auto]);
  const pick = (n: number) => { setAuto(false); setI(n); };
  const s = STEPS[i];
  return (
    <div>
      <ol className="grid grid-cols-5 gap-2" role="tablist" aria-label="Steps">
        {STEPS.map((x, n) => (
          <li key={x.t}>
            <button role="tab" aria-selected={n === i} onClick={() => pick(n)} className="group w-full text-left">
              <div className="relative h-0.5 w-full overflow-hidden rounded bg-line"><div key={`${n === i}-${auto}`} className={cn("absolute inset-y-0 left-0 bg-ink", n < i && "w-full", n === i && (auto ? "step-fill" : "w-full"))} /></div>
              <div className={cn("mt-2 text-[11px] sm:text-[13px]", n === i ? "font-semibold text-ink" : "text-soft group-hover:text-ink")}><span className="mono mr-1 hidden sm:inline">{n + 1}</span>{x.t}</div>
            </button>
          </li>
        ))}
      </ol>
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[320px_1fr]">
        <div key={i} className="anim-fade-up">
          <h3 className="text-xl font-semibold">{s.t}</h3>
          <p className="mt-2 text-[14px] leading-relaxed text-soft">{s.d}</p>
          <div className="mt-4 flex gap-2"><button className="btn" onClick={() => pick((i + STEPS.length - 1) % STEPS.length)}>Back</button><button className="btn-primary" onClick={() => pick((i + 1) % STEPS.length)}>Next <ArrowRight className="h-3.5 w-3.5" /></button></div>
        </div>
        <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-[0_24px_60px_-24px_rgba(9,9,11,0.28)]">
          <div className="flex h-9 items-center gap-3 border-b border-line bg-muted px-3"><div className="flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-line" /><i className="h-2.5 w-2.5 rounded-full bg-line" /><i className="h-2.5 w-2.5 rounded-full bg-line" /></div><div className="mono mx-auto flex h-6 w-full max-w-xs items-center justify-center rounded-md border border-line bg-surface text-[11px] text-soft">{s.url}</div><div className="w-10" /></div>
          <div className="grid">
            {STEPS.map((x, n) => (
              <div key={x.img} aria-hidden={n !== i} className={cn("col-start-1 row-start-1 transition-opacity duration-500", n === i ? "opacity-100" : "pointer-events-none opacity-0")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/screens/${x.img}-light.jpg`} width={2040} height={1260} loading="lazy" decoding="async" alt={n === i ? `${x.t} screen` : ""} className="shot-light block h-auto w-full" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/screens/${x.img}-dark.jpg`} width={2040} height={1260} loading="lazy" decoding="async" alt="" className="shot-dark block h-auto w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Time calculator */
function Slider({ label, value, onChange, min, max, step = 1, suffix = "" }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number; step?: number; suffix?: string }) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-[13px]"><span className="text-soft">{label}</span><span className="mono font-medium">{value}{suffix}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-2 w-full cursor-pointer accent-[rgb(var(--accent))]" />
    </label>
  );
}

export function Calculator({ compact }: { compact?: boolean }) {
  const [people, setPeople] = useState(40);
  const [hires, setHires] = useState(12);
  const [mins, setMins] = useState(20);
  const [saved, setSaved] = useState(50);
  const [wage, setWage] = useState(24);
  const out = useMemo(() => {
    const tracking = (people * mins * 12) / 60; // hours/year chasing training status, signatures and paperwork
    const onboarding = hires * 3; // ~3 admin hours per hire, an assumption shown to the visitor
    const total = tracking + onboarding;
    const back = total * (saved / 100);
    return { total: Math.round(total), back: Math.round(back), money: Math.round(back * wage) };
  }, [people, hires, mins, saved, wage]);
  return (
    <div className="card grid gap-6 p-5 md:grid-cols-[1fr_1fr]">
      <div className="space-y-4">
        <Slider label="People on your team" value={people} onChange={setPeople} min={5} max={300} step={5} />
        <Slider label="New hires per year" value={hires} onChange={setHires} min={0} max={100} />
        <Slider label="Minutes per person each month chasing training status, signatures and paperwork" value={mins} onChange={setMins} min={0} max={90} step={5} suffix=" min" />
        {!compact && <Slider label="Time you think a tool could save (your call)" value={saved} onChange={setSaved} min={10} max={80} step={5} suffix="%" />}
        {!compact && <Slider label="Average hourly cost of the people doing it" value={wage} onChange={setWage} min={12} max={80} suffix="" />}
      </div>
      <div className="flex flex-col justify-center rounded-xl border border-line bg-muted p-5">
        <div className="text-xs text-soft">At your numbers, HR admin and training upkeep takes about</div>
        <div key={out.total} className="anim-fade-in mono mt-1 text-4xl font-semibold">{out.total.toLocaleString()} <span className="text-base font-normal text-soft">hours a year</span></div>
        <div className="mt-4 text-xs text-soft">If a single system saved {saved}% of that, you would get back about</div>
        <div key={out.back} className="anim-fade-in mono mt-1 text-2xl font-semibold text-accent">{out.back.toLocaleString()} hours{!compact && <span className="ml-2 text-base font-normal text-ink">≈ ${out.money.toLocaleString()}</span>}</div>
        <p className="mt-4 text-[11px] leading-relaxed text-soft">This is an estimate built only from the numbers you enter, plus an assumed 3 admin hours per hire. It is not a promise of results. Your own savings could be more or less.</p>
        {compact && <Link href="/why#calculator" className="mt-3 inline-flex items-center gap-1 text-[13px] text-accent">Adjust more settings <ArrowRight className="h-3.5 w-3.5" /></Link>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Fit quiz */
const QUESTIONS = [
  "Training sign-off happens in a group chat, on paper, or from memory",
  "You could not quickly prove who finished safety training last quarter",
  "Write-ups are kept in a binder or a shared folder that several people can edit",
  "Managers sometimes disagree about what is on someone's record",
  "New hires wait for someone to remember to assign their training",
  "You have lost track of a certification until it had already expired",
  "Opening and closing checks live on a clipboard",
];

export function FitQuiz() {
  const [on, setOn] = useState<boolean[]>(QUESTIONS.map(() => false));
  const n = on.filter(Boolean).length;
  const verdict = n >= 5 ? { t: "Strong fit", d: "You are doing most of this by hand today. OnboardOps was built for exactly that, and the beta is free." } : n >= 2 ? { t: "Likely a good fit", d: "A few of your records are fragile. Start with training and acknowledgments, and add discipline records when you are ready." } : { t: "You may be fine for now", d: "If your current process works and you can prove it, keep it. Come back when you grow or when audits get stricter." };
  return (
    <div className="card p-5">
      <p className="text-[13px] text-soft">Tick everything that sounds like your workplace.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {QUESTIONS.map((q, i) => (
          <label key={q} className={cn("flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[13px] transition-colors", on[i] ? "border-accent bg-muted" : "border-line hover:bg-muted")}>
            <input type="checkbox" className="mt-0.5" checked={on[i]} onChange={() => setOn((a) => a.map((x, k) => (k === i ? !x : x)))} />{q}
          </label>
        ))}
      </div>
      <div key={verdict.t} className="anim-fade-in mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-muted p-4">
        <div><div className="text-sm font-semibold">{verdict.t} <span className="mono ml-1 text-xs font-normal text-soft">{n}/{QUESTIONS.length}</span></div><p className="mt-0.5 max-w-xl text-[13px] text-soft">{verdict.d}</p></div>
        <Link href="/register" className="btn-primary">Try it free</Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Compare toggle */
const COMPARE = [
  ["Employee record", "Spreadsheet tabs nobody trusts", "One record per person"],
  ["Training proof", "A thumbs-up in the chat", "Server-graded quiz and certificate code"],
  ["Write-ups", "Binder or folder, signed on paper", "Case with timeline and digital acknowledgment"],
  ["Who sees what", "Whoever has the file", "Roles checked on the server"],
  ["History", "Can be edited or deleted quietly", "Append-only, hash-chained audit log"],
  ["Overdue training", "You find out at an audit", "Reminders and an overdue list"],
];
export function CompareToggle() {
  const [after, setAfter] = useState(true);
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line bg-muted px-4 py-2.5">
        <span className="text-[13px] font-medium">{after ? "With OnboardOps" : "How most teams do it today"}</span>
        <div role="radiogroup" aria-label="Compare" className="flex rounded-md border border-line bg-surface p-0.5 text-xs">
          {([[false, "Today"], [true, "OnboardOps"]] as const).map(([v, l]) => <button key={l} role="radio" aria-checked={after === v} onClick={() => setAfter(v)} className={cn("rounded px-2.5 py-1 font-medium transition-colors", after === v ? "bg-accent text-accent-fg" : "text-soft")}>{l}</button>)}
        </div>
      </div>
      <div className="divide-y divide-line">
        {COMPARE.map(([k, a, b]) => (
          <div key={k} className="grid grid-cols-[130px_1fr] gap-3 px-4 py-3 text-[13px] sm:grid-cols-[180px_1fr]"><span className="text-soft">{k}</span><span key={String(after)} className={cn("anim-fade-in", after ? "font-medium" : "text-soft")}>{after ? b : a}</span></div>
        ))}
      </div>
    </div>
  );
}
