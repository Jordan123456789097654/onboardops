import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HeroToasts } from "@/components/mocks";
import { Shot } from "@/components/shot";
import { Reveal } from "@/components/motion";
import dynamic from "next/dynamic";
import { CompareToggle, FlowStepper, RoleExplorer } from "@/components/home-interactive";
import { BetaBox, FaqBlock, SecurityStrip, WhatsNew } from "@/components/home-sections";
import { StickyCta } from "@/components/sticky-cta";
import { ReserveAddress } from "@/components/reserve-address";
import { subdomainsEnabled } from "@/lib/subdomain";
import { ZONE } from "@/lib/spaceship-dns";
import { WaitlistForm } from "@/components/waitlist-form";
import { Testimonials } from "@/components/testimonials";

export const revalidate = 300;

const Sandbox = dynamic(() => import("@/components/sandbox").then((m) => m.Sandbox), { loading: () => <div className="card h-72 animate-pulse" aria-hidden /> });

const headline = "Write it once. Prove it forever.".split(" ");
const customers = [
  { name: "RetailNetwork", logo: "/retailnetwork.jpg" },
  { name: "Roleflow", logo: "/roleflow.png" },
];
const marqueeItems = [...customers, ...customers, ...customers, ...customers, ...customers, ...customers];
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
          <h1 className="text-[2.6rem] font-semibold leading-[1.05] sm:text-6xl" aria-label="Write it once. Prove it forever.">
            {headline.map((w, i) => <span key={i} aria-hidden className="anim-fade-up inline-block" style={{ "--i": i + 1 } as React.CSSProperties}>{w}&nbsp;</span>)}
          </h1>
          <p className="lead anim-fade-up mt-6 max-w-2xl" style={{ "--d": "650ms" } as React.CSSProperties}><strong className="font-semibold text-ink">Staff records, training and discipline in one place.</strong> One employee record from day-one onboarding to disciplinary audit trails. Stop running HR out of spreadsheets and training out of group chats.</p>
          <p className="anim-fade-up mt-2 max-w-2xl text-[13px] text-soft" style={{ "--d": "720ms" } as React.CSSProperties}>A tamper-evident audit log keeps the history honest for as long as you keep your workspace.</p>
          <div className="anim-fade-up mt-8 flex flex-wrap items-center gap-3" style={{ "--d": "800ms" } as React.CSSProperties}>
            <Link href="/register" className="btn-primary group !h-11 !px-6 !text-sm">Create a workspace <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Link>
            <a href="#how" className="btn !h-11 !px-6 !text-sm">See how it works</a>
          </div>
          {subdomainsEnabled() && <ReserveAddress zone={ZONE} />}
        </div>
        <div className="relative mt-14">
          <div className="anim-rise" style={{ "--d": "500ms" } as React.CSSProperties}><Shot name="overview" url="/app/overview" alt="The OnboardOps Command Center showing staff counts, training compliance and who needs attention" priority /></div>
          <HeroToasts />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-20" aria-label="Customers">
        <Reveal className="py-6">
          <p className="mb-8 text-center text-sm font-medium tracking-wide text-soft">
            Teams using OnboardOps
          </p>
          <div className="marquee-mask relative overflow-hidden py-2">
            <div className="marquee-track items-center gap-12 pr-12">
              {[...marqueeItems, ...marqueeItems].map((c, idx) => (
                <div
                  key={`${c.name}-${idx}`}
                  className="group flex shrink-0 items-center gap-3.5 rounded-2xl border border-line/80 bg-surface/80 px-4 py-2.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.logo}
                    width={48}
                    height={48}
                    alt={c.name}
                    className="h-12 w-12 rounded-xl border border-line/60 object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                  <span className="font-display text-base font-semibold tracking-[-0.02em] text-ink">
                    {c.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      <Testimonials />

      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-24">
        <Reveal className="max-w-2xl"><p className="eyebrow">How it works</p><h2 className="section-title mt-2">From the first shift to the last write-up</h2><p className="lead mt-3 !text-base">Click through. These are real screens from the app.</p></Reveal>
        <Reveal delay={80} className="mt-8"><FlowStepper /></Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-24">
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.4fr]">
          <Reveal><p className="eyebrow">Why teams switch</p><h2 className="section-title mt-2">Most small operations run on fragile tools</h2><p className="lead mt-3 !text-base">If a manager leaves, so does the history. Flip the switch to compare.</p></Reveal>
          <Reveal delay={80}><CompareToggle /></Reveal>
        </div>
      </section>

      <WhatsNew />

      <section className="mx-auto max-w-6xl px-4 pt-24">
        <Reveal className="max-w-2xl"><p className="eyebrow">Who sees what</p><h2 className="section-title mt-2">The right access for every role</h2><p className="lead mt-3 !text-base">Pick a role to see its menu and what it can do.</p></Reveal>
        <Reveal delay={80} className="mt-8"><RoleExplorer /></Reveal>
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

      <SecurityStrip />
      <BetaBox />
      <FaqBlock />

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

      <section className="mx-auto max-w-6xl px-4 pt-14">
        <Reveal className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line p-6">
          <div><h2 className="text-lg font-semibold">Not ready yet?</h2><p className="mt-1 text-[13px] text-soft">Leave your email and we will tell you about big releases. No spam, and we use it for nothing else.</p></div>
          <WaitlistForm />
        </Reveal>
      </section>
      <div className="h-16 sm:hidden" aria-hidden />
      <StickyCta />
    </>
  );
}
