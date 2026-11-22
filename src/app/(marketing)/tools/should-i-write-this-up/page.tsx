import { PageShell, CtaBand } from "@/components/page-shell";
import { ShouldIHelper } from "@/components/tools/tools-ui";

export const metadata = { title: "Should I write this up?", description: "Answer a few questions to find out whether coaching, a verbal warning or a written warning fits.", alternates: { canonical: "/tools/should-i-write-this-up" } };

export default function Page() {
  return (
    <PageShell eyebrow="Free tool" title="Should I write this up? helper" intro="Five questions, a suggestion, and the reasons behind it.">
      <ShouldIHelper />
      <CtaBand title="Keep it with your team's records" text="Create a free workspace and your drafts become real templates, policies and rules." />
    </PageShell>
  );
}
