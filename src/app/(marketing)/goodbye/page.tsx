import { PageShell } from "@/components/page-shell";
import { SurveyForm } from "@/components/survey-form";

export const metadata = { title: "One question before you go", description: "Tell us why you are leaving.", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <PageShell narrow eyebrow="Feedback" title="One question before you go" intro="You do not owe us a reason, but it really helps us build a better product.">
      <SurveyForm kind="LEAVING" />
    </PageShell>
  );
}
