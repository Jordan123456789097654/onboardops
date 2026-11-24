"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Copy, Sparkles } from "lucide-react";
import { runAiTaskAction } from "@/actions/ai";
import { askDataAction, huddleAgendaAction, type DataAnswer, type HuddleResult } from "@/actions/ai-insights";
import { Field, useAction, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";

type Tab = "ask" | "huddle" | "handoff";
const EXAMPLES = ["Who has training past due?", "Which licenses expire in the next 60 days?", "How are my new hires doing?", "Who failed a quiz this month?"];

/** Manager-only AI helpers: ask a plain question about your team, plan a huddle, tidy a shift handoff. Everything it shows is a draft or a report; nothing is saved. */
export function ManagerAi({ canReports, canHandoff }: { canReports: boolean; canHandoff: boolean }) {
  const toast = useToast();
  const { exec, pending } = useAction();
  const first: Tab = canReports ? "ask" : "handoff";
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>(first);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<DataAnswer | null>(null);
  const [minutes, setMinutes] = useState(10);
  const [focus, setFocus] = useState("");
  const [huddle, setHuddle] = useState<HuddleResult | null>(null);
  const [notes, setNotes] = useState("");
  const [handoff, setHandoff] = useState<{ note: string; flags: string[] } | null>(null);

  const tabs: [Tab, string, boolean][] = [["ask", "Ask your data", canReports], ["huddle", "Huddle agenda", canReports], ["handoff", "Shift handoff", canHandoff]];
  const copy = (t: string) => { void navigator.clipboard.writeText(t); toast("ok", "Copied"); };

  const ask = (text?: string) => {
    const question = (text ?? q).trim();
    if (question.length < 3) return;
    setQ(question);
    exec(() => askDataAction({ question }), { onOk: setAnswer });
  };

  return (
    <div className="card mb-4 overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" aria-expanded={open}>
        <span className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-accent" />AI assistant<span className="hidden text-[12.5px] font-normal text-soft sm:inline">Ask about your team, plan a huddle, tidy a handoff</span></span>
        <ChevronDown className={cn("h-4 w-4 text-soft transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-line px-4 py-4 text-[13px]">
          <div className="flex flex-wrap gap-1.5">
            {tabs.filter((t) => t[2]).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setTab(id)} className={cn("rounded-md border px-3 py-1.5 text-[12.5px]", tab === id ? "border-accent bg-muted font-medium text-accent" : "border-line hover:bg-muted")}>{label}</button>
            ))}
          </div>

          {tab === "ask" && (
            <div className="space-y-3">
              <p className="text-soft">Ask in plain words. AI only picks the right report; the numbers and names come straight from your records, and only what your role can see.</p>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(); }}>
                <input className="input flex-1" value={q} onChange={(e) => setQ(e.target.value)} maxLength={300} placeholder="e.g. Who has training past due?" aria-label="Your question" />
                <button className="btn-primary" disabled={pending || q.trim().length < 3}>{pending ? "Looking…" : "Ask"}</button>
              </form>
              <div className="flex flex-wrap gap-1.5">{EXAMPLES.map((ex) => <button key={ex} type="button" disabled={pending} onClick={() => ask(ex)} className="rounded-full border border-line bg-muted px-2.5 py-0.5 text-[11.5px] text-soft hover:text-ink">{ex}</button>)}</div>
              {answer?.kind === "none" && <p className="rounded-lg border border-line bg-muted p-3">{answer.note}</p>}
              {answer?.kind === "table" && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-sm font-semibold">{answer.title}</h3><span className="mono text-xs text-soft">{answer.total} {answer.total === 1 ? "result" : "results"}{answer.total > answer.rows.length ? `, showing ${answer.rows.length}` : ""}</span></div>
                  {answer.note && <p className="text-xs text-soft">{answer.note}</p>}
                  {answer.rows.length === 0 ? <p className="rounded-lg border border-line bg-muted p-3">Nothing to show. That's good news.</p> : (
                    <div className="max-h-80 overflow-auto rounded-lg border border-line">
                      <table className="w-full border-collapse text-[12.5px]">
                        <thead><tr>{answer.columns.map((c) => <th key={c} className="th">{c}</th>)}</tr></thead>
                        <tbody>{answer.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="td">{c}</td>)}</tr>)}</tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === "huddle" && (
            <div className="space-y-3">
              <p className="text-soft">Builds a short agenda from your live numbers (overdue training, expiring credentials, new hires, incidents). No names are sent to the AI.</p>
              <div className="grid gap-3 sm:grid-cols-[120px_1fr_auto] sm:items-end">
                <Field label="Length"><select className="input" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>{[5, 10, 15, 20].map((m) => <option key={m} value={m}>{m} minutes</option>)}</select></Field>
                <Field label="Focus (optional)"><input className="input" value={focus} onChange={(e) => setFocus(e.target.value)} maxLength={200} placeholder="e.g. safety, new hires" /></Field>
                <button className="btn-primary" disabled={pending} onClick={() => exec(() => huddleAgendaAction({ minutes, focus: focus.trim() || undefined }), { onOk: setHuddle })}>{pending ? "Planning…" : "Plan huddle"}</button>
              </div>
              {huddle && (
                <div className="space-y-3 rounded-lg border border-accent/30 bg-accent/5 p-4">
                  <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">{huddle.ai.title}</h3><button type="button" className="btn !h-7 !text-xs" onClick={() => copy(`${huddle.ai.title}\n\n${huddle.ai.items.map((i) => `${i.topic} (${i.minutes} min)\n${i.points.map((p) => `- ${p}`).join("\n")}`).join("\n\n")}`)}><Copy className="h-3 w-3" />Copy</button></div>
                  <ol className="space-y-3">{huddle.ai.items.map((it, i) => <li key={i}><div className="flex items-baseline justify-between gap-2 font-medium"><span>{i + 1}. {it.topic}</span><span className="mono text-xs text-soft">{it.minutes} min</span></div><ul className="mt-1 list-disc space-y-0.5 pl-5 text-soft">{it.points.map((p, j) => <li key={j}>{p}</li>)}</ul></li>)}</ol>
                  <p className="text-[11.5px] text-soft">Based on: {Object.entries(huddle.facts).filter(([, v]) => typeof v === "number").map(([k, v]) => `${k.replace(/([A-Z])/g, " $1").toLowerCase()} ${v}`).join(", ")}.</p>
                </div>
              )}
            </div>
          )}

          {tab === "handoff" && (
            <div className="space-y-3">
              <p className="text-soft">Jot rough notes. AI turns them into a clear handoff for the next shift. Names are hidden from the AI and put back afterwards.</p>
              <textarea className="textarea w-full" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={3000} placeholder={"dock 2 door sticking, called maintenance around 2\nreceiving done early\nsam out thursday, need cover"} aria-label="Rough handoff notes" />
              <button className="btn-primary" disabled={pending || notes.trim().length < 10} onClick={() => exec(() => runAiTaskAction("handoff.draft", { bullets: notes }) as Promise<{ ok: true; data: { note: string; flags: string[] } } | { ok: false; error: string }>, { onOk: setHandoff })}>{pending ? "Writing…" : "Write handoff"}</button>
              {handoff && (
                <div className="space-y-2 rounded-lg border border-accent/30 bg-accent/5 p-4">
                  <p className="whitespace-pre-wrap leading-relaxed">{handoff.note}</p>
                  {handoff.flags.length > 0 && <ul className="list-disc space-y-0.5 pl-5 text-xs text-amber-700 dark:text-amber-400">{handoff.flags.map((f, i) => <li key={i}>{f}</li>)}</ul>}
                  <div className="flex flex-wrap gap-2"><button type="button" className="btn !h-8" onClick={() => copy(handoff.note)}><Copy className="h-3.5 w-3.5" />Copy</button><Link href="/app/handoff" className="btn !h-8">Open handoff notes</Link></div>
                  <p className="text-[11.5px] text-soft">AI wrote this draft from your notes. Check it before sharing.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
