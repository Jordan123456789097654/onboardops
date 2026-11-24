import Link from "next/link";
import { cn } from "@/lib/utils";
import type { GrowthStats, Ranked } from "@/lib/growth";

const rate = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
const fmtPct = (n: number | null) => (n === null ? "n/a" : `${n}%`);

function Tile({ label, value, sub, delta }: { label: string; value: string; sub?: string; delta?: number | null }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <div className="text-[12px] text-soft">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {delta !== undefined && delta !== null && <span className={cn("text-[12px] font-medium tabular-nums", delta >= 0 ? "text-emerald-600" : "text-rose-600")}>{delta >= 0 ? "+" : ""}{delta}% vs prior 7d</span>}
      </div>
      {sub && <div className="mt-0.5 text-[11.5px] text-soft">{sub}</div>}
    </div>
  );
}

function Bars({ labels, values, label }: { labels: string[]; values: number[]; label: string }) {
  const max = Math.max(1, ...values);
  return (
    <div role="img" aria-label={label}>
      <div className="flex h-32 items-end gap-[3px]">
        {values.map((v, i) => (
          <div key={i} className="group relative flex h-full flex-1 items-end" title={`${labels[i]}: ${v}`}>
            <div className="w-full rounded-t bg-accent/80 group-hover:bg-accent" style={{ height: `${Math.max(v ? 4 : 0, (v / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10.5px] text-soft"><span>{labels[0]}</span><span>{labels[labels.length - 1]}</span></div>
    </div>
  );
}

function List({ rows, empty = "No data yet." }: { rows: Ranked; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = rows.reduce((s, r) => s + r.count, 0) || 1;
  return (
    <ul className="space-y-1.5">
      {rows.length === 0 && <li className="text-[13px] text-soft">{empty}</li>}
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-2 text-[12.5px]">
          <span className="w-28 shrink-0 truncate" title={r.label}>{r.label}</span>
          <span className="h-2.5 flex-1 overflow-hidden rounded bg-muted"><span className="block h-full rounded bg-accent/80" style={{ width: `${(r.count / max) * 100}%` }} /></span>
          <span className="w-16 text-right tabular-nums text-soft">{r.count} <span className="opacity-60">{Math.round((r.count / total) * 100)}%</span></span>
        </li>
      ))}
    </ul>
  );
}

function Card({ title, hint, children, className }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("card p-4", className)}>
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint && <p className="mb-3 mt-0.5 text-[12px] text-soft">{hint}</p>}
      <div className={hint ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

export function GrowthView({ s }: { s: GrowthStats }) {
  const t = s.totals;
  const regToAccount = rate(t.accounts, t.register);
  const conv = rate(t.workspaces, t.visitors);
  const activated = rate(s.activation.addedStaff, s.activation.created);

  const steps: { label: string; n: number; note: string }[] = [
    { label: "Unique visitors", n: t.visitors, note: "Each browser counted once a day" },
    { label: "Saw the sign-up page", n: t.register, note: "Reached /register" },
    { label: "Accounts created", n: t.accounts, note: "Real accounts in the database" },
    { label: "Workspaces created", n: t.workspaces, note: "Includes extra workspaces from existing accounts" },
    { label: "Added staff", n: s.activation.addedStaff, note: "Workspaces with 2 or more people" },
    { label: "Built a course", n: s.activation.builtCourse, note: "At least one course" },
    { label: "Assigned training", n: s.activation.assignedTraining, note: "At least one assignment" },
  ];

  const notes: string[] = [];
  if (t.visitors === 0) notes.push("No visitors were counted yet. Detailed tracking is new, so numbers fill in as people arrive.");
  else {
    if (t.register > 0 && regToAccount !== null && regToAccount < 15) notes.push(`${t.register} people saw the sign-up page but only ${t.accounts} accounts were created (${fmtPct(regToAccount)}). That points to friction on the form, or visitors who are only browsing.`);
    if (t.visitors > 0 && t.register / t.visitors < 0.08) notes.push(`Only ${fmtPct(rate(t.register, t.visitors))} of visitors reach the sign-up page. Make the "Create a workspace" button easier to spot, and say what it costs near the top (free during the beta).`);
    if (s.activation.created > 0 && activated !== null && activated < 50) notes.push(`Only ${activated}% of new workspaces add any staff. A follow-up email in the first two days could help (the Onboarding templates in Emails are built for this).`);
    const top = s.sources[0];
    if (top && s.sources.length > 1 && top.count / (s.sources.reduce((a, b) => a + b.count, 0) || 1) > 0.7) notes.push(`${Math.round((top.count / s.sources.reduce((a, b) => a + b.count, 0)) * 100)}% of visitors come from "${top.label}". Relying on one source is risky, so it is worth testing a second channel.`);
  }

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile label="Unique visitors" value={String(t.visitors)} sub={`${s.days} days, one per browser per day`} delta={s.change.visitors} />
        <Tile label="Accounts created" value={String(t.accounts)} sub="New people signing up" />
        <Tile label="Workspaces created" value={String(t.workspaces)} sub="New businesses" delta={s.change.workspaces} />
        <Tile label="Visitor to workspace" value={fmtPct(conv)} sub="Workspaces per 100 visitors" />
        <Tile label="Activated" value={fmtPct(activated)} sub="New workspaces that added staff" />
      </div>

      {notes.length > 0 && (
        <section className="mb-5 rounded-xl border border-accent/30 bg-accent/5 p-4">
          <h2 className="mb-1.5 text-sm font-semibold">What stands out</h2>
          <ul className="list-disc space-y-1 pl-5 text-[13px]">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </section>
      )}

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <Card title="Visitors per day" hint="Unique browsers, counted without cookies."><Bars labels={s.labels} values={s.visitors} label="Unique visitors per day" /></Card>
        <Card title="New workspaces per day" hint="From the database, so this is exact."><Bars labels={s.labels} values={s.workspaces} label="Workspaces created per day" /></Card>
      </div>

      <Card className="mb-5" title="Sign-up funnel" hint="Where people drop off between arriving and getting real use out of OnboardOps.">
        <ol className="space-y-2.5">
          {steps.map((st, i) => {
            const base = steps[0].n || 1;
            const prev = i > 0 ? steps[i - 1].n : 0;
            return (
              <li key={st.label}>
                <div className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="font-medium">{i + 1}. {st.label}</span>
                  <span className="tabular-nums"><strong>{st.n}</strong>{i > 0 && prev > 0 && st.n <= prev && <span className="ml-2 text-[11.5px] text-soft">{Math.round((st.n / prev) * 100)}% of previous</span>}</span>
                </div>
                <div className="mt-1 h-2.5 overflow-hidden rounded bg-muted"><div className="h-full rounded bg-accent/80" style={{ width: `${Math.min(100, (st.n / base) * 100)}%` }} /></div>
                <div className="mt-0.5 text-[11px] text-soft">{st.note}</div>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-[11.5px] text-soft">Visitor steps are anonymous counts and account steps are exact, so a step can be slightly out of order (for example people who sign up with Google can skip the sign-up page).</p>
      </Card>

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <Card title="Where visitors come from" hint="Direct means typed the address, a bookmark, or an app that hides its source."><List rows={s.sources} /></Card>
        <Card title="Campaigns" hint="Add ?utm_campaign=name&utm_source=facebook to links you post."><List rows={s.campaigns} empty="No tagged links yet." /></Card>
        <Card title="Pages people view" hint="Views, not people."><List rows={s.pages} /></Card>
        <Card title="Devices"><List rows={s.devices} /></Card>
        <Card title="Countries" hint="From the visitor's connection."><List rows={s.countries} /></Card>
        <Card title="Interest pages" hint="Unique visitors who viewed each page.">
          <List rows={[{ label: "Home", count: t.home }, { label: "Pricing", count: t.pricing }, { label: "Features", count: t.features }, { label: "Tutorial", count: t.tutorial }, { label: "Sign up", count: t.register }].sort((a, b) => b.count - a.count)} />
        </Card>
      </div>

      <p className="text-[12px] text-soft">
        {s.trackingSince ? `Visitor tracking has run since ${s.trackingSince}. ` : ""}Sources, devices, countries and the sign-up page step only exist for days after this update. Counting uses a daily-changing hash of the connection, so nobody is followed across days and nothing is stored in the visitor&apos;s browser.
      </p>
    </>
  );
}

export function RangeTabs({ days }: { days: number }) {
  return (
    <div className="flex rounded-lg border border-line bg-surface p-0.5">
      {[7, 30, 90].map((d) => <Link key={d} href={`?days=${d}`} className={cn("rounded-md px-3 py-1 text-[12.5px] font-medium", d === days ? "bg-accent text-accent-fg" : "text-soft hover:text-ink")}>{d} days</Link>)}
    </div>
  );
}
