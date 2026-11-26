import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole, STAFF_ROLES, MANAGEMENT_ROLES } from "@/lib/rbac";
import { Badge, PageHeader } from "@/components/ui";
import { ReassignForm } from "./reassign-form";

export const metadata = { title: "Submissions" };

const fmt = (d: Date | null | undefined) => (d ? d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "-");

export default async function Submissions({ params }: { params: { id: string } }) {
  const ctx = await requirePageRole(STAFF_ROLES);
  const base = await prisma.courseEnrollment.findFirst({ where: { id: params.id, workspaceId: ctx.workspaceId }, include: { employee: true, course: true } });
  if (!base) notFound();
  const en = {
    ...base,
    attempts: await prisma.quizAttempt.findMany({
      where: { workspaceId: ctx.workspaceId, employeeId: base.employeeId, courseId: base.courseId },
      orderBy: { startedAt: "desc" },
      include: { answers: { orderBy: { id: "asc" } } },
    }),
  };
  const canAssign = MANAGEMENT_ROLES.includes(ctx.role);

  return (
    <>
      <Link href="/app/training/compliance" className="text-xs text-soft">← Compliance matrix</Link>
      <PageHeader title={`${en.employee.fullName}: ${en.course.title}`} sub={`${en.employee.staffCode} · status ${en.status.replace("_", " ")} · ${en.attempts.length} attempt(s)`} />

      <div className="card mb-4 flex flex-wrap items-center gap-3 p-4 text-[13px]">
        <Badge value={en.status} label={en.status.replace("_", " ")} />
        <span className="text-soft">Best score: {en.bestScore ?? "-"}%</span>
        <span className="text-soft">Due: {fmt(en.dueDate)}</span>
        {canAssign && <div className="ml-auto"><ReassignForm enrollmentId={en.id} /></div>}
      </div>

      {en.attempts.length === 0 ? (
        <div className="card p-6 text-center text-[13px] text-soft">No submissions yet.</div>
      ) : (
        <div className="space-y-4">
          {en.attempts.map((a, n) => (
            <section key={a.id} className="card p-4">
              <div className="mb-3 flex flex-wrap items-center gap-3 text-[13px]">
                <span className="font-medium">Attempt {en.attempts.length - n}</span>
                <span className="text-soft">Started {fmt(a.startedAt)}</span>
                <span className="text-soft">Submitted {fmt(a.submittedAt)}</span>
                <span className="font-medium">{a.score === null ? "Not submitted" : `${a.score}%`}</span>
                {a.passed !== null && <Badge value={a.passed ? "PASSED" : "FAILED"} label={a.passed ? "Passed" : "Failed"} />}
              </div>
              <div className="divide-y divide-line rounded-lg border border-line">
                {a.answers.map((x) => {
                  const opts = Array.isArray(x.options) ? (x.options as string[]) : [];
                  return (
                    <div key={x.id} className="grid gap-1 p-3 text-[13px] sm:grid-cols-[1fr_auto]">
                      <div>
                        <div className="font-medium">{x.prompt}</div>
                        <div className="text-soft">Answered: {opts[x.chosenIndex] ?? `option ${x.chosenIndex + 1}`}</div>
                        {!x.correct && <div className="text-soft">Correct: {opts[x.correctIndex] ?? `option ${x.correctIndex + 1}`}</div>}
                      </div>
                      <div className={x.correct ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>{x.correct ? "Correct" : "Wrong"}</div>
                    </div>
                  );
                })}
                {a.answers.length === 0 && <div className="p-3 text-[13px] text-soft">No answers recorded.</div>}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
