import { PageShell, CtaBand } from "@/components/page-shell";
import { WriteUpHelper } from "@/components/tools/tools-ui";

export const metadata = { title: "Warning write-up helper", description: "Turn what happened into a neutral, factual written record with the date, policy and next steps.", alternates: { canonical: "/tools/write-up-helper" } };

export default function Page() {
  return (
    <PageShell eyebrow="Free tool" title="Free warning write-up helper" intro="Type the facts and get a clear, neutral draft you can print, plus a check for words that weaken a record.">
      <WriteUpHelper />
      <CtaBand title="Keep it with your team's records" text="Create a free workspace and your drafts become real templates, policies and rules." />
    </PageShell>
  );
}
