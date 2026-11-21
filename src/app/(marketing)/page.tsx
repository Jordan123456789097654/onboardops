import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { Sandbox } from "@/components/sandbox";
import { HeroToasts } from "@/components/mocks";
import { Shot } from "@/components/shot";
import { Reveal } from "@/components/motion";
import { CompareToggle, FlowStepper } from "@/components/home-interactive";

const headline = "Staff records, training and discipline in one place.".split(" ");
const reasons = [
  ["You can prove it", "Server-graded quizzes, signed notices and a tamper-evident audit log."],
  ["Fair to employees", "They see what is written, sign to confirm receipt, and can raise concerns safely."],
  ["It does the chasing", "Reminders, expiring certificates and automatic enrollment do the nagging for you."],
];

export default function Home() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-16 sm:pt-24">
        <div className="max-w-3xl">
          <p className="anim-fade-up mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[13px] text-soft"><span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />Now in beta. Free for early teams.</p>
          <h1 className="text-[2.6rem] font-semibold leading-[1.05] sm:text-6xl" aria-label="Staff records, training and discipline in one place.">
            {headline.map((w, i) => <span key={i} aria-hidden className="anim-fade-up inline-block" style={{ "--i": i + 1 } as React.CSSProperties}>{w}&nbsp;</span>)}
          </h1>
          <p className="lead anim-fade-up mt-6 max-w-2xl" style={{ "--d": "650ms" } as React.CSSProperties}>One employee record from day-one onboarding to disciplinary audit trails. Stop running HR out of spreadsheets and training out of group chats.</p>
          <div className="anim-fade-up mt-8 flex flex-wrap items-center gap-3" style={{ "--d": "800ms" } as React.CSSProperties}>
            <Link href="/register" className="btn-primary group !h-11 !px-6 !text-sm">Open Web App <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Link>
            <Link href="/why" className="btn !h-11 !px-6 !text-sm">Why OnboardOps</Link>
          </div>
        </div>
        <div className="relative mt-14">
          <div className="anim-rise" style={{ "--d": "500ms" } as React.CSSProperties}><Shot name="overview" url="/app/overview" alt="The OnboardOps Command Center showing staff counts, training compliance and who needs attention" priority /></div>
          <HeroToasts />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-20" aria-label="Trusted by">
        <Reveal className="relative overflow-hidden rounded-2xl border border-line bg-surface/90 p-6 shadow-sm sm:p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-emerald-500/5 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-md space-y-2">
              <div className="mono inline-flex items-center gap-2 rounded-full border border-line bg-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-accent">
                <ShieldCheck className="h-3.5 w-3.5" />
                Trusted Partners
              </div>
              <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                Trusted by modern operations teams
              </h2>
              <p className="text-[13px] leading-relaxed text-soft">
                High-volume moderation, retail, and live-ops teams run their daily onboarding, shift checklists, and conduct logs on OnboardOps.
              </p>
            </div>

            <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:max-w-2xl">
              <div className="lift group relative flex items-center gap-4 rounded-xl border border-line bg-canvas/80 p-4 transition-all hover:border-accent/50 hover:shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/retailnetwork.jpg"
                  width={52}
                  height={52}
                  alt="RetailNetwork logo"
                  className="h-[52px] w-[52px] shrink-0 rounded-xl border border-line object-cover shadow-sm transition-transform group-hover:scale-105"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">RetailNetwork</span>
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" aria-label="Verified Partner" />
                  </div>
                  <p className="mt-0.5 text-xs text-soft">Retail &amp; Live-Ops Moderation</p>
                  <div className="mono mt-2 inline-flex items-center gap-1.5 rounded-md border border-line bg-muted px-2 py-0.5 text-[10px] text-soft">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Training · Checklists · Conduct
                  </div>
                </div>
              </div>

              <div className="lift group relative flex items-center gap-4 rounded-xl border border-line bg-canvas/80 p-4 transition-all hover:border-accent/50 hover:shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/roleflow.png"
                  width={52}
                  height={52}
                  alt="Roleflow logo"
                  className="h-[52px] w-[52px] shrink-0 rounded-xl border border-line object-cover shadow-sm transition-transform group-hover:scale-105"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">Roleflow</span>
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" aria-label="Verified Partner" />
                  </div>
                  <p className="mt-0.5 text-xs text-soft">Team Operations &amp; Role Management</p>
                  <div className="mono mt-2 inline-flex items-center gap-1.5 rounded-md border border-line bg-muted px-2 py-0.5 text-[10px] text-soft">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Onboarding · Compliance · Audit
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-24">
        <Reveal className="max-w-2xl"><p className="eyebrow">How it works</p><h2 className="section-title mt-2">From the first shift to the last write-up</h2><p className="lead mt-3 !text-base">Click through. These are real screens from the app.</p></Reveal>
        <Reveal delay={80} className="mt-8"><FlowStepper /></Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-24">
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.4fr]">
          <Reveal><p className="eyebrow">Why teams switch</p><h2 className="section-title mt-2">Most small operations run on fragile tools</h2><p className="lead mt-3 !text-base">If a manager leaves, so does the history. Flip the switch to compare.</p></Reveal>
          <Reveal delay={80}><CompareToggle /></Reveal>
        </div>
      </section>

      <section className="mt-24 border-y border-line bg-muted">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <Reveal className="max-w-2xl"><p className="eyebrow">Try it</p><h2 className="section-title mt-2">Run the rules yourself</h2><p className="lead mt-3 !text-base">The same logic the app uses, on sample data in your browser. Nothing is saved.</p></Reveal>
          <Reveal delay={100} className="mt-8"><Sandbox /></Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-24">
        <Reveal group className="grid gap-8 md:grid-cols-3">
          {reasons.map(([t, d], i) => (
            <div key={t} style={{ "--i": i } as React.CSSProperties} className="item border-t-2 border-ink pt-4"><h3 className="text-lg font-semibold">{t}</h3><p className="mt-2 text-[13px] leading-relaxed text-soft">{d}</p></div>
          ))}
        </Reveal>
        <Reveal delay={120} className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[13px]"><Link href="/why" className="inline-flex items-center gap-1 text-accent">Why OnboardOps <ArrowRight className="h-3.5 w-3.5" /></Link><Link href="/features" className="inline-flex items-center gap-1 text-accent">Everything in the product <ArrowRight className="h-3.5 w-3.5" /></Link></Reveal>
      </section>

      <section className="mx-auto mt-24 max-w-6xl px-4">
        <Reveal className="rounded-xl border border-line bg-[#0B1220] px-8 py-14 text-white sm:px-14">
          <h2 className="max-w-xl text-3xl font-semibold leading-tight sm:text-4xl">Put your first team on one record.</h2>
          <p className="mt-3 max-w-lg text-[15px] opacity-70">Free during the beta. Create a workspace, import your staff, and send invites in a few minutes.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/register" className="group inline-flex h-11 items-center gap-2 rounded-md bg-white px-6 text-sm font-medium text-zinc-950 transition-transform hover:-translate-y-0.5">Create a workspace <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Link>
            <Link href="/faq" className="inline-flex h-11 items-center rounded-md border border-white/30 px-6 text-sm font-medium text-white transition-colors hover:bg-white/10">Read the FAQ</Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
