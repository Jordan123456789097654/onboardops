import { parseMarkup } from "@/lib/email-markup";
import { cn } from "@/lib/utils";

const INLINE = /\[([^\]\n]{1,120})\]\((https:\/\/[^\s)]{1,400}|mailto:[^\s)]{1,200}|\/[^\s)/][^\s)]{0,300})\)|\*\*([^*\n]{1,200})\*\*/g;

/** **bold** and [label](https://link or /page). Everything else is plain text, so nothing a writer types can inject markup. */
function inline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    if (m[3] !== undefined) out.push(<strong key={i++} className="font-semibold text-ink">{m[3]}</strong>);
    else {
      const external = !m[2].startsWith("/");
      out.push(<a key={i++} href={m[2]} className="text-accent underline underline-offset-2" {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{m[1]}</a>);
    }
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const lines = (s: string) => s.split("\n").flatMap((l, i) => (i ? [<br key={`b${i}`} />, ...inline(l)] : inline(l)));

const TONE = {
  info: "border-blue-600 bg-blue-50 text-blue-950 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-100",
  warn: "border-amber-600 bg-amber-50 text-amber-950 dark:border-amber-500 dark:bg-amber-950/60 dark:text-amber-100",
  danger: "border-rose-600 bg-rose-50 text-rose-950 dark:border-rose-500 dark:bg-rose-950/60 dark:text-rose-100",
  ok: "border-emerald-600 bg-emerald-50 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-100",
} as const;

/** Renders a newsletter issue from the same plain-text markup the email composer uses. */
export function MarkupArticle({ body, className }: { body: string; className?: string }) {
  const blocks = parseMarkup(body);
  return (
    <div className={cn("space-y-4 text-[15.5px] leading-relaxed text-soft", className)}>
      {blocks.map((b, i) => {
        switch (b.t) {
          case "p": return <p key={i}>{lines(b.v)}</p>;
          case "h": return <h2 key={i} className="pt-4 text-xl font-semibold text-ink">{b.v}</h2>;
          case "ul": return <ul key={i} className="list-disc space-y-1.5 pl-6">{b.v.map((x, j) => <li key={j}>{inline(x)}</li>)}</ul>;
          case "ol": return <ol key={i} className="list-decimal space-y-2 pl-6">{b.v.map((x, j) => <li key={j}>{inline(x)}</li>)}</ol>;
          case "details": return (
            <dl key={i} className="divide-y divide-line rounded-xl border border-line bg-muted/50">
              {b.v.map(([k, v]) => <div key={k} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[150px_1fr]"><dt className="text-[12px] font-medium uppercase tracking-wide text-soft">{k}</dt><dd className="text-ink">{inline(v)}</dd></div>)}
            </dl>
          );
          case "callout": return <div key={i} className={cn("rounded-lg border-l-4 px-4 py-3 text-[14.5px]", TONE[b.tone])}>{lines(b.v)}</div>;
        }
      })}
    </div>
  );
}
