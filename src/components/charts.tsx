import { cn } from "@/lib/utils";

const palette = ["bg-accent", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-violet-500", "bg-zinc-500"];

/** Stacked vertical bars. labels = x axis, series = stacked segments per label. */
export function StackedBars({ labels, series, height = 160 }: { labels: string[]; series: { name: string; values: number[] }[]; height?: number }) {
  const totals = labels.map((_, i) => series.reduce((s, x) => s + (x.values[i] ?? 0), 0));
  const max = Math.max(1, ...totals);
  return (
    <div>
      <div className="flex items-end gap-2" style={{ height }} role="img" aria-label={`Chart: ${series.map((s) => s.name).join(", ")} by ${labels.join(", ")}`}>
        {labels.map((l, i) => (
          <div key={l} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="mono text-[11px] text-soft">{totals[i] || ""}</span>
            <div className="flex w-full max-w-12 flex-col-reverse overflow-hidden rounded-t" style={{ height: `${(totals[i] / max) * 82}%` }}>
              {series.map((s, k) => (s.values[i] ? <div key={s.name} title={`${s.name}: ${s.values[i]}`} className={cn("grow-y w-full", palette[k % palette.length])} style={{ flexGrow: s.values[i], animationDelay: `${i * 60}ms` }} /> : null))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2">{labels.map((l) => <span key={l} className="mono flex-1 text-center text-[11px] text-soft">{l}</span>)}</div>
      {series.length > 1 && <div className="mt-3 flex flex-wrap gap-3 text-xs">{series.map((s, k) => <span key={s.name} className="flex items-center gap-1.5"><i className={cn("h-2.5 w-2.5 rounded-sm", palette[k % palette.length])} />{s.name}</span>)}</div>}
    </div>
  );
}

export function HBars({ rows, suffix = "%" }: { rows: { label: string; value: number; note?: string }[]; suffix?: string }) {
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={r.label}>
          <div className="mb-1 flex justify-between text-[13px]"><span className="font-medium">{r.label}</span><span className="mono text-soft">{r.note ?? `${r.value}${suffix}`}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="grow-x h-full origin-left rounded-full bg-accent" style={{ width: `${Math.min(100, r.value)}%`, animationDelay: `${i * 80}ms` }} /></div>
        </div>
      ))}
    </div>
  );
}
