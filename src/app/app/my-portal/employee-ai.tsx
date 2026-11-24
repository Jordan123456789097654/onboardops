"use client";
import { useState } from "react";
import { ChevronDown, Copy, Sparkles } from "lucide-react";
import { runAiTaskAction } from "@/actions/ai";
import { askPolicyAction, weekSummaryAction, type PolicyAnswer } from "@/actions/ai-insights";
import { Field, useAction, useToast } from "@/components/ui";
import { ReadAloud } from "@/components/read-aloud";
import { cn } from "@/lib/utils";

type Tab = "policy" | "week" | "message";
type Draft = { message: string; tips: string[] };
const KINDS: [string, string][] = [["call_out", "Call out of a shift"], ["time_off", "Ask for time off"], ["late", "Running late"], ["shift_swap", "Swap a shift"], ["other", "Something else"]];
const EXAMPLES = ["How much notice do I need to call out?", "What is the dress code?", "What happens if I clock in late?"];

/** Helpers for employees: ask about the policies they follow, get a quick look at their week, draft a message to a manager. Drafts only; nothing is sent or saved. */
export function EmployeeAi({ aiCare }: { aiCare: boolean }) {
  const toast = useToast();
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("policy");
  const [q, setQ] = useState("");
  const [policy, setPolicy] = useState<PolicyAnswer | null>(null);
  const [week, setWeek] = useState<{ summary: string; todo: string[] } | null>(null);
  const [f, setF] = useState({ kind: "call_out", when: "", reason: "", tone: "polite" });
  const [draft, setDraft] = useState<Draft | null>(null);

  const tabs: [Tab, string, boolean][] = [["policy", "Ask about policies", true], ["week", "My week", true], ["message", "Message my manager", aiCare]];
  const ask = (text?: string) => {
    const question = (text ?? q).trim();
    if (question.length < 3) return;
    setQ(question);
    exec(() => askPolicyAction({ question }), { onOk: setPolicy });
  };

  return (
    <div className="card mb-6 overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" aria-expanded={open}>
        <span className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-accent" />AI helper<span className="hidden text-[12.5px] font-normal text-soft sm:inline">Ask about policies, check your week, write a message</span></span>
        <ChevronDown className={cn("h-4 w-4 text-soft transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-line px-4 py-4 text-[13px]">
          <div className="flex flex-wrap gap-1.5">
            {tabs.filter((t) => t[2]).map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} className={cn("rounded-md border px-3 py-1.5 text-[12.5px]", tab === id ? "border-accent bg-muted font-medium text-accent" : "border-line hover:bg-muted")}>{label}</button>)}
          </div>

          {tab === "policy" && (
            <div className="space-y-3">
              <p className="text-soft">Ask a question and get an answer from your company&apos;s policies. It only uses the policies you&apos;re given, and it can&apos;t tell you what discipline to expect.</p>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(); }}>
                <input className="input flex-1" value={q} onChange={(e) => setQ(e.target.value)} maxLength={300} placeholder="e.g. How much notice do I need to call out?" aria-label="Your question" />
                <button className="btn-primary" disabled={pending || q.trim().length < 3}>{pending ? "Looking…" : "Ask"}</button>
              </form>
              <div className="flex flex-wrap gap-1.5">{EXAMPLES.map((ex) => <button key={ex} type="button" disabled={pending} onClick={() => ask(ex)} className="rounded-full border border-line bg-muted px-2.5 py-0.5 text-[11.5px] text-soft hover:text-ink">{ex}</button>)}</div>
              {policy && (
                <div className={cn("space-y-2 rounded-lg border p-4", policy.found ? "border-accent/30 bg-accent/5" : "border-line bg-muted")}>
                  <p className="whitespace-pre-wrap leading-relaxed">{policy.answer}</p>
                  {policy.sources.length > 0 && <p className="text-xs text-soft">From: {policy.sources.map((s) => s.title).join(", ")}. Open the Policies tab to read the full policy.</p>}
                  <div className="flex items-center gap-3"><ReadAloud text={policy.answer} /><span className="text-[11.5px] text-soft">AI can be wrong. When it matters, check the policy or ask your manager.</span></div>
                </div>
              )}
            </div>
          )}

          {tab === "week" && (
            <div className="space-y-3">
              <p className="text-soft">A quick look at your next few days: shifts, training to finish, credentials running out, policies to sign. Built from your own records.</p>
              <button className="btn-primary" disabled={pending} onClick={() => exec(() => weekSummaryAction(), { onOk: setWeek })}>{pending ? "Checking…" : week ? "Refresh" : "Show my week"}</button>
              {week && (
                <div className="space-y-2 rounded-lg border border-accent/30 bg-accent/5 p-4">
                  <p className="whitespace-pre-wrap leading-relaxed">{week.summary}</p>
                  {week.todo.length > 0 && <ul className="list-disc space-y-0.5 pl-5 text-soft">{week.todo.map((t, i) => <li key={i}>{t}</li>)}</ul>}
                  <ReadAloud text={`${week.summary} ${week.todo.join(". ")}`} />
                </div>
              )}
            </div>
          )}

          {tab === "message" && (
            <div className="space-y-3">
              <p className="text-soft">Write what you need and AI drafts a short, polite message. Nothing is sent. Copy it, or use the Requests tab for an official request. Please don&apos;t include medical details.</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="What is it about?"><select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
                <Field label="When"><input className="input" value={f.when} onChange={(e) => setF({ ...f, when: e.target.value })} maxLength={120} placeholder="e.g. Friday's closing shift" /></Field>
                <Field label="Tone"><select className="input" value={f.tone} onChange={(e) => setF({ ...f, tone: e.target.value })}><option value="polite">Polite</option><option value="brief">Brief</option></select></Field>
              </div>
              <Field label="Reason (optional)"><textarea className="textarea" rows={2} maxLength={500} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Keep it short. You can leave this blank." /></Field>
              <button className="btn-primary" disabled={pending} onClick={() => exec(() => runAiTaskAction("request.draft", { kind: f.kind, when: f.when.trim() || undefined, reason: f.reason.trim() || undefined, tone: f.tone }) as Promise<{ ok: true; data: Draft } | { ok: false; error: string }>, { onOk: setDraft })}>{pending ? "Writing…" : "Write my message"}</button>
              {draft && (
                <div className="space-y-2 rounded-lg border border-accent/30 bg-accent/5 p-4">
                  <p className="whitespace-pre-wrap leading-relaxed">{draft.message}</p>
                  {draft.tips.length > 0 && <ul className="list-disc space-y-0.5 pl-5 text-xs text-soft">{draft.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>}
                  <button type="button" className="btn !h-8" onClick={() => { void navigator.clipboard.writeText(draft.message); toast("ok", "Copied"); }}><Copy className="h-3.5 w-3.5" />Copy</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
