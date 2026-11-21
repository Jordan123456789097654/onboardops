import { CtaBand, PageShell } from "@/components/page-shell";

export const metadata = { title: "About" };

export default function About() {
  return (
    <PageShell narrow eyebrow="About" title="A small team in Georgia, building HR tools for small teams">
      <div className="legal">
        <p>OnboardOps started from a simple annoyance: the records that matter most, like who finished safety training and who signed a written warning, usually live in the least reliable places. A spreadsheet, a binder, a group chat.</p>
        <p>We are building one system where hiring, training, discipline and auditing share the same employee record, so a manager can answer &ldquo;is this person trained, and what is on file?&rdquo; in one place.</p>
        <h2>What we believe</h2>
        <ul>
          <li><strong>Records should be hard to quietly change.</strong> That is why the audit log is append-only.</li>
          <li><strong>Employees deserve to see what is written about them</strong>, except the private notes managers need to keep. They sign to confirm receipt.</li>
          <li><strong>Plain language beats jargon.</strong> If a screen needs a manual, we have failed.</li>
        </ul>
        <h2>Where we are</h2>
        <p>OnboardOps is based in the State of Georgia, USA, and is currently in beta. Beta testers get every feature for free and have a direct line to the people building it.</p>
      </div>
      <CtaBand />
    </PageShell>
  );
}
