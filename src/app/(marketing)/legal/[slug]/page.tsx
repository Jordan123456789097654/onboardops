import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE, legalPages } from "@/lib/site";
import { legalDocs } from "../content";

export function generateStaticParams() {
  return Object.keys(legalDocs).map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const d = legalDocs[params.slug];
  return { title: d?.title ?? "Legal", description: d?.summary };
}

const slugId = (s: string, i: number) => `s${i + 1}-${s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

export default function LegalPage({ params }: { params: { slug: string } }) {
  const doc = legalDocs[params.slug];
  if (!doc) notFound();
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-[220px_1fr_200px]">
      <aside className="lg:sticky lg:top-20 lg:h-fit">
        <p className="eyebrow mb-2">Legal</p>
        <nav className="flex flex-col text-[13px]" aria-label="Legal documents">
          {legalPages.map((l) => (
            <Link key={l.href} href={l.href} className={`rounded-md px-2 py-1.5 hover:bg-muted ${l.href === `/legal/${params.slug}` ? "bg-muted font-medium text-ink" : "text-soft"}`}>{l.label}</Link>
          ))}
        </nav>
      </aside>
      <article className="min-w-0 max-w-3xl">
        <h1 className="text-3xl font-semibold sm:text-4xl">{doc.title}</h1>
        <p className="mono mt-2 text-xs text-soft">Last updated {SITE.legalUpdated} · Governed by the laws of the State of {SITE.state}</p>
        {doc.short && <div className="mt-6 rounded-lg border border-line bg-muted p-4 text-[13px] leading-relaxed"><div className="mb-1 text-xs font-semibold">The short version</div><p className="text-soft">{doc.short}</p></div>}
        <div className="legal">
          {doc.sections.map((s, i) => (
            <section key={s.title} id={slugId(s.title, i)} className="scroll-mt-20">
              <h2>{i + 1}. {s.title}</h2>
              {s.body}
            </section>
          ))}
        </div>
        <div className="mt-12 border-t border-line pt-5 text-[13px] text-soft">Questions about this document? Use the <Link className="text-accent underline" href="/contact">contact form</Link>. See also the <Link className="text-accent underline" href="/support">help center</Link>.</div>
      </article>
      <aside className="hidden lg:sticky lg:top-20 lg:block lg:h-fit">
        <p className="mb-2 text-xs font-semibold">On this page</p>
        <nav className="max-h-[70vh] space-y-0.5 overflow-y-auto text-[12px]" aria-label="Sections">
          {doc.sections.map((s, i) => <a key={s.title} href={`#${slugId(s.title, i)}`} className="block rounded px-1.5 py-1 text-soft hover:bg-muted hover:text-ink">{i + 1}. {s.title}</a>)}
        </nav>
      </aside>
    </div>
  );
}
