import Link from "next/link";
import { CtaBand, PageShell } from "@/components/page-shell";
import { posts } from "@/lib/blog";
import { fmtDate } from "@/lib/utils";

export const metadata = {
  title: "Blog",
  description: "Practical HR guides for shift-based teams: documenting warnings, progressive discipline, onboarding checklists and policies.",
  alternates: { canonical: "/blog" },
};

export default function Blog() {
  return (
    <PageShell eyebrow="Blog" title="Practical HR, written plainly" intro="Short guides for managers who run shift-based teams.">
      <div className="divide-y divide-line border-y border-line">
        {posts.map((p) => (
          <article key={p.slug} className="py-5">
            <div className="mono text-xs text-soft">{fmtDate(p.date)} · {p.readMins} min read</div>
            <h2 className="mt-1 text-lg font-semibold"><Link href={`/blog/${p.slug}`} className="hover:text-accent">{p.title}</Link></h2>
            <p className="mt-1 text-[13px] text-soft">{p.description}</p>
          </article>
        ))}
      </div>
      <CtaBand />
    </PageShell>
  );
}
