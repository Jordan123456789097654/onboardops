import { prisma } from "@/lib/prisma";
import { requirePageRole, ADMIN_ROLES } from "@/lib/rbac";
import { LIB_CHECKLISTS, LIB_COURSES, LIB_POLICIES } from "@/lib/library";
import { SITE } from "@/lib/site";
import { Wizard } from "./wizard";

export const metadata = { title: "Set up your workspace" };

export default async function SetupPage() {
  const ctx = await requirePageRole(ADMIN_ROLES);
  const [depts, emps] = await Promise.all([prisma.department.count({ where: { workspaceId: ctx.workspaceId } }), prisma.employeeProfile.count({ where: { workspaceId: ctx.workspaceId } })]);
  return <Wizard workspace={ctx.workspace.name} hasDepts={depts > 0} hasPeople={emps > 0} signIn={`${SITE.url}/w/${ctx.workspace.slug}`} courses={LIB_COURSES.map((c) => ({ id: c.id, title: c.title }))} policies={LIB_POLICIES.map((c) => ({ id: c.id, title: c.title }))} checklists={LIB_CHECKLISTS.map((c) => ({ id: c.id, title: c.title }))} />;
}
