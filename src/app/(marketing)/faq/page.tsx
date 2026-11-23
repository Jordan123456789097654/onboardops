import Link from "next/link";
import { CtaBand, PageShell } from "@/components/page-shell";

export const metadata = { title: "FAQ", description: "Answers about pricing, security, roles, notifications, data export and getting started with OnboardOps.", alternates: { canonical: "/faq" } };

const faqs: [string, string][] = [
  ["Is OnboardOps really free?", "Yes. It is in beta and every feature is free for beta testers, with no card on file. Any future paid plan will be announced in the changelog before it applies to you."],
  ["Does OnboardOps support two-factor authentication?", "Yes. Anyone can turn it on in Account settings with an authenticator app such as Google Authenticator, Microsoft Authenticator or 1Password, and you get backup codes to save. A workspace owner can require it for every member. If someone loses their phone and codes, the owner can reset their two-factor setup."],
  ["Can I sign in with Google or GitHub?", "When your OnboardOps instance has them switched on, yes. You can sign up with either, or connect one from Account settings. If you use two-factor authentication, it is still asked for after Google or GitHub. You cannot disconnect your only way to sign in."],
  ["How many employees can I add?", "There is no cap during the beta."],
  ["Who can see confidential manager notes?", "Owners, admins and managers. Supervisors and employees never receive them, because the server strips them out before sending the page."],
  ["Can an infraction be deleted?", "No. Cases, timeline notes and audit entries are append-only. If something was entered by mistake, add a note explaining the correction."],
  ["What does an employee signature mean?", "It confirms they received the notice. It is not an admission or agreement, and the signature text says so."],
  ["Do employees need a login?", "Only to use the self-service portal. A manager can send an email invite from the employee's profile so they choose their own password."],
  ["How are quizzes graded?", "On the server. The correct answers are never sent to the browser while the quiz is open."],
  ["Does it send notifications?", "Yes: Discord, Slack or Microsoft Teams webhooks for operations and for confidential HR events, and email through Resend for new training and infractions."],
  ["Can I export my data?", "Yes. Owners and Admins can download a full JSON export of the workspace from Settings, and anyone who can view the staff directory can export it to CSV. You can also print dossiers and certificates to PDF."],
  ["Is this legal advice or an HR compliance guarantee?", "No. OnboardOps is a record-keeping tool. Employment rules vary, so check with an attorney or HR professional about your obligations."],
  ["How old do I need to be?", "You must be at least 13 to create an account. If you are under 18, you need a parent or guardian's permission, as described in the Terms of Service."],
  ["Where are you based?", "In the State of Georgia, USA. Our terms are governed by Georgia law."],
];

export default function Faq() {
  return (
    <PageShell narrow eyebrow="FAQ" title="Questions people ask before they sign up">
      <div className="divide-y divide-line border-y border-line">
        {faqs.map(([q, a]) => (
          <details key={q} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[14px] font-medium">{q}<span className="mono text-soft transition-transform group-open:rotate-45">+</span></summary>
            <p className="mt-2 text-[13px] leading-relaxed text-soft">{a}</p>
          </details>
        ))}
      </div>
      <p className="mt-6 text-[13px] text-soft">Still stuck? Visit the <Link className="text-accent" href="/support">help center</Link> or <Link className="text-accent" href="/contact">contact support</Link>.</p>
      <CtaBand />
    </PageShell>
  );
}
