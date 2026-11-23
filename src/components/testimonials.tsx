import { Star } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Reveal } from "@/components/motion";

/** Homepage testimonials, managed in the staff console. Shows nothing if there are none, or if the table is not in the database yet. */
export async function Testimonials() {
  const rows = await prisma.testimonial
    .findMany({ where: { visible: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], take: 6, select: { id: true, quote: true, name: true, jobTitle: true, company: true, rating: true, photoMime: true, updatedAt: true } })
    .catch(() => []);
  if (rows.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 pt-20" aria-label="What teams say">
      <Reveal className="max-w-2xl"><p className="eyebrow">What teams say</p><h2 className="section-title mt-2">Teams that stopped running HR out of spreadsheets</h2></Reveal>
      <Reveal group className={`mt-8 grid gap-4 ${rows.length === 1 ? "max-w-2xl" : rows.length === 2 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3"}`}>
        {rows.map((t, i) => (
          <figure key={t.id} style={{ "--i": i } as React.CSSProperties} className="item flex flex-col justify-between rounded-lg border border-line bg-surface p-5">
            <div>
              {t.rating ? <div className="mb-3 flex gap-0.5 text-ink" role="img" aria-label={`Rated ${t.rating} out of 5`}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} aria-hidden className={`h-3.5 w-3.5 ${n <= t.rating! ? "fill-current" : "opacity-20"}`} />)}</div> : null}
              <blockquote className="text-[14px] leading-relaxed text-ink">&ldquo;{t.quote}&rdquo;</blockquote>
            </div>
            <figcaption className="mt-5 flex items-center gap-3">
              {t.photoMime
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={`/api/testimonial-photo/${t.id}?v=${t.updatedAt.getTime()}`} width={40} height={40} alt="" className="h-10 w-10 shrink-0 rounded-full border border-line object-cover" />
                : <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-muted text-sm font-semibold text-soft">{t.name.slice(0, 1).toUpperCase()}</span>}
              <div className="min-w-0 text-[13px]"><div className="font-medium text-ink">{t.name}</div>{(t.jobTitle || t.company) && <div className="text-soft">{[t.jobTitle, t.company].filter(Boolean).join(", ")}</div>}</div>
            </figcaption>
          </figure>
        ))}
      </Reveal>
    </section>
  );
}
