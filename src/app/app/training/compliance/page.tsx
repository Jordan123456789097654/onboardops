import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePageRole, STAFF_ROLES } from "@/lib/rbac";
import { Empty, PageHeader } from "@/components/ui";

export const metadata = { title: "Compliance Matrix" };

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
  return (
    <>
      <PageHeader title="Compliance Matrix" sub="Employee × course. Blank means not assigned." />
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
