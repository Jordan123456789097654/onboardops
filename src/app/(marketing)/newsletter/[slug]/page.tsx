import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { MarkupArticle } from "@/components/markup-article";
import { NewsletterForm } from "@/components/newsletter-form";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const load = (slug: string) => prisma.newsletterPost.findFirst({ where: { slug, status: "PUBLISHED" } }).catch(() => null);

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = await load(params.slug);
  if (!p) return {};
  return { title: p.title, description: p.summary || undefined, alternates: { canonical: `/newsletter/${p.slug}` }, openGraph: { type: "article", title: p.title, description: p.summary || undefined, publishedTime: p.publishedAt?.toISOString() } };
}

export default async function Issue({ params }: { params: { slug: string } }) {
  const p = await load(params.slug);
  if (!p) notFound();
  return (
    <article className="mx-auto max-w-3xl px-4 py-14">
      <Link href="/newsletter" className="inline-flex items-center gap-1.5 text-[13px] text-soft hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" />All issues</Link>
      <div className="mt-6 flex flex-wrap items-center gap-2 text-[12px] text-soft">
        <span className="badge border-line bg-muted text-soft">{p.category}</span>
        <time dateTime={p.publishedAt?.toISOString()}>{fmtDate(p.publishedAt)}</time>
        <span>·</span>
        <span>By {p.authorName}</span>
      </div>
      <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">{p.title}</h1>
      {p.summary && <p className="mt-3 text-lg text-soft">{p.summary}</p>}
      <div className="mt-8 border-t border-line pt-8"><MarkupArticle body={p.body} /></div>
      <div className="card mt-12 p-5">
        <h2 className="text-sm font-semibold">Get the bigger issues by email</h2>
        <p className="mb-3 mt-1 text-[13px] text-soft">Every issue is on the website. We only email the bigger ones.</p>
        <NewsletterForm />
      </div>
    </article>
  );
}
