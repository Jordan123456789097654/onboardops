import { PageShell } from "@/components/page-shell";
import { AppealForm } from "@/components/appeal-form";

export const metadata = { title: "Appeal a decision", description: "Ask us to review a suspension or ban.", robots: { index: false, follow: true } };

export default function Page() {
  return (
    <PageShell narrow eyebrow="Appeals" title="Appeal a decision" intro="If your account or workplace was suspended and you think that was a mistake, tell us what happened. A person reviews every appeal.">
      <AppealForm />
    </PageShell>
  );
}
