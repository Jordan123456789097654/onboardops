import { PageShell, CtaBand } from "@/components/page-shell";
import { LadderBuilder } from "@/components/tools/tools-ui";

export const metadata = { title: "Discipline ladder builder", description: "Design your own progressive discipline steps and time windows, then print a one-page ladder.", alternates: { canonical: "/tools/discipline-ladder" } };

export default function Page() {
  return (
    <PageShell eyebrow="Free tool" title="Progressive discipline ladder builder" intro="Set how many warnings lead to the next step and how long each counts. Print it or import it into a workspace.">
      <LadderBuilder />
      <CtaBand title="Keep it with your team's records" text="Create a free workspace and your drafts become real templates, policies and rules." />
    </PageShell>
  );
}
