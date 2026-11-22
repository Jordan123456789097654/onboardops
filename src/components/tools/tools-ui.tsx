"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { Field } from "@/components/ui";
import { DISCLAIMER, advise, buildWriteUp, defaultRules, handbookMarkdown, handbookSections, industries, saveDraft, severityFor, signOffSheet, toneCheck, topics, type Answers, type Draft, type Rule, type WriteUp } from "@/lib/tools";

function Copy({ text, label = "Copy text" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return <button type="button" className="btn" onClick={() => { navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); }).catch(() => {}); }}>{ok ? "Copied" : label}</button>;
}

function SaveBar({ draft, what }: { draft: Draft; what: string }) {
  const [saved, setSaved] = useState(false);
  return (
    <div className="rounded-lg border border-line bg-muted p-3 text-[13px]">
      <p className="text-soft">Want this in a real workspace? Save it here, then create a free workspace. We will offer to add it as {what}. It stays in your browser until you sign up.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className="btn" onClick={() => setSaved(saveDraft(draft))}>Save my draft</button>
        {saved && <Link className="btn-primary" href="/register">Create a free workspace</Link>}
        {saved && <span className="text-xs text-emerald-700 dark:text-emerald-300">Saved on this device.</span>}
      </div>
    </div>
  );
}
const Note = () => <p className="text-xs leading-relaxed text-soft">{DISCLAIMER}</p>;
const Print = () => <button type="button" className="btn" onClick={() => window.print()}>Print or save as PDF</button>;

/* ------------------------------------------------ Write-up helper */
export function WriteUpHelper() {
  const [w, setW] = useState<WriteUp>({ employee: "", date: "", time: "", place: "", facts: "", policy: "", prior: "none", expected: "", followUp: "", witnesses: "" });
  const set = (k: keyof WriteUp) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setW({ ...w, [k]: e.target.value });
  const text = useMemo(() => buildWriteUp(w), [w]);
  const tips = toneCheck(`${w.facts} ${w.expected}`);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="no-print space-y-3 text-[13px]">
        <div className="grid grid-cols-2 gap-3"><Field label="Employee name (optional)"><input className="input" value={w.employee} onChange={set("employee")} /></Field><Field label="Earlier steps on this issue"><select className="input" value={w.prior} onChange={set("prior")}><option value="none">None</option><option value="coaching">Coaching talk</option><option value="verbal">Verbal warning</option><option value="written">Written warning</option></select></Field></div>
        <div className="grid grid-cols-3 gap-3"><Field label="Date it happened"><input className="input" type="date" value={w.date} onChange={set("date")} /></Field><Field label="Time (optional)"><input className="input" value={w.time} onChange={set("time")} placeholder="2:10 PM" /></Field><Field label="Place"><input className="input" value={w.place} onChange={set("place")} placeholder="Dock 4" /></Field></div>
        <Field label="What happened (facts only: what you saw, heard or the records show)"><textarea className="textarea" rows={5} value={w.facts} onChange={set("facts")} placeholder="Arrived at 9:22 for a 9:00 start. Third late arrival in 30 days: Oct 3, Oct 17, Oct 27." /></Field>
        {tips.length > 0 && <ul className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">{tips.map((t) => <li key={t}>• {t}</li>)}</ul>}
        <Field label="Policy or expectation that was not met"><input className="input" value={w.policy} onChange={set("policy")} placeholder="Attendance policy, section 2: arrive at your scheduled start time" /></Field>
        <Field label="What should change"><textarea className="textarea" rows={2} value={w.expected} onChange={set("expected")} placeholder="Arrive on time, or call your supervisor at least 60 minutes before the shift if you will be late." /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Follow-up date"><input className="input" type="date" value={w.followUp} onChange={set("followUp")} /></Field><Field label="Witnesses (optional)"><input className="input" value={w.witnesses} onChange={set("witnesses")} /></Field></div>
      </div>
      <div className="space-y-3">
        <pre className="max-h-[34rem] overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-surface p-4 text-[12px] leading-relaxed" aria-label="Draft write-up">{text}</pre>
        <div className="no-print flex flex-wrap gap-2"><Copy text={text} /><Print /></div>
        <div className="no-print"><SaveBar draft={{ kind: "caseTemplate", name: `Write-up: ${w.policy.slice(0, 50) || "draft"}`, severity: severityFor(w.prior), policy: w.policy || "Policy", summary: w.facts || "Describe what happened." }} what="a corrective-action template" /></div>
        <Note />
      </div>
    </div>
  );
}

/* ------------------------------------------------ Should I write this up */
export function ShouldIHelper() {
  const [a, setA] = useState<Answers>({ sensitive: "no", told: "yes", times: "first", harm: "none", fair: "yes" });
  const [shown, setShown] = useState(false);
  const adv = useMemo(() => advise(a), [a]);
  const Q = ({ k, label, opts }: { k: keyof Answers; label: string; opts: [string, string][] }) => (
    <fieldset className="space-y-1.5"><legend className="text-[13px] font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">{opts.map(([v, l]) => <label key={v} className={`cursor-pointer rounded-md border px-3 py-1.5 text-[13px] ${a[k] === v ? "border-accent bg-muted font-medium" : "border-line"}`}><input type="radio" className="sr-only" name={k} checked={a[k] === v} onChange={() => { setA({ ...a, [k]: v } as Answers); setShown(false); }} />{l}</label>)}</div></fieldset>
  );
  const tone = { pause: "border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100", fix: "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100", final: "border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100", coaching: "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100", verbal: "border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100", written: "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100" }[adv.level];
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <div className="space-y-5">
        <Q k="sensitive" label="Does this involve harassment, discrimination, threats or violence, an injury, theft, protected leave or medical issues, or a complaint about someone?" opts={[["no", "No"], ["yes", "Yes"]]} />
        <Q k="told" label="Was the employee clearly told this expectation before?" opts={[["yes", "Yes"], ["no", "No"], ["unsure", "Not sure"]]} />
        <Q k="times" label="How many times has it happened?" opts={[["first", "First time"], ["second", "Second time"], ["repeat", "Three or more"]]} />
        <Q k="harm" label="Did it cause harm or risk?" opts={[["none", "None"], ["minor", "Minor"], ["serious", "Serious"]]} />
        <Q k="fair" label="Have others who did the same thing been treated the same way?" opts={[["yes", "Yes"], ["unsure", "Not sure"], ["no", "No"]]} />
        <button className="btn-primary" onClick={() => setShown(true)}>Show my suggestion</button>
      </div>
      <div aria-live="polite">
        {shown ? (
          <div className={`space-y-3 rounded-lg border p-5 text-[13px] ${tone}`}>
            <h2 className="text-base font-semibold">{adv.title}</h2>
            <div><div className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-70">Why</div><ul className="list-disc space-y-1 pl-5">{adv.reasons.map((r) => <li key={r}>{r}</li>)}</ul></div>
            <div><div className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-70">Next steps</div><ul className="list-disc space-y-1 pl-5">{adv.next.map((r) => <li key={r}>{r}</li>)}</ul></div>
            {(adv.level === "verbal" || adv.level === "written" || adv.level === "coaching") && <Link className="btn" href="/tools/write-up-helper">Draft the write-up</Link>}
          </div>
        ) : <div className="rounded-lg border border-dashed border-line p-5 text-[13px] text-soft">Answer the questions, then choose Show my suggestion.</div>}
        <div className="mt-3"><Note /></div>
      </div>
    </div>
  );
}

/* ------------------------------------------------ Policy builder */
export function PolicyBuilder() {
  const [topicId, setTopicId] = useState(topics[0].id);
  const topic = topics.find((t) => t.id === topicId)!;
  const [company, setCompany] = useState("");
  const [vals, setVals] = useState<Record<string, Record<string, string | number | boolean>>>({});
  const v = { ...Object.fromEntries(topic.fields.map((f) => [f.key, f.def])), ...(vals[topicId] ?? {}) };
  const md = topic.build(v, company || "[Company]");
  const sheet = signOffSheet(topic.name, company);
  const [view, setView] = useState<"policy" | "sheet">("policy");
  const set = (k: string, val: string | number | boolean) => setVals({ ...vals, [topicId]: { ...(vals[topicId] ?? {}), [k]: val } });
  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="no-print space-y-3 text-[13px]">
        <Field label="Policy topic"><select className="input" value={topicId} onChange={(e) => setTopicId(e.target.value)}>{topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
        <Field label="Company name"><input className="input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Northside Supply" /></Field>
        {topic.fields.map((f) => (
          <Field key={f.key} label={f.label}>
            {f.type === "select" ? <select className="input" value={String(v[f.key])} onChange={(e) => set(f.key, e.target.value)}>{f.options!.map((o) => <option key={o}>{o}</option>)}</select>
              : f.type === "yesno" ? <select className="input" value={String(v[f.key])} onChange={(e) => set(f.key, e.target.value === "true")}><option value="true">Yes</option><option value="false">No</option></select>
              : <input className="input" type={f.type === "number" ? "number" : "text"} value={String(v[f.key])} onChange={(e) => set(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)} />}
          </Field>
        ))}
      </div>
      <div className="space-y-3">
        <div className="no-print flex flex-wrap gap-2"><button className={`btn ${view === "policy" ? "!border-accent text-accent" : ""}`} onClick={() => setView("policy")}>Policy</button><button className={`btn ${view === "sheet" ? "!border-accent text-accent" : ""}`} onClick={() => setView("sheet")}>Sign-off sheet</button><Copy text={view === "policy" ? md : sheet} label="Copy" /><Print /></div>
        <div className="legal rounded-lg border border-line bg-surface p-5 text-[13px] leading-relaxed [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_table]:w-full [&_table]:border-collapse [&_td]:h-9 [&_td]:border [&_td]:border-line [&_th]:border [&_th]:border-line [&_th]:p-1.5 [&_th]:text-left [&_ul]:list-disc"><ReactMarkdown>{view === "policy" ? md : sheet}</ReactMarkdown></div>
        <div className="no-print"><SaveBar draft={{ kind: "policy", title: topic.name, markdown: md }} what="an unpublished policy" /></div>
        <Note />
      </div>
    </div>
  );
}

/* ------------------------------------------------ Discipline ladder */
export function LadderBuilder() {
  const [rules, setRules] = useState<Rule[]>(defaultRules());
  const [company, setCompany] = useState("");
  const set = (i: number, p: Partial<Rule>) => setRules((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="no-print space-y-3 text-[13px]">
        <Field label="Company name"><input className="input" value={company} onChange={(e) => setCompany(e.target.value)} /></Field>
        {rules.map((r, i) => (
          <div key={r.whenSeverity} className="grid grid-cols-[1fr_5rem_6rem] items-end gap-2 rounded-md border border-line p-3">
            <div className="col-span-3 font-medium">Step {i + 1}: {r.label} lead to {r.escalateLabel}</div>
            <div className="text-xs text-soft">This many {r.label.toLowerCase()}</div>
            <input aria-label="Count" className="input mono" type="number" min={2} max={10} value={r.count} onChange={(e) => set(i, { count: Number(e.target.value) })} />
            <div className="flex items-center gap-1"><input aria-label="Days" className="input mono" type="number" min={7} max={730} value={r.withinDays} onChange={(e) => set(i, { withinDays: Number(e.target.value) })} /><span className="text-xs text-soft">days</span></div>
          </div>
        ))}
        <SaveBar draft={{ kind: "ladder", rules: rules.map((r) => ({ whenSeverity: r.whenSeverity, count: r.count, withinDays: r.withinDays, escalateTo: r.escalateTo })) }} what="progressive discipline rules" />
      </div>
      <div className="space-y-3">
        <div className="no-print flex gap-2"><Print /></div>
        <div className="rounded-lg border border-line bg-surface p-5 text-[13px] leading-relaxed">
          <h2 className="text-lg font-semibold">{company || "Our"} progressive discipline ladder</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            <li><strong>Coaching conversation.</strong> An informal private talk. Noted privately. Not a warning.</li>
            <li><strong>Verbal warning.</strong> A formal conversation with a written record.</li>
            <li><strong>Written warning.</strong> A signed document that names the policy and what must change.</li>
            <li><strong>Final step.</strong> A suspension or final warning, reviewed with HR first.</li>
            <li><strong>Termination review.</strong> Only after the earlier steps, or for serious conduct that may skip steps.</li>
          </ol>
          <h3 className="mt-4 font-semibold">When steps repeat</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5">{rules.map((r) => <li key={r.whenSeverity}>{r.count} {r.label.toLowerCase()} within {r.withinDays} days lead to {r.escalateLabel}.</li>)}</ul>
          <h3 className="mt-4 font-semibold">Fair process</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5"><li>Every employee can add a written response and appeal to someone who did not issue the warning.</li><li>The same rule is applied the same way for everyone.</li><li>Serious conduct such as violence, theft or serious safety violations may skip steps.</li></ul>
        </div>
        <Note />
      </div>
    </div>
  );
}

/* ------------------------------------------------ Handbook outline */
export function HandbookOutline() {
  const [industry, setIndustry] = useState<string>(industries[0]);
  const [size, setSize] = useState<"1-10" | "11-50" | "51-200">("11-50");
  const [remote, setRemote] = useState(false);
  const [company, setCompany] = useState("");
  const all = useMemo(() => handbookSections(industry, size, remote), [industry, size, remote]);
  const [off, setOff] = useState<string[]>([]);
  const chosen = all.filter((s) => !off.includes(s));
  const md = handbookMarkdown(chosen, company);
  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <div className="no-print space-y-3 text-[13px]">
        <Field label="Company name"><input className="input" value={company} onChange={(e) => setCompany(e.target.value)} /></Field>
        <Field label="Industry"><select className="input" value={industry} onChange={(e) => { setIndustry(e.target.value); setOff([]); }}>{industries.map((i) => <option key={i}>{i}</option>)}</select></Field>
        <Field label="Team size"><select className="input" value={size} onChange={(e) => setSize(e.target.value as typeof size)}><option value="1-10">1 to 10</option><option value="11-50">11 to 50</option><option value="51-200">51 to 200</option></select></Field>
        <label className="flex items-center gap-2"><input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} />Some people work remotely</label>
      </div>
      <div className="space-y-3">
        <div className="no-print flex flex-wrap gap-2"><Copy text={md} /><Print /></div>
        <ol className="space-y-1 rounded-lg border border-line bg-surface p-4 text-[13px]">{all.map((s, i) => (
          <li key={s} className="flex items-start gap-2"><input type="checkbox" className="no-print mt-0.5" checked={!off.includes(s)} onChange={() => setOff(off.includes(s) ? off.filter((x) => x !== s) : [...off, s])} aria-label={`Include ${s}`} /><span className={off.includes(s) ? "text-soft line-through print:hidden" : ""}>{i + 1}. {s}</span></li>
        ))}</ol>
        <div className="no-print"><SaveBar draft={{ kind: "policy", title: "Employee handbook outline", markdown: md }} what="an unpublished policy" /></div>
        <Note />
      </div>
    </div>
  );
}
