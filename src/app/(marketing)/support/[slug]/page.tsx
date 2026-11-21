import Link from "next/link";
import { notFound } from "next/navigation";
import { articles, bySlug, categories, type Block } from "@/lib/docs";
import { SITE } from "@/lib/site";

export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}
export function generateMetadata({ params }: { params: { slug: string } }) {
  const a = bySlug(params.slug);
  return { title: a ? `${a.title} · Help center` : "Help center", description: a?.summary };
}

function render(b: Block, i: number) {
  switch (b.t) {
    case "p": return <p key={i}>{b.v}</p>;
    case "h": return <h2 key={i}>{b.v}</h2>;
    case "ol": return <ol key={i} className="mt-2 list-decimal space-y-1 pl-5 text-[14px] leading-relaxed text-soft">{b.v.map((x) => <li key={x}>{x}</li>)}</ol>;
    case "ul": return <ul key={i}>{b.v.map((x) => <li key={x}>{x}</li>)}</ul>;
    case "note": return <div key={i} className="mt-4 rounded-lg border border-line bg-muted p-3 text-[13px] text-soft"><strong>Note.</strong> {b.v}</div>;
    case "table": return (
      <div key={i} className="mt-3 overflow-x-auto rounded-lg border border-line">
        <table className="w-full border-collapse text-left"><thead><tr>{b.head.map((h) => <th key={h} className="th !static !normal-case !tracking-normal">{h}</th>)}</tr></thead>
          <tbody>{b.rows.map((r) => <tr key={r[0]}>{r.map((c, j) => <td key={j} className={`td ${j === 0 ? "font-medium" : "text-soft"}`}>{c}</td>)}</tr>)}</tbody></table>
      </div>
    );
  }
}

export default function Article({ params }: { params: { slug: string } }) {
  const a = bySlug(params.slug);
  if (!a) notFound();
  const idx = articles.findIndex((x) => x.slug === a.slug);
  const prev = articles[idx - 1], next = articles[idx + 1];
  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-14 md:grid-cols-[230px_1fr]">
      <aside className="md:sticky md:top-20 md:h-fit">
        <Link href="/support" className="mb-3 inline-block text-[13px] text-accent">← Help center</Link>
        <nav className="max-h-[70vh] space-y-4 overflow-y-auto text-[13px]" aria-label="Help articles">
          {categories.map((c) => (
            <div key={c}><div className="mb-1 text-xs font-semibold text-ink">{c}</div>
              {articles.filter((x) => x.cat === c).map((x) => <Link key={x.slug} href={`/support/${x.slug}`} className={`block rounded-md px-2 py-1 hover:bg-muted ${x.slug === a.slug ? "bg-muted font-medium text-ink" : "text-soft"}`}>{x.title}</Link>)}
            </div>
          ))}
        </nav>
      </aside>
      <article className="min-w-0">
        <p className="eyebrow">{a.cat}</p>
        <h1 className="mt-2 text-3xl font-semibold">{a.title}</h1>
        <p className="lead mt-3 !text-base">{a.summary}</p>
        <div className="legal mt-6">{a.body.map(render)}</div>
        <div className="mt-10 flex flex-wrap justify-between gap-3 border-t border-line pt-5 text-[13px]">
          {prev ? <Link href={`/support/${prev.slug}`} className="text-soft hover:text-ink">← {prev.title}</Link> : <span />}
          {next && <Link href={`/support/${next.slug}`} className="text-soft hover:text-ink">{next.title} →</Link>}
        </div>
        <div className="card mt-8 p-4 text-[13px]">Still stuck? <Link href="/contact" className="text-accent underline">Contact support</Link>. Last reviewed {SITE.legalUpdated}.</div>
      </article>
    </div>
  );
}
