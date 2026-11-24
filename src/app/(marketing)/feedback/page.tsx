import { PageShell } from "@/components/page-shell";
import { SurveyForm } from "@/components/survey-form";

export const metadata = { title: "How are we doing?", description: "Tell us what is working and what is not.", robots: { index: false, follow: true } };

export default function Page() {
  return (
    <PageShell narrow eyebrow="Feedback" title="How are we doing?" intro="Tell us what is working and what is not. A person reads every message.">
      <SurveyForm kind="FEEDBACK" />
    </PageShell>
  );
}
