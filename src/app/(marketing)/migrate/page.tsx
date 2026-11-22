import Link from "next/link";
import { CtaBand, PageShell } from "@/components/page-shell";
import { guides } from "@/lib/migrate";

export const metadata = { title: "Migration guides", description: "Step-by-step guides for moving from spreadsheets or paper to OnboardOps.", alternates: { canonical: "/migrate" } };

export default function Migrate() {
  return (
    <PageShell narrow eyebrow="Migration" title="Move to OnboardOps" intro="Pick where you are starting from. Each guide has screenshots of the real screens.">
      <div className="grid gap-4">{guides.map((g) => <Link key={g.slug} href={`/migrate/${g.slug}`} className="card lift block p-5"><h2 className="text-base font-semibold">{g.title}</h2><p className="mt-1.5 text-[13px] text-soft">{g.summary}</p></Link>)}</div>
      <p className="mt-6 text-[13px] text-soft">Want a faster start? Try the <Link className="text-accent" href="/launch">launch checklist</Link>.</p>
      <CtaBand />
    </PageShell>
  );
}
