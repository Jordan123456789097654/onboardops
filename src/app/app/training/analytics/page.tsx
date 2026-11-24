import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePageRole, MANAGEMENT_ROLES } from "@/lib/rbac";
import { Empty, PageHeader } from "@/components/ui";
import { can } from "@/lib/perms";
import { featureOn } from "@/lib/features";
import { aiConfigured } from "@/lib/ai/groq";
import { QuizAi } from "./quiz-ai";

export const metadata = { title: "Quiz analytics" };
export const dynamic = "force-dynamic";

type Agg = { id: string; prompt: string; options: string[]; correctIndex: number; total: number; correct: number; picks: number[] };

/** Which quiz questions people miss. Built from the answers saved with every graded attempt. */
export default async function QuizAnalytics({ searchParams }: { searchParams: { course?: string } }) {
  const ctx = await requirePageRole(MANAGEMENT_ROLES);
  const courses = await prisma.course.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { title: "asc" }, select: { id: true, title: true } });
  const counts = await prisma.quizAttempt.groupBy({ by: ["courseId"], where: { workspaceId: ctx.workspaceId, submittedAt: { not: null } }, _count: { _all: true } });
  const attemptsBy = new Map(counts.map((c) => [c.courseId, c._count._all]));
  const current = courses.find((c) => c.id === searchParams.course) ?? courses.find((c) => (attemptsBy.get(c.id) ?? 0) > 0) ?? courses[0];

  let summary = { attempts: 0, people: 0, passRate: 0, avg: 0 };
  let rows: Agg[] = [];
  if (current) {
    const attempts = await prisma.quizAttempt.findMany({ where: { workspaceId: ctx.workspaceId, courseId: current.id, submittedAt: { not: null } }, select: { employeeId: true, score: true, passed: true }, take: 20000 });
    summary = {
      attempts: attempts.length,
      people: new Set(attempts.map((a) => a.employeeId)).size,
      passRate: attempts.length ? Math.round((attempts.filter((a) => a.passed).length / attempts.length) * 100) : 0,
      avg: attempts.length ? Math.round(attempts.reduce((s, a) => s + (a.score ?? 0), 0) / attempts.length) : 0,
    };
    const answers = await prisma.quizAnswer.findMany({ where: { workspaceId: ctx.workspaceId, courseId: current.id }, orderBy: { createdAt: "asc" }, take: 50000 });
    const map = new Map<string, Agg>();
    for (const a of answers) {
      const opts = Array.isArray(a.options) ? (a.options as string[]) : [];
      const row = map.get(a.questionId) ?? { id: a.questionId, prompt: a.prompt, options: opts, correctIndex: a.correctIndex, total: 0, correct: 0, picks: [0, 0, 0, 0] };
      // Newest wording wins if the question was edited.
      row.prompt = a.prompt; row.options = opts; row.correctIndex = a.correctIndex;
      row.total++; if (a.correct) row.correct++;
      if (a.chosenIndex >= 0 && a.chosenIndex < row.picks.length) row.picks[a.chosenIndex]++;
      map.set(a.questionId, row);
    }
    rows = [...map.values()].sort((a, b) => a.correct / a.total - b.correct / b.total);
  }

  return (
    <>
      <PageHeader title="Quiz analytics" sub="Which questions people miss, and which wrong answer they pick. Hardest questions first. Only attempts made since this feature was added are counted.">
        <Link href="/app/training" className="btn">Back to training</Link>
      </PageHeader>
      {courses.length === 0 ? <Empty title="No courses yet" /> : (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-1.5">
            {courses.map((c) => <Link key={c.id} href={`/app/training/analytics?course=${c.id}`} className={`rounded-md border px-3 py-1.5 text-[13px] ${current?.id === c.id ? "border-accent bg-muted font-medium text-accent" : "border-line hover:bg-muted"}`}>{c.title} <span className="mono text-xs text-soft">{attemptsBy.get(c.id) ?? 0}</span></Link>)}
          </div>
          {summary.attempts === 0 ? <Empty title="No graded attempts yet" hint="Once people take this quiz, you will see the questions they miss here." /> : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-[13px]">
                {[["Attempts", summary.attempts], ["People", summary.people], ["Pass rate", `${summary.passRate}%`], ["Average score", `${summary.avg}%`]].map(([k, v]) => <div key={String(k)} className="card p-3"><div className="text-xs text-soft">{k}</div><div className="mono mt-1 text-xl font-semibold">{v}</div></div>)}
              </div>
              {current && aiConfigured() && featureOn(ctx.workspace.features, "ai") && can(ctx, "training.build") && <QuizAi courseId={current.id} />}
              <div className="space-y-3">
                {rows.map((r) => {
                  const pct = Math.round((r.correct / r.total) * 100);
                  const wrong = r.picks.map((n, i) => ({ n, i })).filter((x) => x.i !== r.correctIndex && x.n > 0).sort((a, b) => b.n - a.n);
                  return (
                    <div key={r.id} className="card p-4 text-[13px]">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <p className="max-w-2xl font-medium">{r.prompt}</p>
                        <div className="text-right"><div className={`mono text-lg font-semibold ${pct < 60 ? "text-rose-600" : pct < 80 ? "text-amber-600" : "text-emerald-600"}`}>{pct}% correct</div><div className="mono text-xs text-soft">{r.correct} of {r.total} answers</div></div>
                      </div>
                      <div className="mt-3 space-y-1">
                        {r.options.map((o, i) => {
                          const share = r.total ? Math.round((r.picks[i] / r.total) * 100) : 0;
                          return (
                            <div key={i} className="flex items-center gap-2">
                              <div className="relative h-7 flex-1 overflow-hidden rounded border border-line">
                                <div className={`absolute inset-y-0 left-0 ${i === r.correctIndex ? "bg-emerald-200 dark:bg-emerald-900" : "bg-muted"}`} style={{ width: `${share}%` }} />
                                <span className="relative flex h-full items-center px-2">{o}{i === r.correctIndex && <span className="ml-2 text-xs text-emerald-700 dark:text-emerald-400">correct</span>}</span>
                              </div>
                              <span className="mono w-20 text-right text-xs text-soft">{r.picks[i]} · {share}%</span>
                            </div>
                          );
                        })}
                      </div>
                      {wrong[0] && pct < 80 && <p className="mt-2 text-xs text-soft">Most common wrong answer: &ldquo;{r.options[wrong[0].i]}&rdquo; ({wrong[0].n}). If many people pick it, the lesson may need to explain this point better.</p>}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
