import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { ContactForm } from "@/components/contact-form";
import { SITE } from "@/lib/site";

export const metadata = { title: "Contact support", description: "Questions, bug reports or privacy requests. Contact the OnboardOps team.", alternates: { canonical: "/contact" } };

export default function Contact() {
  const mail = SITE.contactEmail;
  return (
    <PageShell eyebrow="Contact" title="Contact support" intro="Questions, bug reports, privacy requests, security reports and legal notices all come through this form.">
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <ContactForm />
        <aside className="space-y-4 text-[13px]">
          <div className="card p-4"><h2 className="text-sm font-semibold">Before you write</h2><p className="mt-1 text-soft">The <Link className="text-accent underline" href="/support">help center</Link> answers most setup questions, and <Link className="text-accent underline" href="/support/troubleshooting">troubleshooting</Link> covers common problems.</p></div>
          <div className="card p-4"><h2 className="text-sm font-semibold">Response times</h2><p className="mt-1 text-soft">Monday to Friday, 9 am to 5 pm Eastern. We aim to reply within 2 business days during the beta. <Link className="text-accent underline" href="/support/support-policy">Support policy</Link></p></div>
          <div className="card p-4"><h2 className="text-sm font-semibold">Privacy requests</h2><p className="mt-1 text-soft">Employees: your employer controls your workspace record, so ask them first. For website or account data, choose Privacy request.</p></div>
          <div className="card p-4"><h2 className="text-sm font-semibold">Security reports</h2><p className="mt-1 text-soft">Choose Security report and include steps to reproduce. Please do not access other customers&apos; data.</p></div>
          <div className="card p-4"><h2 className="text-sm font-semibold">Where we are</h2><p className="mt-1 text-soft">State of Georgia, USA.{mail && <> Email: <a className="mono text-accent" href={`mailto:${mail}`}>{mail}</a></>}</p></div>
        </aside>
      </div>
    </PageShell>
  );
}
