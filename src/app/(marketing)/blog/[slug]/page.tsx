import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CtaBand, PageShell } from "@/components/page-shell";
import { JsonLd } from "@/components/json-ld";
import { postBySlug, posts } from "@/lib/blog";
import { SITE } from "@/lib/site";
import { fmtDate } from "@/lib/utils";

export function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const p = postBySlug(params.slug);
  if (!p) return {};
  return {
    title: p.title,
    description: p.description,
    alternates: { canonical: `/blog/${p.slug}` },
    openGraph: { type: "article", title: p.title, description: p.description, publishedTime: p.date },
  };
}

export default function Post({ params }: { params: { slug: string } }) {
  const p = postBySlug(params.slug);
  if (!p) notFound();
  return (
    <PageShell eyebrow="Blog" title={p.title} intro={p.description}>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Article", headline: p.title, description: p.description, datePublished: p.date, dateModified: p.date, author: { "@type": "Organization", name: SITE.name }, publisher: { "@type": "Organization", name: SITE.name }, mainEntityOfPage: `${SITE.url}/blog/${p.slug}` }} />
      <p className="mono text-xs text-soft">{fmtDate(p.date)} · {p.readMins} min read</p>
      <div className="mt-4 max-w-2xl space-y-4 text-[14px] leading-relaxed">
        {p.body.map((s, i) => (
          <section key={i}>
            {s.h && <h2 className="mb-1.5 mt-6 text-lg font-semibold">{s.h}</h2>}
            {s.p?.map((t, j) => <p key={j} className="mb-3">{t}</p>)}
            {s.ul && <ul className="list-disc space-y-1.5 pl-5">{s.ul.map((t) => <li key={t}>{t}</li>)}</ul>}
          </section>
        ))}
      </div>
      <p className="mt-8 text-[13px]"><Link href="/blog" className="text-accent">All articles</Link></p>
      <CtaBand />
    </PageShell>
  );
}
