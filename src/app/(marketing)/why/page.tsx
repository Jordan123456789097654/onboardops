import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/motion";
import { Calculator, CompareToggle, FitQuiz } from "@/components/home-interactive";
import { CtaBand } from "@/components/page-shell";

export const metadata = { title: "Why OnboardOps", description: "Why shift-based teams use OnboardOps for training, discipline records and audit trails." };

const reasons = [
  ["You can prove it", "When an inspector, insurer or lawyer asks who was trained on what, and who signed what, the answer is one search away. Quiz scores are graded on the server and certificates carry a code."],
  ["Nobody can quietly rewrite history", "Cases and notes can be added but never edited or deleted, and the audit log chains each entry to the one before. If a record changes, you can see when and by whom."],
  ["Employees are treated fairly", "They see what is written about them, sign to confirm receipt, can report concerns without fear, and can ask for leave or tell you they are retiring, all in one place."],
  ["Managers see only what they should", "Roles are enforced on the server. Supervisors can warn but never read confidential notes. Owners see everything, including who looked at what."],
  ["It does the chasing for you", "New hires are enrolled the moment you add them. Reminders go out before training is due, and certificates that expire re-enroll people automatically."],
  ["It stays out of your way", "No per-seat pricing during the beta, no consultants, no month-long rollout. Import a CSV, send invites, and your team can sign in from a link."],
];

const notFor = ["Payroll, benefits or time-clock tracking", "Shift scheduling", "Applicant tracking and recruiting", "Replacing legal or HR advice"];

export default function Why() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-16 sm:pt-24">
        <p className="eyebrow">Why OnboardOps</p>
        <h1 className="mt-2 max-w-3xl text-4xl font-semibold leading-[1.08] sm:text-5xl">Because &ldquo;we think they were trained&rdquo; is not an answer.</h1>
        <p className="lead mt-5 max-w-2xl">Small teams run on trust and memory until something goes wrong. OnboardOps keeps the record that matters in one place, so training, discipline and audits do not depend on who still has the spreadsheet.</p>
        <div className="mt-7 flex flex-wrap gap-3"><Link href="/register" className="btn-primary group !h-11 !px-6 !text-sm">Try it free <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Link><Link href="/features" className="btn !h-11 !px-6 !text-sm">See the product</Link></div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-20">
        <Reveal group className="grid gap-x-10 gap-y-9 md:grid-cols-2">
          {reasons.map(([t, d], i) => (
            <div key={t} style={{ "--i": i } as React.CSSProperties} className="item flex gap-4"><span className="mono pt-0.5 text-sm text-soft">{String(i + 1).padStart(2, "0")}</span><div><h2 className="text-lg font-semibold !tracking-[-0.02em]">{t}</h2><p className="mt-1.5 text-[14px] leading-relaxed text-soft">{d}</p></div></div>
          ))}
        </Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-24">
        <Reveal className="max-w-2xl"><p className="eyebrow">Side by side</p><h2 className="section-title mt-2">Flip between today and OnboardOps</h2></Reveal>
        <Reveal delay={80} className="mt-6 max-w-3xl"><CompareToggle /></Reveal>
      </section>

      <section id="calculator" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-24">
        <Reveal className="max-w-2xl"><p className="eyebrow">Do the math</p><h2 className="section-title mt-2">How much time goes into keeping track?</h2><p className="lead mt-3 !text-base">Move the sliders to match your team. Nothing is sent anywhere.</p></Reveal>
        <Reveal delay={80} className="mt-6"><Calculator /></Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-24">
        <Reveal className="max-w-2xl"><p className="eyebrow">Is it for you?</p><h2 className="section-title mt-2">A two-minute gut check</h2></Reveal>
        <Reveal delay={80} className="mt-6"><FitQuiz /></Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-24">
        <div className="grid gap-8 md:grid-cols-[1fr_1fr]">
          <Reveal><p className="eyebrow">Being straight with you</p><h2 className="section-title mt-2">What OnboardOps is not</h2><p className="lead mt-3 !text-base">It is a record-keeping tool for training, conduct and shift records. It does not give legal advice, and using it does not make you compliant on its own.</p></Reveal>
          <Reveal delay={80}><ul className="divide-y divide-line border-y border-line">{notFor.map((n) => <li key={n} className="py-3 text-[14px]">{n}</li>)}</ul><p className="mt-3 text-[13px] text-soft">We are in beta, so some things are still missing. See what is and is not in place on the <Link className="text-accent underline" href="/security">Security page</Link>.</p></Reveal>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4"><CtaBand title="See it with your own team" text="Free during the beta. Create a workspace, import your staff from a CSV, and send invites in minutes." /></div>
    </>
  );
}
