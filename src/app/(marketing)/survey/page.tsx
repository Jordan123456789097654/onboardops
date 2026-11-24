import { PageShell } from "@/components/page-shell";
import { SurveyForm } from "@/components/survey-form";

export const metadata = { title: "Would you recommend us?", description: "One question, ten seconds.", robots: { index: false, follow: false } };

export default function Page({ searchParams }: { searchParams: { score?: string } }) {
  const n = searchParams.score === undefined ? NaN : Number(searchParams.score);
  const initialScore = Number.isInteger(n) && n >= 0 && n <= 10 ? n : undefined;
  return (
    <PageShell narrow eyebrow="Survey" title="Would you recommend us?" intro="One question, ten seconds.">
      <SurveyForm kind="NPS" initialScore={initialScore} />
    </PageShell>
  );
}
