import Link from "next/link";
import { CtaBand, PageShell } from "@/components/page-shell";
import { playbooks } from "@/lib/playbooks";
import { WaitlistForm } from "@/components/waitlist-form";

export const metadata = { title: "Manager playbooks", description: "Free, printable playbooks for managers: the first 90 days of a new hire, and fair discipline.", alternates: { canonical: "/playbooks" } };

export default function Playbooks() {
  return (
    <PageShell narrow eyebrow="Playbooks" title="Playbooks for managers" intro="Free and printable. No email needed. Open one and use Print or save as PDF.">
      <div className="grid gap-4">
        {playbooks.map((p) => <Link key={p.slug} href={`/playbooks/${p.slug}`} className="card lift block p-5"><h2 className="text-base font-semibold">{p.title}</h2><p className="mt-1.5 text-[13px] text-soft">{p.summary}</p></Link>)}
      </div>
      <div className="mt-10 rounded-xl border border-line p-5"><h2 className="text-sm font-semibold">Want the next playbook when it is ready?</h2><p className="mb-3 mt-1 text-[13px] text-soft">Optional. We will email you about new playbooks and nothing else.</p><WaitlistForm /></div>
      <CtaBand />
    </PageShell>
  );
}
