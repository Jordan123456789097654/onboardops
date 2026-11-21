import Link from "next/link";
import { CtaBand, PageShell } from "@/components/page-shell";

export const metadata = { title: "Security" };

const done = [
  ["Passwords", "Stored as bcrypt hashes. We never store or email a plain-text password."],
  ["Sessions", "Signed, HTTP-only cookies that expire after 14 days."],
  ["Role checks on the server", "Every action and page checks your role before it reads or writes data. Hiding a button is not the control."],
  ["Confidential notes", "Removed on the server for employees and supervisors before the page is built."],
  ["Workspace isolation", "Every record carries a workspace ID and every query filters on it."],
  ["Append-only history", "No action exists to edit or delete cases, timeline notes or audit entries. Audit hashes chain together so tampering shows."],
  ["Transport", "Traffic is served over HTTPS in production."],
  ["Notifications", "Webhook and email messages leave out confidential notes."],
];
const notYet = ["SOC 2 or ISO 27001 certification", "Single sign-on (SSO) and two-factor authentication", "Customer-managed encryption keys", "Automated password reset by email"];

export default function Security() {
  return (
    <PageShell eyebrow="Security" title="How we protect employee records" intro="HR records are sensitive. Here is what is in place today, and what is not.">
      <h2 className="text-lg font-semibold">In place</h2>
      <div className="mt-3 divide-y divide-line border-y border-line">{done.map(([t, d]) => <div key={t} className="grid gap-1 py-3 sm:grid-cols-[220px_1fr]"><span className="text-[13px] font-medium">{t}</span><span className="text-[13px] text-soft">{d}</span></div>)}</div>
      <h2 className="mt-10 text-lg font-semibold">Not yet</h2>
      <p className="mt-1 text-[13px] text-soft">We are in beta, so we will be direct about the gaps:</p>
      <ul className="mt-3 space-y-1.5 text-[13px]">{notYet.map((n) => <li key={n} className="flex gap-2"><span className="mono text-soft">–</span>{n}</li>)}</ul>
      <p className="mt-8 text-[13px] text-soft">Found a vulnerability? Please tell us through the <Link className="text-accent" href="/contact">contact page</Link> before disclosing it publicly. See also our <Link className="text-accent" href="/legal/privacy">Privacy Policy</Link> and <Link className="text-accent" href="/legal/data-processing">Data Processing Addendum</Link>.</p>
      <CtaBand />
    </PageShell>
  );
}
