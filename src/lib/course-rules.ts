import type { Prisma } from "@prisma/client";
import { randomInt } from "node:crypto";

type Db = Pick<Prisma.TransactionClient, "course" | "courseEnrollment" | "jobRole">;

/**
 * Courses that must be passed first: the ones set on the course itself, plus (when the employee's job role is a sequential
 * learning path) the course just before it in that role's list.
 */
export async function unmetPrerequisites(db: Db, p: { workspaceId: string; employeeId: string; jobRoleId: string | null; course: { id: string; prerequisiteIds: string[] } }) {
  const need = new Set(p.course.prerequisiteIds.filter((id) => id !== p.course.id));
  if (p.jobRoleId) {
    const role = await db.jobRole.findFirst({ where: { id: p.jobRoleId, workspaceId: p.workspaceId }, select: { requiredCourseIds: true, pathSequential: true } });
    if (role?.pathSequential) {
      const i = role.requiredCourseIds.indexOf(p.course.id);
      if (i > 0) need.add(role.requiredCourseIds[i - 1]);
    }
  }
  if (need.size === 0) return [];
  const ids = [...need];
  const passed = await db.courseEnrollment.findMany({ where: { employeeId: p.employeeId, courseId: { in: ids }, status: "PASSED" }, select: { courseId: true } });
  const done = new Set(passed.map((x) => x.courseId));
  const missing = ids.filter((id) => !done.has(id));
  if (missing.length === 0) return [];
  return db.course.findMany({ where: { id: { in: missing } }, select: { id: true, title: true } });
}

/** A fair shuffle (Fisher-Yates) using a cryptographic random source. */
export function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = randomInt(0, i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * Chooses which questions to ask and in what order, and how to order each question's options.
 * Bank size: ask `quizQuestionCount` questions picked at random from all of them (never more than exist).
 * Questions keep their built order unless shuffleQuestions is on or a bank is used (a bank is always picked at random).
 */
export function pickQuiz(course: { quizQuestionCount: number | null; shuffleQuestions: boolean; shuffleOptions: boolean }, questions: { id: string; orderIndex: number; options: unknown }[]) {
  const sorted = [...questions].sort((a, b) => a.orderIndex - b.orderIndex);
  const n = course.quizQuestionCount && course.quizQuestionCount > 0 ? Math.min(course.quizQuestionCount, sorted.length) : sorted.length;
  const usesBank = n < sorted.length;
  let chosen = sorted;
  if (usesBank) chosen = shuffled(sorted).slice(0, n);
  if (course.shuffleQuestions) chosen = shuffled(chosen);
  else if (usesBank) chosen = [...chosen].sort((a, b) => a.orderIndex - b.orderIndex);
  const optionOrder: Record<string, number[]> = {};
  for (const q of chosen) {
    const len = Array.isArray(q.options) ? q.options.length : 4;
    const idx = Array.from({ length: len }, (_, i) => i);
    optionOrder[q.id] = course.shuffleOptions ? shuffled(idx) : idx;
  }
  return { questionIds: chosen.map((q) => q.id), optionOrder };
}
