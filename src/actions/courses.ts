"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { requireWorkspaceRole, MANAGEMENT_ROLES, ALL_ROLES, requirePerm, requireFeature } from "@/lib/rbac";
import { dispatchEffects, newEffects } from "@/lib/automations";
import { emails } from "@/lib/email";
import { notifyEmployee } from "@/lib/notify";
import { startQuizAttempt, submitQuiz } from "@/lib/automations";
import { run } from "./_util";

const courseSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(3, "Course title is required"),
  description: z.string().trim().default(""),
  category: z.string().trim().min(1).default("General"),
  passingScore: z.coerce.number().int().min(1).max(100),
  cooldownMinutes: z.coerce.number().int().min(0).max(1440),
  isRemedial: z.boolean(),
  isPublished: z.boolean(),
  validityDays: z.coerce.number().int().min(1).max(3650).nullable().optional(),
  defaultDueDays: z.coerce.number().int().min(1).max(365).default(14),
  quizQuestionCount: z.coerce.number().int().min(1).max(200).nullable().optional(),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  prerequisiteIds: z.array(z.string()).max(20).default([]),
  lessons: z
    .array(z.object({ title: z.string().trim().min(1, "Every lesson needs a title"), contentMarkdown: z.string().trim().min(1, "Every lesson needs content"), videoUrl: z.string().trim().optional().or(z.literal("")), minReadSeconds: z.coerce.number().int().min(0).max(3600) }))
    .min(1, "Add at least one lesson"),
  questions: z
    .array(
      z.object({
        id: z.string().optional(),
        prompt: z.string().trim().min(1, "Every question needs a prompt"),
        options: z.array(z.string().trim().min(1, "Fill in all four options")).length(4, "Each question needs exactly four options"),
        correctOptionIndex: z.coerce.number().int().min(0).max(3),
        explanation: z.string().trim().default(""),
      })
    )
    .min(1, "Add at least one quiz question"),
});

export async function saveCourseAction(input: unknown) {
  return run(async () => {
    const ctx = await requirePerm("training.build");
    const d = courseSchema.parse(input);
    if (d.quizQuestionCount && d.quizQuestionCount > d.questions.length) throw new Error(`The quiz asks ${d.quizQuestionCount} questions, but the bank only has ${d.questions.length}. Add questions or lower the number.`);
    const id = await prisma.$transaction(async (tx) => {
      let courseId = d.id;
      // Prerequisites must be real courses in this workspace, and must not loop back (A needs B needs A).
      const others = await tx.course.findMany({ where: { workspaceId: ctx.workspaceId }, select: { id: true, prerequisiteIds: true } });
      const known = new Set(others.map((o) => o.id));
      const prereqs = d.prerequisiteIds.filter((x) => known.has(x) && x !== courseId);
      if (courseId) {
        const graph = new Map(others.map((o) => [o.id, o.id === courseId ? prereqs : o.prerequisiteIds]));
        const seen = new Set<string>();
        const reaches = (from: string): boolean => { if (from === courseId) return true; if (seen.has(from)) return false; seen.add(from); return (graph.get(from) ?? []).some(reaches); };
        if (prereqs.some((x) => (graph.get(x) ?? []).some(reaches) || x === courseId)) throw new Error("Those prerequisites loop back to this course. A course cannot need itself, directly or through another course.");
      }
      const data = { title: d.title, description: d.description, category: d.category, passingScore: d.passingScore, cooldownMinutes: d.cooldownMinutes, isRemedial: d.isRemedial, isPublished: d.isPublished, validityDays: d.validityDays ?? null, defaultDueDays: d.defaultDueDays, quizQuestionCount: d.quizQuestionCount ?? null, shuffleQuestions: d.shuffleQuestions, shuffleOptions: d.shuffleOptions, prerequisiteIds: prereqs };
      if (courseId) {
        const existing = await tx.course.findFirst({ where: { id: courseId, workspaceId: ctx.workspaceId } });
        if (!existing) throw new Error("Course not found.");
        await tx.course.update({ where: { id: courseId }, data });
        await tx.courseLesson.deleteMany({ where: { courseId } });
      } else {
        courseId = (await tx.course.create({ data: { ...data, workspaceId: ctx.workspaceId } })).id;
      }
      await tx.courseLesson.createMany({ data: d.lessons.map((l, i) => ({ courseId: courseId!, orderIndex: i, title: l.title, contentMarkdown: l.contentMarkdown, videoUrl: l.videoUrl || null, minReadSeconds: l.minReadSeconds })) });
      // Questions are updated in place, so their ids (and the quiz statistics tied to them) survive edits.
      const have = await tx.quizQuestion.findMany({ where: { courseId }, select: { id: true } });
      const haveIds = new Set(have.map((h) => h.id));
      const keep = new Set(d.questions.map((q) => q.id).filter((x): x is string => !!x && haveIds.has(x)));
      const drop = have.filter((h) => !keep.has(h.id)).map((h) => h.id);
      if (drop.length) await tx.quizQuestion.deleteMany({ where: { id: { in: drop } } });
      for (let i = 0; i < d.questions.length; i++) {
        const q = d.questions[i];
        const fields = { orderIndex: i, prompt: q.prompt, options: q.options, correctOptionIndex: q.correctOptionIndex, explanation: q.explanation };
        if (q.id && keep.has(q.id)) await tx.quizQuestion.update({ where: { id: q.id }, data: fields });
        else await tx.quizQuestion.create({ data: { courseId, ...fields } });
      }
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: d.id ? "COURSE_UPDATED" : "COURSE_CREATED", targetType: "Course", targetId: courseId, summary: `Course "${d.title}" ${d.id ? "updated" : "created"} (${d.lessons.length} lessons, ${d.questions.length} questions${d.quizQuestionCount ? `, asks ${d.quizQuestionCount} at random` : ""}${prereqs.length ? `, ${prereqs.length} prerequisite${prereqs.length === 1 ? "" : "s"}` : ""})` });
      return courseId;
    });
    revalidatePath("/app", "layout");
    return { id };
  });
}

const assignSchema = z.object({ employeeIds: z.array(z.string()).min(1, "Pick at least one employee"), reason: z.string().trim().min(3, "Give a reason"), dueDate: z.string().optional().or(z.literal("")) });

export async function assignCourseAction(courseId: string, input: unknown) {
  return run(async () => {
    const ctx = await requirePerm("training.assign");
    const d = assignSchema.parse(input);
    const fx = newEffects();
    const count = await prisma.$transaction(async (tx) => {
      const course = await tx.course.findFirst({ where: { id: courseId, workspaceId: ctx.workspaceId } });
      if (!course) throw new Error("Course not found.");
      const emps = await tx.employeeProfile.findMany({ where: { id: { in: d.employeeIds }, workspaceId: ctx.workspaceId } });
      let n = 0;
      for (const e of emps) {
        const ex = await tx.courseEnrollment.findUnique({ where: { employeeId_courseId: { employeeId: e.id, courseId } } });
        if (ex) continue;
        await tx.courseEnrollment.create({ data: { workspaceId: ctx.workspaceId, employeeId: e.id, courseId, assignedReason: d.reason, dueDate: d.dueDate ? new Date(d.dueDate) : new Date(Date.now() + course.defaultDueDays * 86400000) } });
        await tx.employeeProfile.update({ where: { id: e.id }, data: { readiness: e.readiness === "RETRAINING_REQUIRED" ? e.readiness : "PENDING" } });
        await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "COURSE_ASSIGNED", targetType: "Employee", targetId: e.id, summary: `${e.staffCode} assigned "${course.title}": ${d.reason}` });
        fx.mail.push({ to: e.email, ...emails.courseAssigned(e.fullName, course.title, d.reason) });
        await notifyEmployee(tx, ctx.workspaceId, e.id, { title: `New training: ${course.title}`, body: d.reason, href: `/app/training/course/${courseId}` });
        n++;
      }
      return n;
    });
    await dispatchEffects(ctx, fx);
    revalidatePath("/app", "layout");
    return { assigned: count };
  });
}

export async function startCourseAction(courseId: string) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ALL_ROLES);
    if (!ctx.profile) throw new Error("No employee profile is linked to your login.");
    await prisma.courseEnrollment.updateMany({ where: { employeeId: ctx.profile.id, courseId, workspaceId: ctx.workspaceId, status: "ASSIGNED" }, data: { status: "IN_PROGRESS" } });
    return undefined;
  });
}

/** Starts the quiz: the server picks the questions and option order and sends only prompts and options. */
export async function startQuizAction(courseId: string) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ALL_ROLES);
    if (!ctx.profile) throw new Error("No employee profile is linked to your login.");
    return startQuizAttempt(ctx, ctx.profile.id, courseId);
  });
}

export async function submitQuizAction(courseId: string, attemptId: string, answers: { questionId: string; optionIndex: number }[]) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ALL_ROLES);
    if (!ctx.profile) throw new Error("No employee profile is linked to your login.");
    z.string().min(1).parse(attemptId);
    z.array(z.object({ questionId: z.string().min(1), optionIndex: z.number().int().min(0).max(3) })).max(200).parse(answers);
    const { result, fx } = await submitQuiz(ctx, ctx.profile.id, courseId, attemptId, answers);
    await dispatchEffects(ctx, fx);
    revalidatePath("/app", "layout");
    return result;
  });
}
