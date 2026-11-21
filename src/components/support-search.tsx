"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import type { Article } from "@/lib/docs";

export function SupportSearch({ articles, categories }: { articles: Pick<Article, "slug" | "title" | "cat" | "summary">[]; categories: readonly string[] }) {
  const [q, setQ] = useState("");
  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? articles.filter((a) => (a.title + " " + a.summary + " " + a.cat).toLowerCase().includes(t)) : null;
  }, [q, articles]);
  return (
    <div>
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-soft" />
        <input className="input !h-11 !pl-9 !text-sm" placeholder="Search the help center…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the help center" />
      </div>
      {hits ? (
        <div className="mt-8">
          <p className="mb-3 text-[13px] text-soft">{hits.length} result{hits.length === 1 ? "" : "s"}</p>
          {hits.length === 0 ? <p className="text-[14px]">No articles match. Try different words, or <Link href="/contact" className="text-accent underline">contact support</Link>.</p> : (
            <div className="divide-y divide-line border-y border-line">{hits.map((a) => <Link key={a.slug} href={`/support/${a.slug}`} className="block py-3 hover:bg-muted"><div className="text-[14px] font-medium">{a.title}</div><div className="text-[13px] text-soft">{a.cat} · {a.summary}</div></Link>)}</div>
          )}
        </div>
      ) : (
        <div className="mt-10 grid gap-x-10 gap-y-10 md:grid-cols-2">
          {categories.map((c) => (
            <section key={c}>
              <h2 className="mb-2 text-sm font-semibold">{c}</h2>
              <ul className="divide-y divide-line border-y border-line">
                {articles.filter((a) => a.cat === c).map((a) => (
                  <li key={a.slug}><Link href={`/support/${a.slug}`} className="group flex items-center justify-between gap-3 py-2.5 text-[14px] hover:text-accent">{a.title}<ArrowRight className="h-3.5 w-3.5 shrink-0 text-soft opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" /></Link></li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
