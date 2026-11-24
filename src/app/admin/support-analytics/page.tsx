import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage, SUPPORT_STAFF } from "@/lib/platform";
import { aiConfigured } from "@/lib/ai/groq";
import { getSupportConfig } from "@/lib/support-config";
import { PageHeader } from "@/components/ui";
import { cn } from "@/lib/utils";
import { Insights } from "./insights";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const metadata = { title: "Support analytics" };

const DAY = 86400000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dur(min: number | null): string {
  if (min === null || !Number.isFinite(min)) return "n/a";
  if (min < 1) return "<1m";
  if (min < 60) return `${Math.round(min)}m`;
  if (min < 1440) return `${(min / 60).toFixed(1)}h`;
  return `${(min / 1440).toFixed(1)}d`;
}
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const median = (a: number[]) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <div className="text-[12px] text-soft">{label}</div>
      <div className={cn("mt-0.5 text-2xl font-semibold tabular-nums", tone)}>{value}</div>
      {sub && <div className="mt-0.5 text-[11.5px] text-soft">{sub}</div>}
    </div>
  );
}

function Bars({ data, label }: { data: { key: string; n: number }[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  return (
    <div role="img" aria-label={label}>
      <div className="flex h-32 items-end gap-[3px]">
        {data.map((d) => (
          <div key={d.key} className="group relative flex h-full flex-1 items-end" title={`${d.key}: ${d.n}`}>
            <div className="w-full rounded-t bg-accent/80 transition group-hover:bg-accent" style={{ height: `${Math.max(d.n ? 4 : 0, (d.n / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10.5px] text-soft"><span>{data[0]?.key.slice(5)}</span><span>{data[data.length - 1]?.key.slice(5)}</span></div>
    </div>
  );
}

function HBars({ rows }: { rows: { label: string; n: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <ul className="space-y-1.5">
      {rows.length === 0 && <li className="text-[13px] text-soft">No data yet.</li>}
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-2 text-[12.5px]">
          <span className="w-28 shrink-0 truncate">{r.label}</span>
          <span className="h-2.5 flex-1 overflow-hidden rounded bg-muted"><span className="block h-full rounded bg-accent/80" style={{ width: `${(r.n / max) * 100}%` }} /></span>
          <span className="w-8 text-right tabular-nums text-soft">{r.n}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function SupportAnalytics({ searchParams }: { searchParams: { days?: string } }) {
  await requireStaffPage(SUPPORT_STAFF);
  const days = [7, 30, 90].includes(Number(searchParams.days)) ? Number(searchParams.days) : 30;
  const since = new Date(Date.now() - days * DAY);
  const cfg = await getSupportConfig();
  const [rows, daily] = await Promise.all([
    prisma.supportRequest.findMany({
      where: { createdAt: { gte: since }, spam: false, mergedIntoId: null, NOT: { topic: "Privacy request" } },
      select: { id: true, createdAt: true, solvedAt: true, status: true, category: true, topic: true, tags: true, assignee: true, rating: true, ratingNote: true, source: true, priority: true, messages: { where: { kind: "REPLY" }, select: { authorName: true, createdAt: true }, orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
      take: 5000,
    }),
    prisma.supportDaily.findMany({ where: { day: { gte: since.toISOString().slice(0, 10) } } }),
  ]);

  const perDay = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) perDay.set(new Date(Date.now() - i * DAY).toISOString().slice(0, 10), 0);
  rows.forEach((r) => { const k = r.createdAt.toISOString().slice(0, 10); if (perDay.has(k)) perDay.set(k, (perDay.get(k) ?? 0) + 1); });
  const volume = Array.from(perDay, ([key, n]) => ({ key, n }));

  const firstResp: number[] = [];
  const resolution: number[] = [];
  const reps = new Map<string, { replies: number; solved: number; res: number[]; first: number[] }>();
  const rep = (n: string) => { if (!reps.has(n)) reps.set(n, { replies: 0, solved: 0, res: [], first: [] }); return reps.get(n)!; };
  for (const r of rows) {
    const human = r.messages.filter((m) => m.authorName !== "Maya");
    if (human[0]) { const m = (human[0].createdAt.getTime() - r.createdAt.getTime()) / 60000; firstResp.push(m); rep(human[0].authorName).first.push(m); }
    human.forEach((m) => rep(m.authorName).replies++);
    if (r.status === "SOLVED" && r.solvedAt) {
      const m = (r.solvedAt.getTime() - r.createdAt.getTime()) / 60000;
      resolution.push(m);
      if (r.assignee) { rep(r.assignee).solved++; rep(r.assignee).res.push(m); }
    }
  }

  const sums = daily.reduce((a, d) => ({ chats: a.chats + d.chats, ai: a.ai + d.aiReplies, esc: a.esc + d.escalations }), { chats: 0, ai: 0, esc: 0 });
  const chatTickets = rows.filter((r) => r.source === "CHAT").length;
  const deflection = sums.chats > 0 ? Math.max(0, Math.round((1 - chatTickets / sums.chats) * 100)) : null;

  const rated = rows.filter((r) => r.rating !== null);
  const positive = rated.filter((r) => (r.rating ?? 0) >= 4).length;
  const csat = rated.length ? Math.round((positive / rated.length) * 100) : null;
  const complaints = rated.filter((r) => (r.rating ?? 5) <= 2 && r.ratingNote).slice(0, 5);

  const tally = (items: string[]) => Array.from(items.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map<string, number>()), ([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);
  const byCategory = tally(rows.map((r) => r.category ?? r.topic)).slice(0, 8);
  const byTag = tally(rows.flatMap((r) => r.tags)).slice(0, 8);
  const bySource = tally(rows.map((r) => ({ CHAT: "Website chat", CONTACT: "Contact form", EMAIL: "Email", IN_APP: "In-app", HELP: "Help article" }[r.source] ?? r.source)));

  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: cfg.hours.tz, weekday: "short", hour: "2-digit", hourCycle: "h23" });
  const heat = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const r of rows) {
    const p = Object.fromEntries(fmt.formatToParts(r.createdAt).map((x) => [x.type, x.value]));
    const d = WEEKDAYS.indexOf(p.weekday);
    const h = Number(p.hour);
    if (d >= 0 && h >= 0 && h < 24) heat[d][h]++;
  }
  const heatMax = Math.max(1, ...heat.flat());

  const repRows = Array.from(reps, ([name, v]) => ({ name, ...v })).sort((a, b) => b.replies - a.replies);

  return (
    <>
      <PageHeader title="Support analytics" sub={`The last ${days} days, ${rows.length} tickets. Spam, merged tickets and privacy requests are left out.`}>
        <div className="flex rounded-lg border border-line bg-surface p-0.5">
          {[7, 30, 90].map((d) => <Link key={d} href={`?days=${d}`} className={cn("rounded-md px-3 py-1 text-[12.5px] font-medium", d === days ? "bg-accent text-accent-fg" : "text-soft hover:text-ink")}>{d} days</Link>)}
        </div>
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Tickets opened" value={String(rows.length)} sub={`${rows.filter((r) => r.status !== "SOLVED").length} still open`} />
        <Stat label="First response" value={dur(median(firstResp))} sub={`median · average ${dur(avg(firstResp))}`} />
        <Stat label="Time to resolution" value={dur(median(resolution))} sub={`median · average ${dur(avg(resolution))}`} />
        <Stat label="Customer satisfaction" value={csat === null ? "n/a" : `${csat}%`} sub={`${rated.length} rating${rated.length === 1 ? "" : "s"}`} tone={csat !== null && csat < 70 ? "text-rose-600" : undefined} />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <section className="card p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Tickets per day</h2>
          <Bars data={volume} label="Tickets opened per day" />
        </section>
        <section className="card p-4">
          <h2 className="mb-1 text-sm font-semibold">{cfg.brand.name} (AI chat) deflection</h2>
          <p className="mb-3 text-[12px] text-soft">Chats that ended without anyone asking for a person. Counted without storing what was said.</p>
          <div className="text-3xl font-semibold tabular-nums">{deflection === null ? "n/a" : `${deflection}%`}</div>
          <dl className="mt-3 space-y-1 text-[12.5px]">
            <div className="flex justify-between"><dt className="text-soft">Chats started</dt><dd className="tabular-nums">{sums.chats}</dd></div>
            <div className="flex justify-between"><dt className="text-soft">AI answers given</dt><dd className="tabular-nums">{sums.ai}</dd></div>
            <div className="flex justify-between"><dt className="text-soft">Flagged for a person</dt><dd className="tabular-nums">{sums.esc}</dd></div>
            <div className="flex justify-between"><dt className="text-soft">Tickets from chat</dt><dd className="tabular-nums">{chatTickets}</dd></div>
          </dl>
          {days >= 7 && sums.chats === 0 && <p className="mt-2 text-[11.5px] text-soft">Chat counting starts once this version has been live for a while.</p>}
        </section>
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <section className="card p-4"><h2 className="mb-3 text-sm font-semibold">By topic</h2><HBars rows={byCategory} /></section>
        <section className="card p-4"><h2 className="mb-3 text-sm font-semibold">By tag</h2><HBars rows={byTag} /></section>
        <section className="card p-4"><h2 className="mb-3 text-sm font-semibold">Where tickets come from</h2><HBars rows={bySource} /></section>
      </div>

      <section className="card mb-5 overflow-x-auto p-4">
        <h2 className="mb-1 text-sm font-semibold">Busiest hours</h2>
        <p className="mb-3 text-[12px] text-soft">When tickets arrive, in {cfg.hours.tz}. Darker means busier.</p>
        <div className="min-w-[640px]" role="img" aria-label="Heatmap of ticket arrivals by weekday and hour">
          {heat.map((row, d) => (
            <div key={d} className="flex items-center gap-[2px]">
              <span className="w-9 shrink-0 text-[11px] text-soft">{WEEKDAYS[d]}</span>
              {row.map((n, h) => <span key={h} title={`${WEEKDAYS[d]} ${h}:00 · ${n}`} className="mb-[2px] h-5 flex-1 rounded-[3px] bg-accent" style={{ opacity: n ? 0.12 + (n / heatMax) * 0.88 : 0.05 }} />)}
            </div>
          ))}
          <div className="mt-1 flex pl-9 text-[10.5px] text-soft">{[0, 6, 12, 18].map((h) => <span key={h} style={{ width: "25%" }}>{h === 0 ? "12am" : h === 12 ? "12pm" : h < 12 ? `${h}am` : `${h - 12}pm`}</span>)}</div>
        </div>
      </section>

      <section className="card mb-5 overflow-x-auto p-4">
        <h2 className="mb-3 text-sm font-semibold">Team performance</h2>
        <table className="w-full min-w-[520px] border-collapse text-[13px]">
          <thead><tr>{["Teammate", "Replies sent", "Tickets solved", "Median first response", "Median resolution"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>
            {repRows.length === 0 && <tr><td className="td text-soft" colSpan={5}>No replies in this period.</td></tr>}
            {repRows.map((r) => (
              <tr key={r.name}><td className="td font-medium">{r.name}</td><td className="td tabular-nums">{r.replies}</td><td className="td tabular-nums">{r.solved}</td><td className="td">{dur(median(r.first))}</td><td className="td">{dur(median(r.res))}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      {complaints.length > 0 && (
        <section className="card mb-5 p-4">
          <h2 className="mb-3 text-sm font-semibold">Recent unhappy feedback</h2>
          <ul className="space-y-2 text-[13px]">{complaints.map((c) => <li key={c.id} className="rounded-lg border border-line bg-muted/50 p-3"><Link className="mono text-[11px] text-accent" href={`/admin/inbox?open=${c.id}`}>#{c.id.slice(-8).toUpperCase()}</Link><p className="mt-1">{c.ratingNote}</p></li>)}</ul>
        </section>
      )}

      <Insights ai={aiConfigured()} />
    </>
  );
}
