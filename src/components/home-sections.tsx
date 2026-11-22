import Link from "next/link";
import { ArrowRight, CalendarDays, FileCheck2, Gavel, ShieldCheck } from "lucide-react";
import { Reveal } from "@/components/motion";

const trust: [string, string][] = [
  ["Tamper-evident audit log", "Every important action is signed with a secret key and chained to the one before it. Owners can run Verify chain at any time."],
  ["Checks on the server, not the screen", "Every page and action checks your role before it shows or changes anything. Confidential notes never reach people who cannot see them."],
  ["No ads, no tracking", "We count page views without cookies and never sell your data or use it to train AI."],
];

export function SecurityStrip() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-24">
      <Reveal className="grid items-start gap-10 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <p className="eyebrow flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Security and privacy</p>
          <h2 className="section-title mt-2">Records people can rely on</h2>
          <p className="lead mt-3 !text-base">HR records are sensitive. We list what is in place today, and what is not yet.</p>
          <Link href="/security" className="mt-4 inline-flex items-center gap-1 text-[13px] text-accent">Read the Security page <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {trust.map(([t, d]) => <div key={t} className="border-t-2 border-ink pt-3"><h3 className="text-[15px] font-semibold">{t}</h3><p className="mt-1.5 text-[13px] leading-relaxed text-soft">{d}</p></div>)}
        </div>
      </Reveal>
    </section>
  );
}

const fresh = [
  { Icon: Gavel, t: "Fair appeals", d: "Employees can add their side and appeal. A different person decides, and overturned points are restored." },
  { Icon: CalendarDays, t: "Week schedule and swaps", d: "Drag people onto shifts. Employees request swaps and see their shifts in their own calendar." },
  { Icon: FileCheck2, t: "Time off with balances", d: "Vacation, sick and personal days, team calendar, and a warning when teammates ask for the same days." },
  { Icon: ShieldCheck, t: "Verify the audit log", d: "One click re-checks the whole history and tells you if any entry was changed." },
];

export function WhatsNew() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-24">
      <Reveal className="max-w-2xl"><p className="eyebrow">Recently added</p><h2 className="section-title mt-2">Built from beta feedback</h2><p className="lead mt-3 !text-base">New things ship often. See the <Link className="text-accent" href="/changelog">changelog</Link> and vote on what comes next on the <Link className="text-accent" href="/roadmap">roadmap</Link>.</p></Reveal>
      <Reveal group className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {fresh.map(({ Icon, t, d }, i) => (
          <div key={t} style={{ "--i": i } as React.CSSProperties} className="item card p-4"><Icon className="h-5 w-5 text-accent" aria-hidden /><h3 className="mt-3 text-[15px] font-semibold">{t}</h3><p className="mt-1.5 text-[13px] leading-relaxed text-soft">{d}</p></div>
        ))}
      </Reveal>
    </section>
  );
}

export function BetaBox() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-24">
      <Reveal className="rounded-xl border border-line bg-muted p-6 sm:p-8">
        <p className="eyebrow">Free during the beta</p>
        <h2 className="section-title mt-2">What &ldquo;beta&rdquo; means here</h2>
        <ul className="mt-4 grid gap-3 text-[13px] leading-relaxed text-soft sm:grid-cols-3">
          <li><span className="font-medium text-ink">Free, no card.</span> Every feature is free for early teams. If we ever add paid plans, we tell you first and ask before charging.</li>
          <li><span className="font-medium text-ink">It changes often.</span> Things get added and moved. Export your records regularly, and tell us when something is confusing.</li>
          <li><span className="font-medium text-ink">Honest about gaps.</span> Two-factor sign-in, SSO and a formal security certification are not here yet. See the <Link className="text-accent" href="/security">Security page</Link>.</li>
        </ul>
      </Reveal>
    </section>
  );
}

const faqs: [string, string][] = [
  ["Is it really free?", "Yes. During the beta every feature is free, with no card on file. Any future paid plan is announced in the changelog before it applies to you."],
  ["Who can see confidential manager notes?", "Owners, admins and managers. Supervisors and employees never receive them, because the server removes them before the page is built."],
  ["Can a warning be deleted?", "No. Cases, timelines and audit entries are append-only. If something is wrong, add a note or record an appeal outcome."],
  ["Do employees need a login?", "Only to use their portal for training, checklists, time off and notices. A manager can email an invite so they choose their own password."],
  ["Can I export my data?", "Yes. Owners and admins can download a full export, and you can print dossiers and certificates to PDF."],
];

export function FaqBlock() {
  return (
    <section className="mx-auto max-w-3xl px-4 pt-24">
      <Reveal><p className="eyebrow">Questions</p><h2 className="section-title mt-2">What people ask first</h2></Reveal>
      <div className="mt-6 divide-y divide-line border-y border-line">
        {faqs.map(([q, a]) => (
          <details key={q} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[14px] font-medium">{q}<span className="mono text-soft transition-transform group-open:rotate-45">+</span></summary>
            <p className="mt-2 text-[13px] leading-relaxed text-soft">{a}</p>
          </details>
        ))}
      </div>
      <p className="mt-4 text-[13px]"><Link className="text-accent" href="/faq">More questions</Link></p>
    </section>
  );
}
