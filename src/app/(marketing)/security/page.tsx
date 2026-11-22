import Link from "next/link";
import { CtaBand, PageShell } from "@/components/page-shell";
import { notYet, securityGroups } from "@/lib/security-facts";

export const metadata = { title: "Security", description: "How OnboardOps protects employee records: access controls, encryption, tamper-evident audit logs and what is not in place yet.", alternates: { canonical: "/security" } };

export default function Security() {
  return (
    <PageShell eyebrow="Security" title="How we protect employee records" intro="HR records are sensitive. Here is what is in place today, and what is not.">
      <p className="mb-8"><Link href="/security/summary" className="btn">Security summary (print or save as PDF)</Link></p>
      {securityGroups.map((g) => (
        <section key={g.title} className="mb-8">
          <h2 className="text-lg font-semibold">{g.title}</h2>
          <div className="mt-3 divide-y divide-line border-y border-line">{g.items.map(([t, d]) => <div key={t} className="grid gap-1 py-3 sm:grid-cols-[220px_1fr]"><span className="text-[13px] font-medium">{t}</span><span className="text-[13px] text-soft">{d}</span></div>)}</div>
        </section>
      ))}
      <section className="mb-8">
        <h2 className="text-lg font-semibold">How audit verification works</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[13px] text-soft">
          <li>Every important action writes an audit entry: who did it, what, to which record, and when.</li>
          <li>The entry&apos;s fingerprint is computed from its own content plus the fingerprint of the entry before it, using a secret key.</li>
          <li>Changing or deleting any old entry breaks every fingerprint after it.</li>
          <li>On the Audit page, <span className="font-medium text-ink">Verify chain</span> recomputes the whole chain and tells you the first entry that does not match, if any.</li>
        </ol>
      </section>
      <h2 className="text-lg font-semibold">Not yet</h2>
      <p className="mt-1 text-[13px] text-soft">We are in beta, so we will be direct about the gaps:</p>
      <ul className="mt-3 space-y-1.5 text-[13px]">{notYet.map((n) => <li key={n} className="flex gap-2"><span className="mono text-soft">–</span>{n}</li>)}</ul>
      <p className="mt-6 rounded-lg border border-line bg-muted p-4 text-[13px] leading-relaxed"><strong>No system is completely secure.</strong> We work hard to protect records, but we cannot guarantee that information will be 100% secure. Unauthorized access, loss or disclosure can happen despite reasonable safeguards. Keep your own backups, enter only what you need, and use strong, unique passwords.</p>
      <p className="mt-8 text-[13px] text-soft">Found a vulnerability? Please tell us through the <Link className="text-accent" href="/contact">contact page</Link> before disclosing it publicly. See also our <Link className="text-accent" href="/legal/privacy">Privacy Policy</Link> and <Link className="text-accent" href="/legal/data-processing">Data Processing Addendum</Link>.</p>
      <CtaBand />
    </PageShell>
  );
}
