"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { requireWorkspaceRole, MANAGEMENT_ROLES, ALL_ROLES, requirePerm, requireFeature } from "@/lib/rbac";
import { dispatchEffects, newEffects } from "@/lib/automations";
import { emails } from "@/lib/email";
import { notifyEmployee } from "@/lib/notify";
import { submitQuiz } from "@/lib/automations";
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
  lessons: z
    .array(z.object({ title: z.string().trim().min(1, "Every lesson needs a title"), contentMarkdown: z.string().trim().min(1, "Every lesson needs content"), videoUrl: z.string().trim().optional().or(z.literal("")), minReadSeconds: z.coerce.number().int().min(0).max(3600) }))
    .min(1, "Add at least one lesson"),
  questions: z
    .array(
      z.object({
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
    const id = await prisma.$transaction(async (tx) => {
      let courseId = d.id;
      const data = { title: d.title, description: d.description, category: d.category, passingScore: d.passingScore, cooldownMinutes: d.cooldownMinutes, isRemedial: d.isRemedial, isPublished: d.isPublished, validityDays: d.validityDays ?? null, defaultDueDays: d.defaultDueDays };
      if (courseId) {
        const existing = await tx.course.findFirst({ where: { id: courseId, workspaceId: ctx.workspaceId } });
        if (!existing) throw new Error("Course not found.");
        await tx.course.update({ where: { id: courseId }, data });
        await tx.courseLesson.deleteMany({ where: { courseId } });
        await tx.quizQuestion.deleteMany({ where: { courseId } });
      } else {
        courseId = (await tx.course.create({ data: { ...data, workspaceId: ctx.workspaceId } })).id;
      }
      await tx.courseLesson.createMany({ data: d.lessons.map((l, i) => ({ courseId: courseId!, orderIndex: i, title: l.title, contentMarkdown: l.contentMarkdown, videoUrl: l.videoUrl || null, minReadSeconds: l.minReadSeconds })) });
      await tx.quizQuestion.createMany({ data: d.questions.map((q, i) => ({ courseId: courseId!, orderIndex: i, prompt: q.prompt, options: q.options, correctOptionIndex: q.correctOptionIndex, explanation: q.explanation })) });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: d.id ? "COURSE_UPDATED" : "COURSE_CREATED", targetType: "Course", targetId: courseId, summary: `Course "${d.title}" ${d.id ? "updated" : "created"} (${d.lessons.length} lessons, ${d.questions.length} questions)` });
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

export async function submitQuizAction(courseId: string, answers: number[]) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ALL_ROLES);
    if (!ctx.profile) throw new Error("No employee profile is linked to your login.");
    z.array(z.number().int().min(0).max(3)).parse(answers);
    const { result, fx } = await submitQuiz(ctx, ctx.profile.id, courseId, answers);
    await dispatchEffects(ctx, fx);
    revalidatePath("/app", "layout");
    return result;
  });
}
