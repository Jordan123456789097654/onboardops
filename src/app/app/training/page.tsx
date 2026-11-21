import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePageRole, STAFF_ROLES, MANAGEMENT_ROLES } from "@/lib/rbac";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { AssignCourse } from "./assign";

export const metadata = { title: "Training Academy" };

export default async function Training() {
  const ctx = await requirePageRole(STAFF_ROLES);
  const canBuild = MANAGEMENT_ROLES.includes(ctx.role);
  const [courses, employees] = await Promise.all([
    prisma.course.findMany({ where: { workspaceId: ctx.workspaceId, ...(canBuild ? {} : { isPublished: true }) }, include: { _count: { select: { lessons: true, questions: true, enrollments: true } }, enrollments: { select: { status: true } } }, orderBy: { createdAt: "asc" } }),
    canBuild ? prisma.employeeProfile.findMany({ where: { workspaceId: ctx.workspaceId, status: { not: "TERMINATED" } }, orderBy: { staffCode: "asc" } }) : Promise.resolve([]),
  ]);
  return (
    <>
      <PageHeader title="Training Academy" sub="Course catalog">{canBuild && <Link href="/app/training/builder" className="btn-primary">New course</Link>}</PageHeader>
      {courses.length === 0 ? <Empty title="No courses yet" hint="Build a course with Markdown lessons and a quiz, then require it on a job role." /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((c) => {
            const passed = c.enrollments.filter((e) => e.status === "PASSED").length;
            return (
              <div key={c.id} className="card lift flex flex-col p-4">
                <div className="flex items-start justify-between gap-2"><h2 className="font-medium">{c.title}</h2><div className="flex gap-1">{c.isRemedial && <Badge value="RETRAINING_REQUIRED" label="Remedial" />}{!c.isPublished && <Badge value="LOA" label="Draft" />}</div></div>
                <p className="mt-1 flex-1 text-[13px] text-soft">{c.description}</p>
                <p className="mono mt-3 text-xs text-soft">{c._count.lessons} lessons · {c._count.questions} questions · pass {c.passingScore}% · {passed}/{c._count.enrollments} passed</p>
                <div className="mt-3 flex gap-2">
                  <Link href={`/app/training/course/${c.id}`} className="btn">Open</Link>
                  {canBuild && <Link href={`/app/training/builder?id=${c.id}`} className="btn">Edit</Link>}
                  {canBuild && <AssignCourse courseId={c.id} courseTitle={c.title} employees={employees.map((e) => ({ id: e.id, label: `${e.staffCode} ${e.fullName}` }))} />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
