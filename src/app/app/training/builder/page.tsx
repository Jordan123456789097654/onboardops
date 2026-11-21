import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole, MANAGEMENT_ROLES, requirePagePerm } from "@/lib/rbac";
import { Builder, type CourseDraft } from "./builder";

export const metadata = { title: "Course Builder" };

export default async function BuilderPage({ searchParams }: { searchParams: { id?: string } }) {
  const ctx = await requirePagePerm("training.build");
  let draft: CourseDraft = {
    title: "", description: "", category: "General", passingScore: 85, cooldownMinutes: 15, isRemedial: false, isPublished: false, validityDays: null, defaultDueDays: 14,
    lessons: [{ title: "", contentMarkdown: "", videoUrl: "", minReadSeconds: 30 }],
    questions: [{ prompt: "", options: ["", "", "", ""], correctOptionIndex: 0, explanation: "" }],
  };
  if (searchParams.id) {
    const c = await prisma.course.findFirst({ where: { id: searchParams.id, workspaceId: ctx.workspaceId }, include: { lessons: { orderBy: { orderIndex: "asc" } }, questions: { orderBy: { orderIndex: "asc" } } } });
    if (!c) notFound();
    draft = {
      id: c.id, title: c.title, description: c.description, category: c.category, passingScore: c.passingScore, cooldownMinutes: c.cooldownMinutes, isRemedial: c.isRemedial, isPublished: c.isPublished, validityDays: c.validityDays, defaultDueDays: c.defaultDueDays,
      lessons: c.lessons.map((l) => ({ title: l.title, contentMarkdown: l.contentMarkdown, videoUrl: l.videoUrl ?? "", minReadSeconds: l.minReadSeconds })),
      questions: c.questions.map((q) => ({ prompt: q.prompt, options: q.options as string[], correctOptionIndex: q.correctOptionIndex, explanation: q.explanation })),
    };
  }
  return <Builder initial={draft} />;
}
