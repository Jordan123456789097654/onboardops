"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { startCourseAction, submitQuizAction } from "@/actions/courses";
import { Badge, Modal, PageHeader, useAction } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { QuizResult } from "@/lib/automations";

type Props = {
  course: { id: string; title: string; description: string; passingScore: number; cooldownMinutes: number };
  lessons: { id: string; title: string; md: string; video: string | null; secs: number }[];
  questions: { id: string; prompt: string; options: string[] }[];
  enrollment: { id: string; status: string; best: number | null; cert: string | null; lastAttemptAt: string | null } | null;
};

function embed(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
    if (u.hostname === "youtu.be") return `https://www.youtube.com/embed${u.pathname}`;
    if (u.hostname.includes("vimeo.com")) return `https://player.vimeo.com/video${u.pathname}`;
  } catch {}
  return null;
}

export function CoursePlayer({ course, lessons, questions, enrollment }: Props) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [step, setStep] = useState(0); // 0..lessons-1 lessons, lessons.length = quiz
  const [seen, setSeen] = useState<Set<number>>(new Set());
  const [left, setLeft] = useState(lessons[0]?.secs ?? 0);
  const [answers, setAnswers] = useState<(number | null)[]>(questions.map(() => null));
  const [result, setResult] = useState<QuizResult | null>(null);
  const [certOpen, setCertOpen] = useState(false);
  const isQuiz = step === lessons.length;
  const passed = enrollment?.status === "PASSED" || result?.passed;

  useEffect(() => {
    if (isQuiz || seen.has(step)) { setLeft(0); return; }
    setLeft(lessons[step].secs);
    const t = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [step, isQuiz, seen, lessons]);

  useEffect(() => { if (enrollment?.status === "ASSIGNED") startCourseAction(course.id); }, [enrollment?.status, course.id]);

  const next = () => { setSeen((s) => new Set(s).add(step)); setStep(step + 1); };
  const submit = () => exec(() => submitQuizAction(course.id, answers as number[]), { onOk: (r) => { setResult(r); if (r.passed) setCertOpen(true); router.refresh(); } });

  return (
    <>
      <PageHeader title={course.title} sub={`${course.description} Pass mark ${course.passingScore}%.`}>
        <Link href={enrollment ? "/app/my-portal" : "/app/training"} className="btn">Back</Link>
        {passed && enrollment && <button className="btn-primary" onClick={() => setCertOpen(true)}>View certificate</button>}
      </PageHeader>
      {!enrollment && <p className="mb-4 rounded-md border border-line bg-muted p-3 text-[13px] text-soft">Preview mode: you are not enrolled in this course, so the quiz cannot be submitted.</p>}
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <ol className="card h-fit divide-y divide-line text-[13px]">
          {lessons.map((l, i) => (<li key={l.id}><button className={cn("flex w-full items-center gap-2 px-3 py-2 text-left", step === i && "bg-muted font-medium text-accent")} onClick={() => (seen.has(i) || i <= step || passed) && setStep(i)}><span className="mono text-xs">{String(i + 1).padStart(2, "0")}</span>{l.title}</button></li>))}
          <li><button className={cn("flex w-full items-center gap-2 px-3 py-2 text-left", isQuiz && "bg-muted font-medium text-accent")} disabled={!seen.has(lessons.length - 1) && !passed} onClick={() => setStep(lessons.length)}><span className="mono text-xs">QZ</span>Quiz</button></li>
        </ol>
        <div className="card p-5">
          {!isQuiz ? (
            <>
              <h2 className="mb-3 text-lg font-semibold">{lessons[step].title}</h2>
              {lessons[step].video && (embed(lessons[step].video!) ? <iframe className="mb-4 aspect-video w-full rounded-md border border-line" src={embed(lessons[step].video!)!} allowFullScreen title="Lesson video" /> : <a className="mb-4 inline-block text-accent" href={lessons[step].video!} target="_blank" rel="noreferrer">Watch lesson video</a>)}
              <div className="space-y-3 text-[13px] leading-relaxed [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_ul]:list-disc"><ReactMarkdown>{lessons[step].md}</ReactMarkdown></div>
              <div className="mt-6 flex items-center justify-between">
                <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>Previous</button>
                <button className="btn-primary" disabled={left > 0 && !passed} onClick={next}>{left > 0 && !passed ? <span className="mono">Read for {left}s</span> : step === lessons.length - 1 ? "Continue to quiz" : "Next lesson"}</button>
              </div>
            </>
          ) : (
            <>
              <h2 className="mb-1 text-lg font-semibold">Quiz</h2>
              {passed ? <div className="mb-4 flex items-center gap-2 text-[13px]"><Badge value="PASSED" /><span className="mono">{enrollment?.best ?? result?.score}% · {enrollment?.cert ?? result?.certificateCode}</span></div> : <p className="mb-4 text-[13px] text-soft">Answer every question. Retakes after a fail wait {course.cooldownMinutes} minutes.</p>}
              {result && !result.passed && <div className="mb-4 rounded-md border border-rose-300 bg-rose-50 p-3 text-[13px] text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">Score <span className="mono">{result.score}%</span> ({result.correct}/{result.total}). Needed {course.passingScore}%. You can retake after {new Date(result.cooldownUntil!).toISOString().slice(11, 16)}Z.</div>}
              <div className="space-y-5">
                {questions.map((q, i) => {
                  const rv = result?.review[i];
                  return (
                    <fieldset key={q.id} disabled={!enrollment || !!passed}>
                      <legend className="mb-2 text-[13px] font-medium">{i + 1}. {q.prompt}</legend>
                      <div className="space-y-1">
                        {q.options.map((o, j) => (
                          <button key={j} onClick={() => setAnswers((a) => a.map((x, k) => (k === i ? j : x)))} className={cn("block w-full rounded-md border px-3 py-2 text-left text-[13px]", answers[i] === j ? "border-accent bg-muted" : "border-line hover:bg-muted", rv && rv.correctIndex === j && "border-emerald-500", rv && rv.chosen === j && rv.chosen !== rv.correctIndex && "border-rose-500")}>{o}</button>
                        ))}
                      </div>
                      {rv && <p className="mt-1 text-xs text-soft">{rv.chosen === rv.correctIndex ? "Correct. " : "Not quite. "}{rv.explanation}</p>}
                    </fieldset>
                  );
                })}
              </div>
              {enrollment && !passed && <button className="btn-primary mt-6" disabled={pending || answers.some((a) => a === null)} onClick={submit}>{pending ? "Grading…" : "Submit quiz"}</button>}
            </>
          )}
        </div>
      </div>
      <Modal open={certOpen && !!passed} onClose={() => setCertOpen(false)} title="Certificate">
        <div className="rounded-lg border-2 border-ink p-6 text-center">
          <p className="mono text-xs uppercase text-soft">Certificate of completion</p>
          <p className="mt-3 text-lg font-semibold">{course.title}</p>
          <p className="mono mt-2 text-sm">{result?.score ?? enrollment?.best}% · {result?.certificateCode ?? enrollment?.cert}</p>
        </div>
        {enrollment && <Link target="_blank" href={`/print/certificate/${enrollment.id}`} className="btn-primary mt-4 w-full">Open printable certificate</Link>}
      </Modal>
    </>
  );
}
