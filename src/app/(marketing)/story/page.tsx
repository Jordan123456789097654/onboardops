import { PageShell } from "@/components/page-shell";
import { SurveyForm } from "@/components/survey-form";

export const metadata = { title: "Share your story", description: "Tell us how OnboardOps helped your team.", robots: { index: false, follow: true } };

export default function Page() {
  return (
    <PageShell narrow eyebrow="Customer stories" title="Share your story" intro="If OnboardOps helped your team, tell us how. We will check the wording with you before anything is shared.">
      <SurveyForm kind="STORY" />
    </PageShell>
  );
}
