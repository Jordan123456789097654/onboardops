import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CtaBand, PageShell } from "@/components/page-shell";
import { Shot } from "@/components/shot";
import { guideBySlug, guides } from "@/lib/migrate";

export const generateStaticParams = () => guides.map((g) => ({ slug: g.slug }));
export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const g = guideBySlug(params.slug);
  return g ? { title: g.title, description: g.summary, alternates: { canonical: `/migrate/${g.slug}` } } : {};
}

export default function Guide({ params }: { params: { slug: string } }) {
  const g = guideBySlug(params.slug);
  if (!g) notFound();
  return (
    <PageShell narrow eyebrow="Migration guide" title={g.title} intro={g.summary}>
      <ol className="space-y-10">
        {g.steps.map((s, i) => (
          <li key={s.h}>
            <h2 className="text-lg font-semibold"><span className="mono mr-2 text-soft">{i + 1}.</span>{s.h}</h2>
            {s.p.map((t) => <p key={t} className="mt-2 text-[14px] leading-relaxed text-soft">{t}</p>)}
            {s.shot && <div className="mt-4"><Shot name={s.shot.name} url={s.shot.url} alt={s.shot.alt} /></div>}
          </li>
        ))}
      </ol>
      <p className="mt-10 text-[13px]"><Link href="/migrate" className="text-accent">All guides</Link> · <Link href="/launch" className="text-accent">Launch checklist</Link></p>
      <CtaBand />
    </PageShell>
  );
}
