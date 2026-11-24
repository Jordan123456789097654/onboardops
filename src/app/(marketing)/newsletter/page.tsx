import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { NewsletterForm } from "@/components/newsletter-form";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Newsletter", description: "News, releases, tips and honest write-ups from the OnboardOps team.", alternates: { canonical: "/newsletter" } };

const BADGE: Record<string, string> = {
  Incident: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300",
  Release: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  Tips: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
};

export default async function NewsletterPage() {
  const posts = await prisma.newsletterPost
    .findMany({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, take: 100, select: { id: true, slug: true, title: true, summary: true, category: true, publishedAt: true } })
    .catch(() => []);
  return (
    <PageShell eyebrow="Newsletter" title="News from the OnboardOps team" intro="Releases, tips and honest write-ups, including when things go wrong. Every issue is posted here, and we only email the bigger ones.">
      <div className="card mb-10 p-5">
        <h2 className="text-sm font-semibold">Get the bigger issues by email</h2>
        <p className="mb-3 mt-1 text-[13px] text-soft">Releases and important notices, a few times a year. We never share your address.</p>
        <NewsletterForm />
      </div>

      {posts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-8 text-center text-[14px] text-soft">The first issue is on its way. Subscribe above and we&apos;ll let you know.</p>
      ) : (
        <div className="divide-y divide-line border-y border-line">
          {posts.map((p) => (
            <Link key={p.id} href={`/newsletter/${p.slug}`} className="group block py-5">
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-soft">
                <span className={`badge ${BADGE[p.category] ?? "border-line bg-muted text-soft"}`}>{p.category}</span>
                <time dateTime={p.publishedAt?.toISOString()}>{fmtDate(p.publishedAt)}</time>
              </div>
              <h2 className="mt-1.5 text-lg font-semibold group-hover:text-accent">{p.title}</h2>
              {p.summary && <p className="mt-1 max-w-2xl text-[14px] text-soft">{p.summary}</p>}
              <span className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-accent">Read the issue <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
            </Link>
          ))}
        </div>
      )}
    </PageShell>
  );
}
