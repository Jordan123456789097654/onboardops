export type ReqMessage = {
  id: string;
  kind: string;
  author: string;
  body: string;
  emailed: boolean;
  at: string;
  files: { id: string; name: string; mime: string; size: number }[];
};

export type Req = {
  id: string;
  ref: string;
  name: string;
  email: string;
  topic: string;
  message: string;
  status: string;
  source: string;
  assignee: string | null;
  workspaceId: string | null;
  workspaceName: string | null;
  createdAt: string;
  priority: string;
  tags: string[];
  category: string | null;
  sentiment: string | null;
  aiSummary: string | null;
  resolvedHint: boolean;
  inbox: string | null;
  spam: boolean;
  linkedIds: string[];
  rating: number | null;
  ratingNote: string | null;
  pageUrl: string | null;
  messages: ReqMessage[];
};

export type InboxInfo = {
  statuses: string[];
  sla: { warnMin: number; breachMin: number };
  inboxes: { id: string; name: string }[];
  staff: string[];
  can: { close: boolean; delete: boolean; export: boolean; block: boolean };
  canned: { id: string; title: string; body: string; grp: string; builtin?: boolean }[];
};

/** Minutes a ticket has been waiting for staff, or null when it is closed or waiting on the customer. */
export function waitingMinutes(r: Req, now: number): number | null {
  if (!now || r.status === "SOLVED" || r.spam) return null;
  const pub = r.messages.filter((m) => m.kind === "REPLY" || m.kind === "VISITOR");
  const last = pub[pub.length - 1];
  if (last?.kind === "REPLY") return null;
  const since = Date.parse(last ? last.at : r.createdAt);
  return Math.max(0, Math.floor((now - since) / 60000));
}

export function fmtWait(min: number): string {
  if (min < 1) return "<1m";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ${min % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

export function slaTone(min: number, sla: { warnMin: number; breachMin: number }): "ok" | "warn" | "late" {
  return min >= sla.breachMin ? "late" : min >= sla.warnMin ? "warn" : "ok";
}

export const SLA_STYLE = {
  ok: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  warn: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  late: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300",
} as const;

export const PRIORITY_STYLE: Record<string, string> = {
  URGENT: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300",
  HIGH: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  NORMAL: "border-line bg-muted text-soft",
  LOW: "border-line bg-surface text-soft",
};

export const SENTIMENT_STYLE: Record<string, string> = {
  angry: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300",
  frustrated: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
};
