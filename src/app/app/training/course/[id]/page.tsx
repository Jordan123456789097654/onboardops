import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole, ALL_ROLES, MANAGEMENT_ROLES } from "@/lib/rbac";
import { CoursePlayer } from "./player";

export default async function CoursePage({ params }: { params: { id: string } }) {
  const ctx = await requirePageRole(ALL_ROLES);
  const course = await prisma.course.findFirst({
    where: { id: params.id, workspaceId: ctx.workspaceId },
    include: { lessons: { orderBy: { orderIndex: "asc" } }, questions: { orderBy: { orderIndex: "asc" } } },
  });
  if (!course) notFound();
  const enrollment = ctx.profile ? await prisma.courseEnrollment.findUnique({ where: { employeeId_courseId: { employeeId: ctx.profile.id, courseId: course.id } } }) : null;
  const canPreview = MANAGEMENT_ROLES.includes(ctx.role);
  // Employees need an enrollment; unpublished courses are visible to managers only.
  if (!canPreview && (!enrollment || !course.isPublished)) notFound();
  return (
    <CoursePlayer
      course={{ id: course.id, title: course.title, description: course.description, passingScore: course.passingScore, cooldownMinutes: course.cooldownMinutes }}
      lessons={course.lessons.map((l) => ({ id: l.id, title: l.title, md: l.contentMarkdown, video: l.videoUrl, secs: l.minReadSeconds }))}
      /* correct answers never leave the server */
      questions={course.questions.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options as string[] }))}
      enrollment={enrollment ? { id: enrollment.id, status: enrollment.status, best: enrollment.bestScore, cert: enrollment.certificateCode, lastAttemptAt: enrollment.lastAttemptAt?.toISOString() ?? null } : null}
    />
  );
}
