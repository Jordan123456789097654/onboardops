import { prisma } from "./prisma";
import { VISITS_ROW_ID } from "./maintenance";

type DayCounts = Record<string, Record<string, number>>;
type Row = { uv?: Record<string, number>; src?: DayCounts; dev?: DayCounts; cty?: DayCounts; cmp?: DayCounts; pg?: DayCounts; paths?: Record<string, number> };

export type Ranked = { label: string; count: number }[];

export type GrowthStats = {
  days: number;
  labels: string[];
  visitors: number[];
  signups: number[];
  workspaces: number[];
  totals: { visitors: number; accounts: number; workspaces: number; home: number; pricing: number; features: number; tutorial: number; register: number };
  /** The last 7 days against the 7 before, as a percentage change. null when there is nothing to compare. */
  change: { visitors: number | null; workspaces: number | null };
  sources: Ranked;
  devices: Ranked;
  countries: Ranked;
  campaigns: Ranked;
  pages: Ranked;
  activation: { created: number; addedStaff: number; builtCourse: number; assignedTraining: number };
  trackingSince: string | null;
};

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

function sumDays(m: DayCounts | undefined, keys: Set<string>): Ranked {
  const out = new Map<string, number>();
  for (const [day, counts] of Object.entries(m ?? {})) {
    if (!keys.has(day)) continue;
    for (const [k, v] of Object.entries(counts)) out.set(k, (out.get(k) ?? 0) + (Number(v) || 0));
  }
  return [...out].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 10);
}

const pct = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

/** Everything the Growth page shows. Visit numbers are anonymous daily counts; sign-up and activation numbers come straight from the database. */
export async function getGrowthStats(days: number): Promise<GrowthStats> {
  const dayList = Array.from({ length: days }, (_, i) => dayKey(new Date(Date.now() - (days - 1 - i) * 86400000)));
  const keys = new Set(dayList);
  const since = new Date(`${dayList[0]}T00:00:00Z`);
  const [row, users, wss] = await Promise.all([
    prisma.jobRun.findUnique({ where: { id: VISITS_ROW_ID } }).catch(() => null),
    prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true }, take: 50000 }),
    prisma.workspace.findMany({ where: { createdAt: { gte: since } }, select: { id: true, createdAt: true }, take: 10000 }),
  ]);
  const data = (row?.summary ?? {}) as Row;
  const uv = data.uv ?? {};
  const perDay = (items: { createdAt: Date }[]) => dayList.map((d) => items.filter((i) => dayKey(i.createdAt) === d).length);
  const visitors = dayList.map((d) => Number(uv[d]) || 0);
  const signups = perDay(users);
  const workspaces = perDay(wss);

  const pageTotal = (k: string) => dayList.reduce((s, d) => s + (Number(data.pg?.[d]?.[k]) || 0), 0);
  const ids = wss.map((w) => w.id);
  const [emp, crs, enr] = ids.length
    ? await Promise.all([
        prisma.employeeProfile.groupBy({ by: ["workspaceId"], where: { workspaceId: { in: ids } }, _count: { _all: true } }),
        prisma.course.groupBy({ by: ["workspaceId"], where: { workspaceId: { in: ids } }, _count: { _all: true } }),
        prisma.courseEnrollment.groupBy({ by: ["workspaceId"], where: { workspaceId: { in: ids } }, _count: { _all: true } }),
      ])
    : [[], [], []];

  const last = (a: number[], n: number, from = 0) => a.slice(Math.max(0, a.length - n - from), a.length - from).reduce((x, y) => x + y, 0);
  const firstTracked = Object.keys(uv).sort()[0] ?? null;
  return {
    days,
    labels: dayList.map((d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`),
    visitors,
    signups,
    workspaces,
    totals: {
      visitors: visitors.reduce((a, b) => a + b, 0),
      accounts: users.length,
      workspaces: wss.length,
      home: pageTotal("home"), pricing: pageTotal("pricing"), features: pageTotal("features"), tutorial: pageTotal("tutorial"), register: pageTotal("register"),
    },
    change: { visitors: pct(last(visitors, 7), last(visitors, 7, 7)), workspaces: pct(last(workspaces, 7), last(workspaces, 7, 7)) },
    sources: sumDays(data.src, keys),
    devices: sumDays(data.dev, keys),
    countries: sumDays(data.cty, keys),
    campaigns: sumDays(data.cmp, keys),
    pages: Object.entries(data.paths ?? {}).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 10).map(([label, count]) => ({ label, count: Number(count) || 0 })),
    activation: {
      created: wss.length,
      addedStaff: emp.filter((g) => g._count._all >= 2).length,
      builtCourse: crs.length,
      assignedTraining: enr.length,
    },
    trackingSince: firstTracked,
  };
}
