import { PrintButton } from "@/app/print/print-button";
import { notYet, securityGroups } from "@/lib/security-facts";

export const metadata = { title: "Security summary", description: "A one-page summary of OnboardOps security controls.", robots: { index: false, follow: true } };

export default function SecuritySummary() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10 text-[12px] leading-relaxed">
      <div className="no-print mb-4 flex justify-end"><PrintButton /></div>
      <p className="mono text-xs text-soft">OnboardOps · Security summary · {new Date().toISOString().slice(0, 10)}</p>
      <h1 className="mt-1 text-2xl font-semibold">How OnboardOps protects employee records</h1>
      <p className="mt-2 text-soft">OnboardOps is in beta. This summary lists controls that are in place today and the gaps we have not closed. It is a description, not a certification or a warranty.</p>
      {securityGroups.map((g) => (
        <section key={g.title} className="mt-5 break-inside-avoid">
          <h2 className="text-sm font-semibold">{g.title}</h2>
          <ul className="mt-1.5 space-y-1.5">{g.items.map(([t, d]) => <li key={t}><span className="font-medium">{t}.</span> {d}</li>)}</ul>
        </section>
      ))}
      <section className="mt-5 break-inside-avoid">
        <h2 className="text-sm font-semibold">Not yet in place</h2>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">{notYet.map((n) => <li key={n}>{n}</li>)}</ul>
      </section>
      <p className="mt-6 text-soft">Report a vulnerability through the contact page at onboardops.org/contact before disclosing it publicly.</p>
    </div>
  );
}
