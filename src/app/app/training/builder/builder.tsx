"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveCourseAction } from "@/actions/courses";
import { Field, PageHeader, useAction } from "@/components/ui";
import { AiTools } from "./ai-tools";

export type CourseDraft = {
  id?: string; title: string; description: string; category: string; passingScore: number; cooldownMinutes: number; isRemedial: boolean; isPublished: boolean; validityDays: number | null; defaultDueDays: number;
  quizQuestionCount: number | null; shuffleQuestions: boolean; shuffleOptions: boolean; prerequisiteIds: string[];
  lessons: { title: string; contentMarkdown: string; videoUrl: string; minReadSeconds: number }[];
  questions: { id?: string; prompt: string; options: string[]; correctOptionIndex: number; explanation: string }[];
};

export function Builder({ initial, otherCourses, ai = false }: { initial: CourseDraft; otherCourses: { id: string; title: string }[]; ai?: boolean }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [c, setC] = useState<CourseDraft>(initial);
  const patch = (p: Partial<CourseDraft>) => setC({ ...c, ...p });
  const setLesson = (i: number, p: Partial<CourseDraft["lessons"][number]>) => patch({ lessons: c.lessons.map((l, k) => (k === i ? { ...l, ...p } : l)) });
  const setQ = (i: number, p: Partial<CourseDraft["questions"][number]>) => patch({ questions: c.questions.map((q, k) => (k === i ? { ...q, ...p } : q)) });
  const move = <T,>(arr: T[], i: number, d: number) => { const j = i + d; if (j < 0 || j >= arr.length) return arr; const n = [...arr]; [n[i], n[j]] = [n[j], n[i]]; return n; };

  const save = (publish: boolean) => exec(() => saveCourseAction({ ...c, isPublished: publish }), { success: publish ? "Course saved and published" : "Draft saved", onOk: (d) => router.push(`/app/training/builder?id=${d.id}`) });

  return (
    <>
      <PageHeader title={c.id ? "Edit course" : "New course"} sub="Lessons are Markdown. Every question needs four options and one correct answer.">
        <button className="btn" disabled={pending} onClick={() => save(false)}>Save draft</button>
        <button className="btn-primary" disabled={pending} onClick={() => save(true)}>Save & publish</button>
      </PageHeader>
      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
        <section className="card h-fit space-y-3 p-4">
          <Field label="Title"><input className="input" value={c.title} onChange={(e) => patch({ title: e.target.value })} /></Field>
          <Field label="Description"><textarea className="textarea" rows={3} value={c.description} onChange={(e) => patch({ description: e.target.value })} /></Field>
          <Field label="Category"><input className="input" value={c.category} onChange={(e) => patch({ category: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Passing score %"><input className="input mono" type="number" min={1} max={100} value={c.passingScore} onChange={(e) => patch({ passingScore: Number(e.target.value) })} /></Field>
            <Field label="Retake cooldown (min)"><input className="input mono" type="number" min={0} value={c.cooldownMinutes} onChange={(e) => patch({ cooldownMinutes: Number(e.target.value) })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Due within (days)"><input className="input mono" type="number" min={1} value={c.defaultDueDays} onChange={(e) => patch({ defaultDueDays: Number(e.target.value) })} /></Field>
            <Field label="Certificate valid (days)"><input className="input mono" type="number" min={1} placeholder="Never expires" value={c.validityDays ?? ""} onChange={(e) => patch({ validityDays: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
          </div>
          <p className="-mt-1 text-xs text-soft">When a certificate expires, the employee is re-enrolled automatically and warned 30 and 7 days before.</p>
          <div className="space-y-2 border-t border-line pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-soft">Quiz rules</h3>
            <Field label="Questions asked per attempt"><input className="input mono" type="number" min={1} max={c.questions.length} placeholder={`All ${c.questions.length}`} value={c.quizQuestionCount ?? ""} onChange={(e) => patch({ quizQuestionCount: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
            <p className="-mt-1 text-xs text-soft">{c.quizQuestionCount && c.quizQuestionCount < c.questions.length ? `A question bank: each attempt gets ${c.quizQuestionCount} of your ${c.questions.length} questions, picked at random, so a retake is not the same quiz.` : "Leave empty to ask every question. Enter a smaller number to use the questions below as a bank."}</p>
            <label className="flex items-start gap-2 text-[13px]"><input type="checkbox" className="mt-0.5" checked={c.shuffleQuestions} onChange={(e) => patch({ shuffleQuestions: e.target.checked })} /><span>Shuffle the question order</span></label>
            <label className="flex items-start gap-2 text-[13px]"><input type="checkbox" className="mt-0.5" checked={c.shuffleOptions} onChange={(e) => patch({ shuffleOptions: e.target.checked })} /><span>Shuffle the answer options</span></label>
          </div>
          <div className="space-y-1.5 border-t border-line pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-soft">Prerequisites</h3>
            {otherCourses.length === 0 ? <p className="text-xs text-soft">No other courses yet.</p> : (
              <>
                <p className="text-xs text-soft">People must pass these before they can open this course.</p>
                {otherCourses.map((o) => <label key={o.id} className="flex items-start gap-2 text-[13px]"><input type="checkbox" className="mt-0.5" checked={c.prerequisiteIds.includes(o.id)} onChange={() => patch({ prerequisiteIds: c.prerequisiteIds.includes(o.id) ? c.prerequisiteIds.filter((x) => x !== o.id) : [...c.prerequisiteIds, o.id] })} /><span>{o.title}</span></label>)}
              </>
            )}
          </div>
          <label className="flex items-start gap-2 text-[13px]"><input type="checkbox" className="mt-0.5" checked={c.isRemedial} onChange={(e) => patch({ isRemedial: e.target.checked })} /><span>Remedial course. Assigned automatically after a written infraction (the oldest published remedial course is used).</span></label>
        </section>
        <div className="space-y-6">
          {ai && <AiTools c={c} patch={patch} />}
          <section className="space-y-3">
            <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Lessons</h2><button className="btn" onClick={() => patch({ lessons: [...c.lessons, { title: "", contentMarkdown: "", videoUrl: "", minReadSeconds: 30 }] })}>Add lesson</button></div>
            {c.lessons.map((l, i) => (
              <div key={i} className="card space-y-2 p-4">
                <div className="flex items-center justify-between"><span className="mono text-xs text-soft">LESSON {String(i + 1).padStart(2, "0")}</span>
                  <div className="flex gap-1"><button className="btn !px-2" onClick={() => patch({ lessons: move(c.lessons, i, -1) })}>Up</button><button className="btn !px-2" onClick={() => patch({ lessons: move(c.lessons, i, 1) })}>Down</button><button className="btn !px-2" disabled={c.lessons.length === 1} onClick={() => patch({ lessons: c.lessons.filter((_, k) => k !== i) })}>Remove</button></div></div>
                <Field label="Title"><input className="input" value={l.title} onChange={(e) => setLesson(i, { title: e.target.value })} /></Field>
                <Field label="Content (Markdown)"><textarea className="textarea mono" rows={7} value={l.contentMarkdown} onChange={(e) => setLesson(i, { contentMarkdown: e.target.value })} /></Field>
                <div className="grid grid-cols-[1fr_140px] gap-3"><Field label="Video URL (optional, YouTube or Vimeo)"><input className="input" value={l.videoUrl} onChange={(e) => setLesson(i, { videoUrl: e.target.value })} /></Field><Field label="Min read (sec)"><input className="input mono" type="number" min={0} value={l.minReadSeconds} onChange={(e) => setLesson(i, { minReadSeconds: Number(e.target.value) })} /></Field></div>
              </div>
            ))}
          </section>
          <section className="space-y-3">
            <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Quiz questions</h2><button className="btn" onClick={() => patch({ questions: [...c.questions, { prompt: "", options: ["", "", "", ""], correctOptionIndex: 0, explanation: "" }] })}>Add question</button></div>
            {c.questions.map((q, i) => (
              <div key={i} className="card space-y-2 p-4">
                <div className="flex items-center justify-between"><span className="mono text-xs text-soft">Q{i + 1}</span><div className="flex gap-1"><button className="btn !px-2" onClick={() => patch({ questions: move(c.questions, i, -1) })}>Up</button><button className="btn !px-2" onClick={() => patch({ questions: move(c.questions, i, 1) })}>Down</button><button className="btn !px-2" disabled={c.questions.length === 1} onClick={() => patch({ questions: c.questions.filter((_, k) => k !== i) })}>Remove</button></div></div>
                <Field label="Prompt"><input className="input" value={q.prompt} onChange={(e) => setQ(i, { prompt: e.target.value })} /></Field>
                <div className="space-y-1.5">{q.options.map((o, j) => (
                  <div key={j} className="flex items-center gap-2"><input type="radio" name={`correct-${i}`} checked={q.correctOptionIndex === j} onChange={() => setQ(i, { correctOptionIndex: j })} aria-label={`Option ${j + 1} is correct`} /><input className="input" placeholder={`Option ${j + 1}`} value={o} onChange={(e) => setQ(i, { options: q.options.map((x, k) => (k === j ? e.target.value : x)) })} /></div>
                ))}</div>
                <Field label="Explanation shown after grading"><input className="input" value={q.explanation} onChange={(e) => setQ(i, { explanation: e.target.value })} /></Field>
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
