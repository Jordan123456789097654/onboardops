import { CtaBand, PageShell } from "@/components/page-shell";
import { LaunchChecklist } from "./launch-checklist";

export const metadata = { title: "Launch in 30 minutes", description: "A short checklist to set up your OnboardOps workspace and get your team started in about 30 minutes.", alternates: { canonical: "/launch" } };

export default function Launch() {
  return (
    <PageShell narrow eyebrow="Get started" title="Launch in about 30 minutes" intro="Tick steps off as you go. The time next to each step is a rough guide for a small team.">
      <LaunchChecklist />
      <CtaBand />
    </PageShell>
  );
}
