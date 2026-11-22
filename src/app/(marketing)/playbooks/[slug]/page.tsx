import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PrintButton } from "@/app/print/print-button";
import { JsonLd } from "@/components/json-ld";
import { playbookBySlug, playbooks } from "@/lib/playbooks";
import { SITE } from "@/lib/site";

export const generateStaticParams = () => playbooks.map((p) => ({ slug: p.slug }));
export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const p = playbookBySlug(params.slug);
  return p ? { title: p.title, description: p.summary, alternates: { canonical: `/playbooks/${p.slug}` } } : {};
}

export default function Playbook({ params }: { params: { slug: string } }) {
  const pb = playbookBySlug(params.slug);
  if (!pb) notFound();
  return (
    <article className="mx-auto max-w-3xl px-4 py-14">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Article", headline: pb.title, description: pb.summary, author: { "@type": "Organization", name: SITE.name }, publisher: { "@type": "Organization", name: SITE.name } }} />
      <div className="no-print mb-6 flex items-center justify-between"><Link href="/playbooks" className="text-[13px] text-accent">All playbooks</Link><PrintButton /></div>
      <p className="eyebrow">Playbook · OnboardOps</p>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{pb.title}</h1>
      <p className="mt-3 text-base text-soft">{pb.summary}</p>
      <div className="mt-8 space-y-6 text-[14px] leading-relaxed">
        {pb.chapters.map((c, i) => (
          <section key={c.h} className="break-inside-avoid">
            <h2 className="text-lg font-semibold">{i + 1}. {c.h}</h2>
            {c.p?.map((t) => <p key={t} className="mt-2">{t}</p>)}
            {c.ul && <ul className="mt-2 list-disc space-y-1.5 pl-5">{c.ul.map((t) => <li key={t}>{t}</li>)}</ul>}
          </section>
        ))}
      </div>
      <p className="mt-10 border-t border-line pt-4 text-xs text-soft">onboardops.org · Free to share with credit.</p>
    </article>
  );
}
