import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { FOUNDER } from "@/lib/founder";

export const metadata = { title: "A note from the founder", alternates: { canonical: "/founder" } };

export default function Founder() {
  if (!FOUNDER.name || FOUNDER.story.length === 0) notFound();
  return (
    <PageShell narrow eyebrow="Founder note" title="Why I am building OnboardOps">
      <div className="space-y-4 text-[15px] leading-relaxed">{FOUNDER.story.map((p) => <p key={p}>{p}</p>)}</div>
      <p className="mt-8 font-medium">{FOUNDER.name}</p>
      <p className="text-[13px] text-soft">{FOUNDER.role}{FOUNDER.location ? `, ${FOUNDER.location}` : ""}</p>
      <p className="mt-8 text-[13px] text-soft">OnboardOps is in beta. Tell me what is working and what is not through the <Link className="text-accent" href="/contact">contact form</Link>, and vote on what comes next on the <Link className="text-accent" href="/roadmap">roadmap</Link>.</p>
    </PageShell>
  );
}
