import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePageRole, STAFF_ROLES } from "@/lib/rbac";
import { featureOn } from "@/lib/features";
import { aiConfigured } from "@/lib/ai/groq";
import { Empty, PageHeader } from "@/components/ui";
import { ComplianceAi, type ComplianceMetrics } from "./compliance-ai";

export const metadata = { title: "Compliance Matrix" };
export const maxDuration = 60;

const cell: Record<string, string> = {
  PASSED: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  IN_PROGRESS: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  ASSIGNED: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  FAILED: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-300",
};

export default async function Compliance() {
  const ctx = await requirePageRole(STAFF_ROLES);
  const [employees, courses] = await Promise.all([
    prisma.employeeProfile.findMany({ where: { workspaceId: ctx.workspaceId, status: { not: "TERMINATED" } }, include: { enrollments: true }, orderBy: { staffCode: "asc" } }),
    prisma.course.findMany({ where: { workspaceId: ctx.workspaceId, isPublished: true }, orderBy: { createdAt: "asc" } }),
  ]);

  const now = Date.now();
  let totalEnrollments = 0;
  let passedCount = 0;
  let openCount = 0;
  let failedCount = 0;
  let overdueCount = 0;

  const courseBreakdown = courses.map((c) => {
    let passed = 0;
    let open = 0;
    let failed = 0;
    let overdue = 0;
    for (const e of employees) {
      const en = e.enrollments.find((x) => x.courseId === c.id);
      if (!en) continue;
      if (en.status === "PASSED") passed++;
      else if (en.status === "FAILED") failed++;
      else open++;
      if (en.status !== "PASSED" && en.dueDate && en.dueDate.getTime() < now) overdue++;
    }
    const total = passed + open + failed;
    totalEnrollments += total;
    passedCount += passed;
    openCount += open;
    failedCount += failed;
    overdueCount += overdue;
    return { courseTitle: c.title, passed, open, failed, overdue, total };
  });

  const compliancePct = totalEnrollments > 0 ? Math.round((passedCount / totalEnrollments) * 100) : 0;

  const metrics: ComplianceMetrics = {
    totalEmployees: employees.length,
    publishedCourses: courses.length,
    totalEnrollments,
    passedCount,
    openCount,
    failedCount,
    overdueCount,
    compliancePct,
    courseBreakdown,
  };

  const ai = aiConfigured() && featureOn(ctx.workspace.features, "ai");

  return (
    <>
      <PageHeader title="Compliance Matrix" sub="Employee × course. Blank means not assigned." />
      <ComplianceAi ai={ai} metrics={metrics} />
      <div className="mb-3 flex gap-3 text-xs"><span className="rounded px-2 py-0.5 cell-ok bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">Passed</span><span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900 dark:bg-amber-950 dark:text-amber-300">Open</span><span className="rounded bg-rose-100 px-2 py-0.5 text-rose-900 dark:bg-rose-950 dark:text-rose-300">Failed</span></div>
      {employees.length === 0 || courses.length === 0 ? <Empty title="Nothing to show yet" hint="Add employees and publish courses." /> : (
        <div className="card max-h-[70vh] overflow-auto">
          <table className="w-full border-collapse">
            <thead><tr><th className="th">Employee</th>{courses.map((c) => <th key={c.id} className="th">{c.title}</th>)}</tr></thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="hover:bg-muted">
                  <td className="td"><Link href={`/app/employee/${e.id}`} className="font-medium">{e.fullName}</Link> <span className="mono text-xs text-soft">{e.staffCode}</span></td>
                  {courses.map((c) => {
                    const en = e.enrollments.find((x) => x.courseId === c.id);
                    return <td key={c.id} className={`td mono text-center text-xs ${en ? cell[en.status] : ""}`}>{en ? (en.status === "PASSED" ? `${en.bestScore}%` : en.status.replace("_", " ")) : ""}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
