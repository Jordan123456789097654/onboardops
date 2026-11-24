"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Download, Inbox as InboxIcon, Layers, Loader2, Paperclip, Search, Sparkles, X } from "lucide-react";
import { bulkUpdateAction, clusterTicketsAction, triageUntriagedAction } from "@/actions/support-admin";
import { Empty, Modal, PageHeader, useAction, useToast } from "@/components/ui";
import { PRIORITIES, PRIORITY_RANK } from "@/lib/support-constants";
import { cn } from "@/lib/utils";
import { TicketPane } from "./ticket-pane";
import { PRIORITY_STYLE, SENTIMENT_STYLE, SLA_STYLE, fmtWait, slaTone, waitingMinutes, type InboxInfo, type Req } from "./types";

type View = "open" | "mine" | "unassigned" | "solved" | "spam" | "all";
const LIVE_MS = 8000;

function ago(iso: string, now: number): string {
  if (!now) return "";
  const m = Math.max(0, Math.floor((now - Date.parse(iso)) / 60000));
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}

const lastActivity = (r: Req) => r.messages.filter((m) => m.kind !== "NOTE").slice(-1)[0]?.at ?? r.createdAt;

export type { Req } from "./types";

export function Inbox({ rows, me, initialStatus, openId, ai, info, initialQuery }: { rows: Req[]; me: string; initialStatus: string; openId: string | null; ai: boolean; info: InboxInfo; initialQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const { exec, pending } = useAction();
  const [view, setView] = useState<View>(initialStatus === "SOLVED" ? "solved" : "open");
  const [q, setQ] = useState(initialQuery);
  const [priority, setPriority] = useState("");
  const [tag, setTag] = useState("");
  const [topic, setTopic] = useState("");
  const [inboxId, setInboxId] = useState("");
  const [sort, setSort] = useState<"new" | "priority" | "wait">("new");
  const [sel, setSel] = useState<string | null>(openId);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [groups, setGroups] = useState<{ label: string; ids: string[] }[] | null>(null);
  const [group, setGroup] = useState<number | null>(null);
  const [grouping, setGrouping] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [range, setRange] = useState({ from: "", to: "" });
  const [bulkTag, setBulkTag] = useState("");
  const [now, setNow] = useState(0);
  const [live, setLive] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number>(0);
  const known = useRef<Set<string> | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  // Live updates: re-read the inbox every few seconds while this tab is visible. Nothing you typed is lost.
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, LIVE_MS);
    return () => window.clearInterval(id);
  }, [live, router]);

  useEffect(() => {
    setUpdatedAt(Date.now());
    const ids = new Set(rows.map((r) => r.id));
    if (known.current) {
      const fresh = rows.filter((r) => !known.current!.has(r.id) && !r.spam);
      if (fresh.length) toast("ok", fresh.length === 1 ? `New request from ${fresh[0].name}` : `${fresh.length} new requests`);
    }
    known.current = ids;
    const open = rows.filter((r) => r.status !== "SOLVED" && !r.spam).length;
    document.title = open ? `(${open}) Support inbox` : "Support inbox";
  }, [rows, toast]);

  // AI sorts anything new that arrived without a category or priority.
  const untriaged = ai && rows.some((r) => !r.category && r.status !== "SOLVED" && !r.spam && r.topic !== "Privacy request");
  const triaging = useRef(false);
  useEffect(() => {
    if (!untriaged || triaging.current) return;
    triaging.current = true;
    void triageUntriagedAction().then((res) => { if (res.ok && res.data.count > 0) router.refresh(); }).finally(() => { triaging.current = false; });
  }, [untriaged, rows.length, router]);

  const stats = useMemo(() => {
    const open = rows.filter((r) => r.status !== "SOLVED" && !r.spam);
    const late = open.filter((r) => { const w = waitingMinutes(r, now); return w !== null && w >= info.sla.breachMin; }).length;
    return { open: open.length, unassigned: open.filter((r) => !r.assignee).length, urgent: open.filter((r) => r.priority === "URGENT" || r.priority === "HIGH").length, late };
  }, [rows, now, info.sla.breachMin]);

  const tags = useMemo(() => Array.from(new Set(rows.flatMap((r) => r.tags))).sort(), [rows]);
  const topics = useMemo(() => Array.from(new Set(rows.map((r) => r.topic))), [rows]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const inGroup = group !== null && groups ? new Set(groups[group]?.ids ?? []) : null;
    const list = rows.filter((r) => {
      if (view === "open" && (r.status === "SOLVED" || r.spam)) return false;
      if (view === "mine" && (r.assignee !== me || r.status === "SOLVED" || r.spam)) return false;
      if (view === "unassigned" && (r.assignee || r.status === "SOLVED" || r.spam)) return false;
      if (view === "solved" && (r.status !== "SOLVED" || r.spam)) return false;
      if (view === "spam" && !r.spam) return false;
      if (priority && r.priority !== priority) return false;
      if (tag && !r.tags.includes(tag)) return false;
      if (topic && r.topic !== topic) return false;
      if (inboxId && r.inbox !== inboxId) return false;
      if (inGroup && !inGroup.has(r.id)) return false;
      if (needle && !(r.name + " " + r.email + " " + r.message + " " + r.ref + " " + r.tags.join(" ") + " " + r.messages.map((m) => m.body).join(" ")).toLowerCase().includes(needle)) return false;
      return true;
    });
    return [...list].sort((x, y) => {
      if (sort === "priority") return (PRIORITY_RANK[x.priority] ?? 9) - (PRIORITY_RANK[y.priority] ?? 9) || lastActivity(y).localeCompare(lastActivity(x));
      if (sort === "wait") return (waitingMinutes(y, now) ?? -1) - (waitingMinutes(x, now) ?? -1);
      return lastActivity(y).localeCompare(lastActivity(x));
    });
  }, [rows, view, q, priority, tag, topic, inboxId, sort, group, groups, me, now]);

  const cur = rows.find((r) => r.id === sel) ?? null;
  const counts = {
    open: rows.filter((r) => r.status !== "SOLVED" && !r.spam).length,
    mine: rows.filter((r) => r.assignee === me && r.status !== "SOLVED" && !r.spam).length,
    unassigned: stats.unassigned,
    solved: rows.filter((r) => r.status === "SOLVED" && !r.spam).length,
    spam: rows.filter((r) => r.spam).length,
    all: rows.length,
  };

  function toggle(id: string) {
    setChecked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  const allChecked = shown.length > 0 && shown.every((r) => checked.has(r.id));
  const bulk = (patch: Record<string, unknown>, success: string) => exec(() => bulkUpdateAction({ ids: Array.from(checked), ...patch }), { success, onOk: () => { setChecked(new Set()); setBulkTag(""); router.refresh(); } });

  async function runGroup() {
    setGrouping(true);
    try {
      const res = await clusterTicketsAction();
      if (res.ok) { setGroups(res.data.groups); setGroup(null); if (!res.data.groups.length) toast("ok", "No groups of similar tickets found."); }
      else toast("error", res.error);
    } finally {
      setGrouping(false);
    }
  }

  const tabs: [View, string][] = [["open", "Open"], ["mine", "Mine"], ["unassigned", "Unassigned"], ["solved", "Solved"], ["spam", "Spam"], ["all", "All"]];

  return (
    <>
      <PageHeader title="Support inbox" sub="Replies are emailed to the customer, and show up live in their chat. Internal notes stay here.">
        <button type="button" onClick={() => setLive((v) => !v)} className={cn("btn", live && "!border-emerald-400/60")} aria-pressed={live} title="Auto-refresh every few seconds">
          <span className={cn("h-2 w-2 rounded-full", live ? "animate-pulse bg-emerald-500" : "bg-soft")} />
          {live ? "Live" : "Paused"}
          {updatedAt > 0 && live && <span className="text-[11px] text-soft">updated {ago(new Date(updatedAt).toISOString(), now) || "now"}</span>}
        </button>
        {info.can.export && <button type="button" className="btn" onClick={() => setExportOpen(true)}><Download className="h-3.5 w-3.5" />Export CSV</button>}
      </PageHeader>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Open", stats.open, ""],
          ["Unassigned", stats.unassigned, stats.unassigned ? "text-amber-600" : ""],
          ["High or urgent", stats.urgent, stats.urgent ? "text-rose-600" : ""],
          ["Past SLA", stats.late, stats.late ? "text-rose-600" : ""],
        ].map(([label, n, tone]) => (
          <div key={label as string} className="rounded-xl border border-line bg-surface px-3.5 py-2.5">
            <div className="text-[11.5px] text-soft">{label}</div>
            <div className={cn("text-xl font-semibold tabular-nums", tone as string)}>{n}</div>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-line bg-surface p-0.5">
          {tabs.map(([v, label]) => (
            <button key={v} type="button" onClick={() => { setView(v); setChecked(new Set()); }} className={cn("rounded-md px-2.5 py-1 text-[12.5px] font-medium transition", view === v ? "bg-accent text-accent-fg" : "text-soft hover:text-ink")}>
              {label}<span className={cn("ml-1 tabular-nums", view === v ? "opacity-80" : "text-soft")}>{counts[v]}</span>
            </button>
          ))}
        </div>
        <form className="relative" onSubmit={(e) => { e.preventDefault(); router.push(q.trim() ? `${pathname}?q=${encodeURIComponent(q.trim())}` : pathname); }}>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-soft" />
          <input className="input !w-64 !pl-8" placeholder="Search all tickets (press Enter)" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        <select aria-label="Priority" className="input !w-32" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">Any priority</option>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}
        </select>
        {tags.length > 0 && <select aria-label="Tag" className="input !w-32" value={tag} onChange={(e) => setTag(e.target.value)}><option value="">Any tag</option>{tags.map((t) => <option key={t}>{t}</option>)}</select>}
        <select aria-label="Topic" className="input !w-36" value={topic} onChange={(e) => setTopic(e.target.value)}><option value="">Any topic</option>{topics.map((t) => <option key={t}>{t}</option>)}</select>
        {info.inboxes.length > 0 && <select aria-label="Inbox" className="input !w-36" value={inboxId} onChange={(e) => setInboxId(e.target.value)}><option value="">All inboxes</option>{info.inboxes.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>}
        <select aria-label="Sort" className="input !w-40" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="new">Latest activity</option><option value="priority">Highest priority</option><option value="wait">Waiting longest</option>
        </select>
        {ai && (
          <button type="button" className="btn sm:ml-auto" disabled={grouping} onClick={() => void runGroup()}>
            {grouping ? <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" /> : <Layers className="h-3.5 w-3.5 text-accent" />}
            {grouping ? "Grouping…" : "Group similar"}
          </button>
        )}
      </div>

      {groups && groups.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          {groups.map((g, i) => (
            <button key={g.label} type="button" onClick={() => setGroup(group === i ? null : i)} className={cn("rounded-full border px-2.5 py-0.5 text-[12px]", group === i ? "border-accent bg-accent/10 text-accent" : "border-line bg-surface text-soft hover:text-ink")}>{g.label} · {g.ids.length}</button>
          ))}
          <button type="button" className="text-[12px] text-soft underline" onClick={() => { setGroups(null); setGroup(null); }}>Clear</button>
        </div>
      )}

      {checked.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-accent/40 bg-accent/5 px-3 py-2 text-[13px]">
          <strong>{checked.size} selected</strong>
          {info.can.close && <button className="btn !h-8" disabled={pending} onClick={() => bulk({ status: "SOLVED" }, "Marked solved")}>Solve</button>}
          <select className="input !h-8 !w-32" defaultValue="" onChange={(e) => { if (e.target.value) bulk({ priority: e.target.value }, "Priority updated"); e.target.value = ""; }}><option value="">Priority…</option>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select>
          <select className="input !h-8 !w-36" defaultValue="" onChange={(e) => { if (e.target.value) bulk({ assignee: e.target.value === "__none" ? null : e.target.value }, "Assignee updated"); e.target.value = ""; }}><option value="">Assign to…</option><option value="__none">Unassigned</option>{info.staff.map((s) => <option key={s}>{s}</option>)}</select>
          <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); const t = bulkTag.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, ""); if (t) bulk({ addTags: [t] }, "Tag added"); }}>
            <input className="input !h-8 !w-28" placeholder="Add tag" value={bulkTag} onChange={(e) => setBulkTag(e.target.value)} />
            <button className="btn !h-8" disabled={pending || !bulkTag.trim()}>Tag</button>
          </form>
          {info.can.close && <button className="btn !h-8" disabled={pending} onClick={() => { if (confirm(`Mark ${checked.size} ticket(s) as spam?`)) bulk({ spam: true }, "Marked as spam"); }}>Spam</button>}
          <button className="btn !h-8 ml-auto" onClick={() => setChecked(new Set())}><X className="h-3.5 w-3.5" />Clear</button>
        </div>
      )}

      {shown.length === 0 ? (
        <Empty title={q ? "No tickets match that search" : "Nothing here"} hint={q ? "Try fewer words, or search by reference, email or tag." : "New messages from the chat, contact form, email and the in-app feedback button appear here as they arrive."} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-[400px_minmax(0,1fr)]">
          <div className={cn("card max-h-[calc(100vh-20rem)] min-h-[420px] overflow-y-auto", cur && "hidden lg:block")}>
            <label className="flex cursor-pointer items-center gap-2 border-b border-line px-3 py-2 text-[12px] text-soft">
              <input type="checkbox" checked={allChecked} onChange={() => setChecked(allChecked ? new Set() : new Set(shown.map((r) => r.id)))} />
              Select all {shown.length}
            </label>
            {shown.map((r) => {
              const w = waitingMinutes(r, now);
              const tone = w === null ? null : slaTone(w, info.sla);
              const files = r.messages.some((m) => m.files.length > 0);
              const unread = r.messages.filter((m) => m.kind !== "NOTE").slice(-1)[0]?.kind === "VISITOR" && r.status !== "SOLVED";
              return (
                <div key={r.id} onClick={() => setSel(r.id)} className={cn("relative flex cursor-pointer gap-2.5 border-b border-line px-3 py-2.5 transition-colors hover:bg-muted", sel === r.id && "bg-accent/5")}>
                  <span className={cn("absolute inset-y-0 left-0 w-[3px]", r.priority === "URGENT" ? "bg-rose-500" : r.priority === "HIGH" ? "bg-amber-500" : "bg-transparent")} />
                  <input type="checkbox" className="mt-1" checked={checked.has(r.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(r.id)} aria-label={`Select ${r.ref}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Waiting for a reply" />}
                      <span className={cn("truncate text-[13.5px]", unread ? "font-semibold" : "font-medium")}>{r.name}</span>
                      {r.sentiment && SENTIMENT_STYLE[r.sentiment] && <span className={cn("badge !px-1.5 !py-0 text-[10px]", SENTIMENT_STYLE[r.sentiment])}>{r.sentiment}</span>}
                      <span className="ml-auto shrink-0 text-[11px] text-soft">{ago(lastActivity(r), now)}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[12.5px] text-soft">{r.aiSummary || r.message.replace(/\s+/g, " ")}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <span className="mono text-[10.5px] text-accent">#{r.ref}</span>
                      {r.status !== "OPEN" && <span className="badge border-line bg-muted !px-1.5 !py-0 text-[10px]">{r.status.replace(/_/g, " ")}</span>}
                      {r.priority !== "NORMAL" && <span className={cn("badge mono !px-1.5 !py-0 text-[10px] uppercase", PRIORITY_STYLE[r.priority])}>{r.priority}</span>}
                      {r.tags.slice(0, 2).map((t) => <span key={t} className="rounded-full border border-line px-1.5 text-[10.5px] text-soft">{t}</span>)}
                      {files && <Paperclip className="h-3 w-3 text-soft" />}
                      {tone && w !== null && <span className={cn("badge mono !px-1.5 !py-0 text-[10px]", SLA_STYLE[tone])} title="Time since the customer's last message with no reply">{fmtWait(w)}</span>}
                      {r.assignee ? <span className="ml-auto text-[11px] text-soft">{r.assignee.split(" ")[0]}</span> : <span className="ml-auto text-[11px] text-amber-600">unassigned</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={cn("card min-h-[420px] overflow-hidden lg:max-h-[calc(100vh-20rem)]", !cur && "hidden lg:block")}>
            {cur ? (
              <TicketPane key={cur.id} r={cur} all={rows} info={info} ai={ai} me={me} onBack={() => setSel(null)} onSelect={setSel} />
            ) : (
              <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-2 text-center text-soft">
                <InboxIcon className="h-6 w-6" />
                <p className="text-sm">Pick a ticket to read and reply.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal open={exportOpen} onClose={() => setExportOpen(false)} title="Export tickets to CSV">
        <div className="space-y-3 text-[13px]">
          <p className="text-soft">Includes status, priority, tags, assignee, response and resolution times and ratings. It does not include message text. Leave the dates empty to export everything.</p>
          <div className="grid grid-cols-2 gap-3">
            <label><span className="label">From</span><input type="date" className="input" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label>
            <label><span className="label">To</span><input type="date" className="input" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label>
          </div>
          <a className="btn-primary inline-flex w-full justify-center" href={`/admin/inbox/export?${new URLSearchParams({ ...(range.from ? { from: range.from } : {}), ...(range.to ? { to: range.to } : {}) }).toString()}`} onClick={() => setExportOpen(false)}>Download CSV</a>
        </div>
      </Modal>
    </>
  );
}
