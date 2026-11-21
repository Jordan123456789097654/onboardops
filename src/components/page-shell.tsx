import Link from "next/link";

export function PageShell({ eyebrow, title, intro, children, narrow }: { eyebrow?: string; title: string; intro?: string; children: React.ReactNode; narrow?: boolean }) {
  return (
    <section className={`mx-auto px-4 py-14 ${narrow ? "max-w-3xl" : "max-w-5xl"}`}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{title}</h1>
      {intro && <p className="mt-3 max-w-2xl text-base text-soft">{intro}</p>}
      <div className="mt-10">{children}</div>
    </section>
  );
}

export function CtaBand({ title = "Try it with your own team", text = "Free during the beta. Set up a workspace in a few minutes." }: { title?: string; text?: string }) {
  return (
    <div className="card mt-14 flex flex-wrap items-center justify-between gap-4 p-6">
      <div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-[13px] text-soft">{text}</p></div>
      <Link href="/register" className="btn-primary !h-10 !px-5 !text-sm">Create a workspace</Link>
    </div>
  );
}
