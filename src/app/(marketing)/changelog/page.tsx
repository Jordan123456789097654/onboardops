import { entries } from "@/lib/changelog";

export const metadata = { title: "Changelog", description: "Every OnboardOps release: new features, improvements and fixes.", alternates: { canonical: "/changelog" } };



export default function Changelog() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-semibold">Changelog</h1>
      <div className="mt-8 space-y-8">
        {entries.map((e) => (
          <article key={e.v} className="grid gap-2 sm:grid-cols-[140px_1fr]">
            <div className="mono text-[13px]"><div className="font-semibold">v{e.v}</div><div className="text-soft">{e.date}</div></div>
            <ul className="list-disc space-y-1.5 pl-4 text-[13px]">{e.items.map((i) => <li key={i}>{i}</li>)}</ul>
          </article>
        ))}
      </div>
    </section>
  );
}
