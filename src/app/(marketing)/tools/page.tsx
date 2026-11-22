import Link from "next/link";
import { PageShell, CtaBand } from "@/components/page-shell";

export const metadata = { title: "Free tools", description: "Free tools for managers: a warning write-up helper, a discipline decision helper, a policy builder, a discipline ladder and a handbook outline.", alternates: { canonical: "/tools" } };

const tools = [
  { href: "/tools/write-up-helper", t: "Warning write-up helper", d: "Turn what happened into a neutral, factual written record with the date, policy and next steps." },
  { href: "/tools/should-i-write-this-up", t: "Should I write this up?", d: "Answer a few questions to find out whether coaching, a verbal warning or a written warning fits." },
  { href: "/tools/policy-builder", t: "Free policy builder", d: "Build a plain-language attendance, phone, safety, dress code or social media policy, plus a sign-off sheet." },
  { href: "/tools/discipline-ladder", t: "Discipline ladder builder", d: "Design your own progressive discipline steps and time windows, then print a one-page ladder." },
  { href: "/tools/handbook-outline", t: "Employee handbook outline generator", d: "Get a handbook outline matched to your industry and team size." },
];

export default function Tools() {
  return (
    <PageShell eyebrow="Free tools" title="Free tools for managers" intro="No signup. They run in your browser, and nothing you type is sent to us.">
      <div className="grid gap-4 sm:grid-cols-2">
        {tools.map((t) => (
          <Link key={t.href} href={t.href} className="card lift block p-5"><h2 className="text-base font-semibold">{t.t}</h2><p className="mt-1.5 text-[13px] text-soft">{t.d}</p></Link>
        ))}
      </div>
      <p className="mt-8 text-xs text-soft">These tools give general starting points, not legal advice. Check important matters with a qualified professional.</p>
      <CtaBand />
    </PageShell>
  );
}
