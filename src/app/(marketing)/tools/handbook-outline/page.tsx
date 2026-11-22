import { PageShell, CtaBand } from "@/components/page-shell";
import { HandbookOutline } from "@/components/tools/tools-ui";

export const metadata = { title: "Employee handbook outline generator", description: "Get a handbook outline matched to your industry and team size.", alternates: { canonical: "/tools/handbook-outline" } };

export default function Page() {
  return (
    <PageShell eyebrow="Free tool" title="Employee handbook outline generator" intro="Choose your industry and size, switch sections on or off, and copy or print the outline.">
      <HandbookOutline />
      <CtaBand title="Keep it with your team's records" text="Create a free workspace and your drafts become real templates, policies and rules." />
    </PageShell>
  );
}
