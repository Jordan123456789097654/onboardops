"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { requireWorkspaceRole, MANAGEMENT_ROLES, hasFeature } from "@/lib/rbac";
import { LIB_CASES, LIB_CHECKLISTS, LIB_COURSES, LIB_POLICIES } from "@/lib/library";
import { run } from "./_util";

const schema = z.object({ courses: z.array(z.string()).default([]), policies: z.array(z.string()).default([]), checklists: z.array(z.string()).default([]), cases: z.array(z.string()).default([]) });

/** Adds chosen starter content. Items with the same title are skipped. Courses and policies arrive as drafts to review. */
export async function installLibraryAction(input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(MANAGEMENT_ROLES);
    if (!hasFeature(ctx, "templates")) throw new Error("The templates library is turned off for this workspace.");
    const d = schema.parse(input);
    const out = { courses: 0, policies: 0, checklists: 0, cases: 0, skipped: 0 };
    await prisma.$transaction(async (tx) => {
      const w = ctx.workspaceId;
      for (const id of d.courses) {
        const c = LIB_COURSES.find((x) => x.id === id);
        if (!c) continue;
        if (await tx.course.findFirst({ where: { workspaceId: w, title: c.title } })) { out.skipped++; continue; }
        const course = await tx.course.create({ data: { workspaceId: w, title: c.title, description: c.description, category: c.category, passingScore: c.passingScore, validityDays: c.validityDays ?? null, isPublished: false } });
        await tx.courseLesson.createMany({ data: c.lessons.map((l, i) => ({ courseId: course.id, orderIndex: i, title: l.title, contentMarkdown: l.md, minReadSeconds: l.secs })) });
        await tx.quizQuestion.createMany({ data: c.questions.map((x, i) => ({ courseId: course.id, orderIndex: i, prompt: x.prompt, options: x.options, correctOptionIndex: x.correct, explanation: x.explanation })) });
        out.courses++;
      }
      for (const id of d.policies) {
        const p = LIB_POLICIES.find((x) => x.id === id);
        if (!p) continue;
        if (await tx.policy.findFirst({ where: { workspaceId: w, title: p.title } })) { out.skipped++; continue; }
        await tx.policy.create({ data: { workspaceId: w, title: p.title, description: p.description, contentMarkdown: p.md, appliesToAll: true, isPublished: false } });
        out.policies++;
      }
      for (const id of d.checklists) {
        const c = LIB_CHECKLISTS.find((x) => x.id === id);
        if (!c) continue;
        if (await tx.shiftChecklistTemplate.findFirst({ where: { workspaceId: w, title: c.title } })) { out.skipped++; continue; }
        await tx.shiftChecklistTemplate.create({ data: { workspaceId: w, title: c.title, shiftType: c.shiftType, items: c.items.map(([label, required], i) => ({ id: `i${i + 1}`, label, required })) } });
        out.checklists++;
      }
      for (const id of d.cases) {
        const c = LIB_CASES.find((x) => x.id === id);
        if (!c) continue;
        if (await tx.caseTemplate.findFirst({ where: { workspaceId: w, name: c.name } })) { out.skipped++; continue; }
        await tx.caseTemplate.create({ data: { workspaceId: w, name: c.name, severity: c.severity, points: c.points, policy: c.policy, summary: c.summary } });
        out.cases++;
      }
      await writeAudit(tx, { workspaceId: w, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "TEMPLATES_INSTALLED", targetType: "Workspace", targetId: w, summary: `Added from the library: ${out.courses} course(s), ${out.policies} policy(ies), ${out.checklists} checklist(s), ${out.cases} case template(s)` });
    });
    revalidatePath("/app", "layout");
    return out;
  });
}
