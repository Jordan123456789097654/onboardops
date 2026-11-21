import { prisma } from "@/lib/prisma";
import { requirePageRoleFeature, MANAGEMENT_ROLES } from "@/lib/rbac";
import { LIB_CASES, LIB_CHECKLISTS, LIB_COURSES, LIB_POLICIES } from "@/lib/library";
import { Library } from "./library";

export const metadata = { title: "Templates library" };

export default async function TemplatesPage() {
  const ctx = await requirePageRoleFeature(MANAGEMENT_ROLES, "templates");
  const w = ctx.workspaceId;
  const [c, p, k, t] = await Promise.all([
    prisma.course.findMany({ where: { workspaceId: w }, select: { title: true } }),
    prisma.policy.findMany({ where: { workspaceId: w }, select: { title: true } }),
    prisma.shiftChecklistTemplate.findMany({ where: { workspaceId: w }, select: { title: true } }),
    prisma.caseTemplate.findMany({ where: { workspaceId: w }, select: { name: true } }),
  ]);
  const has = (list: string[], v: string) => list.includes(v);
  return (
    <Library
      groups={[
        { kind: "courses", title: "Courses", note: "Each has lessons and a 5-question quiz. They arrive as drafts so you can review and publish.", items: LIB_COURSES.map((x) => ({ id: x.id, title: x.title, desc: `${x.description} ${x.lessons.length} lessons, ${x.questions.length} questions.`, added: has(c.map((y) => y.title), x.title) })) },
        { kind: "policies", title: "Policies", note: "Starter text for you to adapt. They arrive as drafts for everyone to sign once published.", items: LIB_POLICIES.map((x) => ({ id: x.id, title: x.title, desc: x.description, added: has(p.map((y) => y.title), x.title) })) },
        { kind: "checklists", title: "Shift checklists", note: "Opening, closing and inspection checklists.", items: LIB_CHECKLISTS.map((x) => ({ id: x.id, title: x.title, desc: `${x.items.length} items, ${x.shiftType.replace("_", " ").toLowerCase()} shift.`, added: has(k.map((y) => y.title), x.title) })) },
        { kind: "cases", title: "Corrective-action templates", note: "Pre-filled wording for the Log infraction form. Edit the [brackets] each time.", items: LIB_CASES.map((x) => ({ id: x.id, title: x.name, desc: `${x.severity.replace(/_/g, " ").toLowerCase()}, ${x.points} point(s). ${x.policy}.`, added: has(t.map((y) => y.name), x.name) })) },
      ]}
    />
  );
}
