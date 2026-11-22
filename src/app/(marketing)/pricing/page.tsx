import Link from "next/link";
import { Check } from "lucide-react";
import { CtaBand, PageShell } from "@/components/page-shell";

export const metadata = { title: "Pricing", description: "OnboardOps is free during the beta. See what is included.", alternates: { canonical: "/pricing" } };

const included = [
  "Unlimited employees, departments and job roles",
  "Training builder with Markdown lessons, video links and server-graded quizzes",
  "Printable certificates and employee dossiers",
  "Infraction ledger with confidential manager notes and employee acknowledgment",
  "Shift checklists with supervisor verification",
  "Append-only audit log with chained hashes",
  "Operations and confidential Discord, Slack or Teams webhooks",
  "Email notifications for assignments and infractions",
  "Light, dark and system themes",
];

export default function Pricing() {
  return (
    <PageShell narrow eyebrow="Pricing" title="Free while we are in beta" intro="No card, no trial clock, no staff limit. If we add paid plans later, we will announce them in the changelog first.">
      <div className="card p-6">
        <div className="flex items-end justify-between"><div><h2 className="text-lg font-semibold">Beta tester</h2><p className="text-[13px] text-soft">Everything in the product</p></div><div className="mono text-4xl font-semibold">$0</div></div>
        <ul className="mt-5 space-y-2 text-[13px]">{included.map((i) => <li key={i} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{i}</li>)}</ul>
        <Link href="/register" className="btn-primary mt-6 !h-10 !px-5 !text-sm">Create a workspace</Link>
      </div>
      <h2 className="mt-10 text-lg font-semibold">What beta means</h2>
      <ul className="legal mt-2 space-y-1">
        <li className="text-[13px] text-soft">The product can change quickly, and some features may be rough. See the <Link className="text-accent" href="/changelog">changelog</Link>.</li>
        <li className="text-[13px] text-soft">We do not promise uptime during the beta. Keep your own copy of anything critical. The <Link className="text-accent" href="/legal/beta-terms">Beta Program Terms</Link> explain the details.</li>
        <li className="text-[13px] text-soft">Your data is yours. You can export the staff list to CSV at any time.</li>
      </ul>
      <CtaBand />
    </PageShell>
  );
}
