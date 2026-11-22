import Link from "next/link";
import { CtaBand, PageShell } from "@/components/page-shell";
import { TutorialPlayer } from "./player";

export const metadata = {
  title: "Video tutorial: set up your workspace",
  description: "A two minute video that walks through setting up an OnboardOps workspace: departments, your team, starter content, invites, a first course, discipline rules, alerts, features and roles.",
  alternates: { canonical: "/tutorial" },
};

export default function Tutorial() {
  return (
    <PageShell eyebrow="Get started" title="Set up your workspace, start to finish" intro="Watch the whole setup in about two minutes, or jump to the step you need. Everything in the video uses sample names and sample data.">
      <TutorialPlayer />
      <p className="mt-8 text-[13px] text-soft">Prefer a checklist? See the <Link href="/launch" className="text-accent underline underline-offset-2">launch checklist</Link>, or read the <Link href="/support" className="text-accent underline underline-offset-2">help center</Link>.</p>
      <CtaBand />
    </PageShell>
  );
}
