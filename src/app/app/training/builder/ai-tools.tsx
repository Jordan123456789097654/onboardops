"use client";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { runAiTaskAction } from "@/actions/ai";
import { Field, useAction, useToast } from "@/components/ui";
import type { CourseDraft } from "./builder";

type Q = CourseDraft["questions"][number];
type L = CourseDraft["lessons"][number];
const blankQ = (q: Q) => !q.prompt.trim() && q.options.every((o) => !o.trim());
const blankL = (l: L) => !l.title.trim() && !l.contentMarkdown.trim();
const lessonsIn = (c: CourseDraft) => c.lessons.filter((l) => l.contentMarkdown.trim()).map((l) => ({ title: l.title || "Lesson", contentMarkdown: l.contentMarkdown }));

/** AI helpers for the course builder. Everything they return is a draft placed in the form; nothing is saved until you press Save. */
export function AiTools({ c, patch }: { c: CourseDraft; patch: (p: Partial<CourseDraft>) => void }) {
  const toast = useToast();
  const { exec, pending } = useAction();
  const [source, setSource] = useState("");
  const [nLessons, setNLessons] = useState(3);
  const [nQuestions, setNQuestions] = useState(6);
  const [language, setLanguage] = useState("Spanish");
  const [lessonIdx, setLessonIdx] = useState(0);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [issues, setIssues] = useState<{ lesson: number; problem: string; fix: string }[] | null>(null);
  const [summary, setSummary] = useState("");
  const have = lessonsIn(c);
  const hasContent = have.length > 0 || c.questions.some((q) => !blankQ(q));
  const ai = <T,>(task: string, input: unknown, ok: (d: T) => void) => exec(() => runAiTaskAction(task, input) as Promise<{ ok: true; data: T } | { ok: false; error: string }>, { onOk: ok });
  const reviewNote = () => toast("ok", "AI draft added. Read it before you save.");
  const addQuestions = (qs: { prompt: string; options: string[]; correctOptionIndex: number; explanation: string }[]) => { patch({ questions: [...c.questions.filter((q) => !blankQ(q)), ...qs] }); reviewNote(); };

  return (
    <section className="card space-y-4 border-accent/40 p-4 text-[13px]" aria-label="AI tools">
      <div className="flex flex-wrap items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /><h2 className="text-sm font-semibold">AI tools</h2><span className="rounded border border-line bg-muted px-1.5 py-0.5 text-[11px] text-soft">Draft only</span></div>
      <p className="text-xs text-soft">The text you use here is sent to our AI provider to write a draft. Do not paste anything private about a person. Results appear in the form below and nothing is saved until you press Save. AI can be wrong, so read everything.</p>

      <div className="space-y-2">
        <Field label="Paste a procedure, policy or notes"><textarea className="textarea" rows={5} value={source} onChange={(e) => setSource(e.target.value)} placeholder="For example: how to open the bar, the food safety rules, the cash handling policy…" /></Field>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block"><span className="label">Lessons</span><input className="input mono !w-20" type="number" min={1} max={8} value={nLessons} onChange={(e) => setNLessons(Number(e.target.value))} /></label>
          <label className="block"><span className="label">Questions</span><input className="input mono !w-20" type="number" min={3} max={20} value={nQuestions} onChange={(e) => setNQuestions(Number(e.target.value))} /></label>
          <button className="btn-primary" disabled={pending || source.trim().length < 80} onClick={() => {
            if (hasContent && !confirm("Replace the lessons and questions already in this form with the AI draft?")) return;
            ai<{ title: string; description: string; lessons: { title: string; contentMarkdown: string; minReadSeconds: number }[]; questions: Q[] }>("course.draft", { source, lessons: nLessons, questions: nQuestions }, (d) => {
              patch({ title: c.title.trim() ? c.title : d.title, description: c.description.trim() ? c.description : d.description, lessons: d.lessons.map((l) => ({ ...l, videoUrl: "" })), questions: d.questions.map((q) => ({ ...q })) });
              reviewNote();
            });
          }}>Draft a course</button>
          <button className="btn" disabled={pending || source.trim().length < 200} title="Condense a long policy into one lesson of about three minutes" onClick={() => ai<L>("policy.lesson", { source }, (d) => { patch({ lessons: [...c.lessons.filter((l) => !blankL(l)), { ...d, videoUrl: "" }] }); reviewNote(); })}>Make a 3-minute lesson</button>
        </div>
      </div>

      <div className="space-y-3 border-t border-line pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-soft">Improve what you have</h3>
        {!have.length && <p className="text-xs text-soft">Add lesson text first. These buttons use the lessons in the form.</p>}
        <div className="flex flex-wrap gap-2">
          {([["more", "Add 5 questions"], ["scenario", "Scenario questions"], ["refresher", "Refresher quiz"]] as const).map(([style, label]) => (
            <button key={style} className="btn" disabled={pending || !have.length} onClick={() => ai<{ questions: Q[] }>("quiz.more", { lessons: have, existing: c.questions.filter((q) => !blankQ(q)).map((q) => q.prompt), count: 5, style }, (d) => addQuestions(d.questions))}>{label}</button>
          ))}
          <button className="btn" disabled={pending || !have.length} onClick={() => ai<{ lessons: { number: number; minReadSeconds: number }[]; passingScore: number; reason: string }>("course.meta", { lessons: have, questionCount: Math.max(1, c.questions.filter((q) => !blankQ(q)).length) }, (d) => {
            const times = new Map(d.lessons.map((x) => [x.number, x.minReadSeconds]));
            let n = 0; patch({ passingScore: d.passingScore, lessons: c.lessons.map((l) => (l.contentMarkdown.trim() ? { ...l, minReadSeconds: times.get(++n) ?? l.minReadSeconds } : l)) });
            toast("ok", `Pass mark ${d.passingScore}%. ${d.reason}`);
          })}>Suggest reading times and pass mark</button>
          <button className="btn" disabled={pending || !have.length} onClick={() => ai<{ summary: string; issues: { lesson: number; problem: string; fix: string }[] }>("lesson.clarity", { lessons: have }, (d) => { setIssues(d.issues); setSummary(d.summary); })}>Check for unclear parts</button>
        </div>
        {issues && (
          <div className="rounded-md border border-line bg-muted p-3">
            <p className="font-medium">{issues.length ? `${issues.length} thing${issues.length === 1 ? "" : "s"} to look at` : "No problems found."}{summary ? ` ${summary}` : ""}</p>
            {issues.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5">{issues.map((x, i) => <li key={i}><strong>Lesson {x.lesson}:</strong> {x.problem}{x.fix ? <span className="text-soft"> Fix: {x.fix}</span> : null}</li>)}</ul>}
            <button className="mt-2 text-xs text-soft underline" onClick={() => setIssues(null)}>Dismiss</button>
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <label className="block"><span className="label">Simpler wording for</span><select className="input !w-44" value={lessonIdx} onChange={(e) => setLessonIdx(Number(e.target.value))}>{c.lessons.map((l, i) => <option key={i} value={i}>{`Lesson ${i + 1}${l.title ? `: ${l.title}`.slice(0, 24) : ""}`}</option>)}</select></label>
          <button className="btn" disabled={pending || !c.lessons[lessonIdx]?.contentMarkdown.trim()} onClick={() => ai<{ contentMarkdown: string }>("lesson.simplify", { contentMarkdown: c.lessons[lessonIdx].contentMarkdown, level: "simple" }, (d) => { patch({ lessons: c.lessons.map((l, k) => (k === lessonIdx ? { ...l, contentMarkdown: d.contentMarkdown } : l)) }); reviewNote(); })}>Simplify</button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block"><span className="label">Better wrong answers for</span><select className="input !w-44" value={questionIdx} onChange={(e) => setQuestionIdx(Number(e.target.value))}>{c.questions.map((q, i) => <option key={i} value={i}>{`Question ${i + 1}`}</option>)}</select></label>
          <button className="btn" disabled={pending || !c.questions[questionIdx]?.prompt.trim() || !c.questions[questionIdx]?.options[c.questions[questionIdx].correctOptionIndex]?.trim()} onClick={() => { const q = c.questions[questionIdx]; ai<{ options: string[]; correctOptionIndex: number }>("quiz.options", { prompt: q.prompt, correct: q.options[q.correctOptionIndex], lessons: lessonsIn(c).map((l) => l.contentMarkdown).join("\n\n").slice(0, 10000) }, (d) => { patch({ questions: c.questions.map((x, k) => (k === questionIdx ? { ...x, options: d.options, correctOptionIndex: d.correctOptionIndex } : x)) }); reviewNote(); }); }}>Rewrite the options</button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block"><span className="label">Translate to</span><input className="input !w-40" value={language} onChange={(e) => setLanguage(e.target.value)} list="ai-langs" /><datalist id="ai-langs">{["Spanish", "French", "Portuguese", "Vietnamese", "Chinese", "Arabic", "Tagalog", "Haitian Creole"].map((l) => <option key={l} value={l} />)}</datalist></label>
          <button className="btn" disabled={pending || !have.length || language.trim().length < 2} title="Makes a separate, unsaved copy in that language" onClick={() => ai<{ title: string; description: string; lessons: { title: string; contentMarkdown: string }[]; questions: { prompt: string; options: string[]; explanation: string }[] }>("course.translate", { language, title: c.title, description: c.description, lessons: have, questions: c.questions.filter((q) => !blankQ(q)).map((q) => ({ prompt: q.prompt, options: q.options, explanation: q.explanation })) }, (d) => {
            const real = c.questions.filter((q) => !blankQ(q));
            patch({ id: undefined, isPublished: false, title: d.title, description: d.description, lessons: d.lessons.map((l, i) => ({ ...l, videoUrl: "", minReadSeconds: c.lessons.filter((x) => x.contentMarkdown.trim())[i]?.minReadSeconds ?? 30 })), questions: d.questions.map((q, i) => ({ ...q, correctOptionIndex: real[i]?.correctOptionIndex ?? 0 })) });
            toast("ok", `Translated copy ready. It is a new, unsaved course; the original is unchanged. Have a fluent speaker check it.`);
          })}>Translate (new copy)</button>
        </div>
      </div>
      {pending && <p className="text-xs text-soft" role="status">Working… this can take up to a minute.</p>}
    </section>
  );
}
