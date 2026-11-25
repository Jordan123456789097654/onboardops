import { requireStaffPage, SUPPORT_STAFF } from "@/lib/platform";
import { PageHeader } from "@/components/ui";
import { LIB_CHECKLISTS, LIB_COURSES, LIB_POLICIES } from "@/lib/library";
import { NewWorkspaceForm } from "./form";

export const metadata = { title: "Set up a workspace" };

export default async function NewWorkspace() {
  await requireStaffPage(SUPPORT_STAFF);
  return (
    <>
      <PageHeader title="Set up a workspace for a customer" sub="Creates the workspace, makes the owner (or attaches their existing account) and emails them to set a password. Starter content is added as drafts they can review." />
      <NewWorkspaceForm
        courses={LIB_COURSES.map((c) => ({ id: c.id, title: c.title }))}
        policies={LIB_POLICIES.map((c) => ({ id: c.id, title: c.title }))}
        checklists={LIB_CHECKLISTS.map((c) => ({ id: c.id, title: c.title }))}
      />
    </>
  );
}
