"use client";
import { useState } from "react";
import { Badge, Tabs } from "./ui";
import { cn } from "@/lib/utils";

/* Mirrors the real server rules (src/lib/automations.ts) with local state so visitors can try them. */

function Lifecycle() {
  type S = { hired: boolean; courses: { title: string; passed: boolean; score?: number; cert?: string }[]; status: string; readiness: string; role: string; log: string[] };
  const init: S = { hired: true, courses: [{ title: "Warehouse Safety Fundamentals", passed: false }], status: "ONBOARDING", readiness: "PENDING", role: "Picker / Packer", log: ["EMP-1008 Rosa Delgado added; 1 course assigned"] };
  const [s, setS] = useState<S>(init);
  const recalc = (n: S) => {
    const all = n.courses.length > 0 && n.courses.every((c) => c.passed);
    n.readiness = n.courses.length ? (all ? "CERTIFIED" : "PENDING") : "—";
    if (all && n.status === "ONBOARDING") n.status = "ACTIVE";
    return n;
  };
  const hire = () => setS({ hired: true, courses: [{ title: "Warehouse Safety Fundamentals", passed: false }], status: "ONBOARDING", readiness: "PENDING", role: "Picker / Packer", log: ["EMP-1008 Rosa Delgado added; 1 course assigned"] });
  const pass = (i: number) => {
    const n = structuredClone(s);
    const code = `CERT-${40000 + Math.floor(Math.random() * 9999)}`;
    n.courses[i] = { ...n.courses[i], passed: true, score: 92, cert: code };
    n.log.unshift(`Passed "${n.courses[i].title}" with 92% (${code})`);
    setS(recalc(n));
  };
  const promote = () => {
    const n = structuredClone(s);
    n.role = "Forklift Operator";
    if (!n.courses.some((c) => c.title.startsWith("Dock"))) n.courses.push({ title: "Dock & Forklift Operations", passed: false });
    n.log.unshift("Job role changed to Forklift Operator; 1 course assigned, readiness back to PENDING");
    setS(recalc(n));
  };
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
      <div className="space-y-3">
        <p className="text-[13px] text-soft">Add a hire and watch the role&apos;s required courses get assigned automatically. Pass them and the record flips to Active.</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={hire}>{s.hired ? "Start over" : "Hire Rosa Delgado"}</button>
          <button className="btn" disabled={!s.hired || s.role === "Forklift Operator"} onClick={promote}>Change role to Forklift Operator</button>
        </div>
        <div className="card p-3 text-[13px]">
          <div className="flex items-center justify-between"><span className="font-medium">{s.hired ? "Rosa Delgado" : "No employee yet"}</span><span className="mono text-soft">{s.hired ? "EMP-1008" : ""}</span></div>
          <div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-soft">Status</span> {s.hired ? <span key={s.status} className="anim-pop inline-block"><Badge value={s.status} /></span> : "—"} <span className="text-soft">Readiness</span> {s.hired ? <span key={s.readiness} className="anim-pop inline-block"><Badge value={s.readiness} /></span> : "—"}</div>
          <div className="mt-1 text-soft">Role: {s.hired ? s.role : "—"}</div>
        </div>
      </div>
      <div className="space-y-3">
        <div className="card divide-y divide-line">
          {s.courses.length === 0 && <p className="p-3 text-[13px] text-soft">Enrollments appear here.</p>}
          {s.courses.map((c, i) => (
            <div key={c.title} className="flex items-center justify-between gap-2 p-3 text-[13px]">
              <div><div className="font-medium">{c.title}</div>{c.cert && <div className="mono text-xs text-soft">{c.cert} · {c.score}%</div>}</div>
              {c.passed ? <Badge value="PASSED" /> : <button className="btn" onClick={() => pass(i)}>Submit passing quiz</button>}
            </div>
          ))}
        </div>
        <ol className="mono space-y-1 text-xs text-soft">{s.log.map((l, i) => <li key={l + i} className="anim-slide-down">› {l}</li>)}</ol>
      </div>
    </div>
  );
}

function Infraction() {
  const THRESH = 5;
  const [pts, setPts] = useState(0);
  const [status, setStatus] = useState("ACTIVE");
  const [readiness, setReadiness] = useState("CERTIFIED");
  const [sev, setSev] = useState("VERBAL_WARNING");
  const [add, setAdd] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [n, setN] = useState(1);
  const issue = () => {
    const total = pts + add;
    const eff: string[] = [];
    let st = status, rd = readiness;
    if (sev === "WRITTEN_INFRACTION" || add >= 2) { rd = "RETRAINING_REQUIRED"; eff.push("remedial course assigned"); }
    if (sev === "TERMINATION") { st = "TERMINATED"; eff.push("status → TERMINATED"); }
    else if (sev === "SUSPENSION" || total >= THRESH) { st = "SUSPENDED"; eff.push(total >= THRESH && sev !== "SUSPENSION" ? `threshold ${THRESH} reached → SUSPENDED` : "status → SUSPENDED"); }
    setPts(total); setStatus(st); setReadiness(rd);
    setLog((l) => [`INF-2026-${String(n).padStart(3, "0")} ${sev.replace(/_/g, " ")} +${add} (total ${total})${eff.length ? " — " + eff.join(", ") : ""}`, ...l]);
    setN(n + 1);
  };
  const reset = () => { setPts(0); setStatus("ACTIVE"); setReadiness("CERTIFIED"); setLog([]); setN(1); };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-3">
        <p className="text-[13px] text-soft">Workspace rules: written infractions or 2+ points trigger retraining. {THRESH} points suspends automatically.</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="label">Severity</span>
            <select className="input" value={sev} onChange={(e) => setSev(e.target.value)}>
              {["VERBAL_WARNING", "WRITTEN_INFRACTION", "STRIKE_POINTS", "SUSPENSION", "TERMINATION"].map((v) => <option key={v} value={v}>{v.replace(/_/g, " ")}</option>)}
            </select></label>
          <label className="block"><span className="label">Points added</span>
            <input className="input mono" type="number" min={0} max={5} value={add} onChange={(e) => setAdd(Math.max(0, Math.min(5, Number(e.target.value) || 0)))} /></label>
        </div>
        <div className="flex gap-2"><button className="btn-primary" disabled={status === "TERMINATED"} onClick={issue}>Log infraction</button><button className="btn" onClick={reset}>Reset</button></div>
      </div>
      <div className="space-y-3">
        <div className="card p-3 text-[13px]">
          <div className="flex items-center justify-between"><span className="font-medium">Devon Pruitt</span><span className="mono text-soft">EMP-1005</span></div>
          <div className="mt-2 flex flex-wrap items-center gap-2"><span key={status} className="anim-pop inline-block"><Badge value={status} /></span><span key={readiness} className="anim-pop inline-block"><Badge value={readiness} /></span><span className="mono">{pts}/{THRESH} pts</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${Math.min(100, (pts / THRESH) * 100)}%` }} /></div>
        </div>
        <ol className="mono space-y-1 text-xs text-soft">{log.length === 0 ? <li>No cases yet.</li> : log.map((l, i) => <li key={l + i} className="anim-slide-down">› {l}</li>)}</ol>
      </div>
    </div>
  );
}

const QUIZ = [
  { q: "A trailer has no wheel chock. What do you do?", o: ["Load fast", "Stop and call the dock lead", "Use a pallet jack as a block", "Ask the driver to stay in the cab"], a: 1 },
  { q: "Manual lifts over what weight need two people or a cart?", o: ["20 lb", "40 lb", "75 lb", "100 lb"], a: 1 },
  { q: "Where do pedestrians walk?", o: ["Anywhere", "Green lanes only", "Between staging bays", "Behind lifts"], a: 1 },
  { q: "Forks while travelling should be:", o: ["4–6 in. off the floor", "At eye level", "Fully raised", "On the floor"], a: 0 },
  { q: "A near miss is reported:", o: ["Next week", "Same shift", "Only if hurt", "Never"], a: 1 },
];

function Quiz() {
  const PASS = 80;
  const [ans, setAns] = useState<(number | null)[]>(QUIZ.map(() => null));
  const [res, setRes] = useState<{ score: number; cert?: string } | null>(null);
  const submit = () => {
    const c = ans.filter((a, i) => a === QUIZ[i].a).length;
    const score = Math.round((c / QUIZ.length) * 100);
    setRes({ score, cert: score >= PASS ? `CERT-${50000 + Math.floor(Math.random() * 9999)}` : undefined });
  };
  return (
    <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
      <div className="space-y-3">
        {QUIZ.map((q, i) => (
          <fieldset key={i} className="text-[13px]" disabled={!!res?.cert}>
            <legend className="mb-1 font-medium">{i + 1}. {q.q}</legend>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {q.o.map((o, j) => (
                <button key={j} onClick={() => setAns((a) => a.map((x, k) => (k === i ? j : x)))} className={cn("rounded-md border px-2 py-1.5 text-left", ans[i] === j ? "border-accent bg-muted" : "border-line hover:bg-muted")}>{o}</button>
              ))}
            </div>
          </fieldset>
        ))}
        <button className="btn-primary" disabled={ans.some((a) => a === null) || !!res?.cert} onClick={submit}>Submit quiz</button>
      </div>
      <div className="space-y-3">
        <p className="text-[13px] text-soft">Passing score is {PASS}%. Grading happens on the server in the real app, so answers can&apos;t be tampered with.</p>
        {res && (
          <div className="card anim-pop p-3 text-[13px]">
            <div className="flex items-center justify-between"><span>Score</span><span className="mono text-lg font-semibold">{res.score}%</span></div>
            {res.cert ? (
              <div className="mt-2 space-y-1"><Badge value="PASSED" /><div className="mono text-xs text-soft">Certificate {res.cert}</div></div>
            ) : (
              <div className="mt-2 space-y-2"><Badge value="FAILED" /><p className="text-soft">Retake unlocks after a 15 minute cooldown. In this demo, retry now.</p><button className="btn" onClick={() => { setRes(null); setAns(QUIZ.map(() => null)); }}>Retry</button></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function Sandbox() {
  const [tab, setTab] = useState("life");
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line bg-muted px-4 py-2 text-xs text-soft">
        <span>Interactive demo. Nothing you do here is saved.</span>
        <span className="hidden sm:inline">Northside Supply &amp; Logistics (sample data)</span>
      </div>
      <div className="px-3"><Tabs value={tab} onChange={setTab} tabs={[{ id: "life", label: "Staff Lifecycle" }, { id: "inf", label: "Infraction & Retraining" }, { id: "quiz", label: "Quiz Certification" }]} /></div>
      <div className="p-4">{tab === "life" ? <Lifecycle /> : tab === "inf" ? <Infraction /> : <Quiz />}</div>
    </div>
  );
}
