import { PageShell } from "@/components/page-shell";
import { prisma } from "@/lib/prisma";
import { ApplyForm } from "./apply-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Careers", description: "Work with OnboardOps. See open positions, or introduce yourself.", alternates: { canonical: "/careers" } };

export default async function Careers() {
  const postings = await prisma.jobPosting.findMany({ where: { status: "OPEN" }, orderBy: { createdAt: "desc" }, take: 30 }).catch(() => []);
  return (
    <PageShell narrow eyebrow="Careers" title={postings.length ? "Open positions" : "We are not hiring yet"} intro={postings.length ? "Small team, real customers, plain communication." : "OnboardOps is early and small. We are not hiring right now, but we like meeting people who care about fair, well-documented workplaces."}>
      <section className="mb-10 space-y-3 text-[14px] leading-relaxed">
        <h2 className="text-lg font-semibold">How we work</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-soft">
          <li>We build in the open during the beta and ship changes often. Our changelog and roadmap are public.</li>
          <li>We write plainly. If a sentence can be shorter, it should be.</li>
          <li>Privacy and fairness come first. Employee records are sensitive, so we are careful with them and honest about what we have not built yet.</li>
          <li>We make decisions from what real teams tell us, not from what sounds impressive.</li>
        </ul>
      </section>
      {postings.map((p) => (
        <article key={p.id} className="mb-8 rounded-xl border border-line p-5">
          <h2 className="text-lg font-semibold">{p.title}</h2>
          <p className="mono mt-1 text-xs text-soft">{[p.team, p.location, p.type].filter(Boolean).join(" · ")}</p>
          <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed">{p.description}</p>
          <details className="mt-4"><summary className="btn inline-flex cursor-pointer list-none">Apply for this role</summary><div className="mt-4"><ApplyForm postingId={p.id} label="Why this role, and what would you bring?" /></div></details>
        </article>
      ))}
      <section className="rounded-xl border border-line p-5">
        <h2 className="text-lg font-semibold">{postings.length ? "Do not see a fit?" : "Introduce yourself"}</h2>
        <p className="mb-4 mt-1 text-[13px] text-soft">Tell us who you are and what you would like to work on. We keep introductions and look at them when we start hiring.</p>
        <ApplyForm label="About you and what you are interested in" />
      </section>
    </PageShell>
  );
}
