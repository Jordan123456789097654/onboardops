"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpDown, BookOpen, Loader2, Sparkles } from "lucide-react";
import { addInternalNoteAction, moveRequestToEmailAction, replyToRequestAction, startSupportAccessAction, updateRequestAction } from "@/actions/admin";
import {
  draftSupportReplyAction,
  triageSupportInboxAction,
  type SupportReplyDraft,
  type TriageItem,
  type TriagePriority,
} from "@/actions/admin-ai";
import { Badge, Drawer, Empty, Field, Modal, PageHeader, useAction, useToast } from "@/components/ui";
import { cn, fmtDateTime } from "@/lib/utils";

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
  messages: { id: string; kind: string; author: string; body: string; emailed: boolean; at: string }[];
};

const tone: Record<string, string> = { OPEN: "PENDING", WAITING: "IN_PROGRESS", SOLVED: "PASSED" };

const PRIORITY_RANK: Record<TriagePriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

const PRIORITY_STYLE: Record<TriagePriority, string> = {
  urgent: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300",
  high: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  normal: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  low: "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
};

function PriorityBadge({ priority }: { priority: TriagePriority }) {
  return (
    <span className={cn("badge mono uppercase", PRIORITY_STYLE[priority])}>
      {priority}
    </span>
  );
}

export function Inbox({
  rows,
  me,
  initialStatus,
  openId,
  ai,
}: {
  rows: Req[];
  me: string;
  initialStatus: string;
  openId: string | null;
  ai: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();
  const [status, setStatus] = useState(initialStatus);
  const [topic, setTopic] = useState("");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(openId);
  const [reply, setReply] = useState("");
  const [solve, setSolve] = useState(false);
  const [note, setNote] = useState("");
  const [access, setAccess] = useState(false);
  const [a, setA] = useState({ reason: "", hours: 1 });

  const [triage, setTriage] = useState<Record<string, TriageItem>>({});
  const [triaging, setTriaging] = useState(false);
  const [sortByPriority, setSortByPriority] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftMeta, setDraftMeta] = useState<Pick<SupportReplyDraft, "category" | "priority" | "suggestedDocSlugs"> | null>(null);

  const hasTriage = Object.keys(triage).length > 0;

  const shown = useMemo(() => {
    const filtered = rows.filter(
      (r) =>
        (!status || r.status === status) &&
        (!topic || r.topic === topic) &&
        (!q || (r.name + r.email + r.message + r.ref).toLowerCase().includes(q.toLowerCase()))
    );
    if (!sortByPriority || !hasTriage) return filtered;
    return [...filtered].sort((x, y) => {
      const rx = triage[x.id] ? PRIORITY_RANK[triage[x.id].priority] : 99;
      const ry = triage[y.id] ? PRIORITY_RANK[triage[y.id].priority] : 99;
      if (rx !== ry) return rx - ry;
      return y.createdAt.localeCompare(x.createdAt);
    });
  }, [rows, status, topic, q, sortByPriority, hasTriage, triage]);

  const cur = rows.find((r) => r.id === sel) ?? null;
  const curTriage = cur ? triage[cur.id] ?? null : null;
  const topics = Array.from(new Set(rows.map((r) => r.topic)));
  const open = rows.filter((r) => r.status !== "SOLVED").length;

  async function runTriage() {
    if (triaging) return;
    setTriaging(true);
    try {
      const res = await triageSupportInboxAction();
      if (res.ok) {
        setTriage(res.data.items);
        if (res.data.count > 0) {
          setSortByPriority(true);
          toast("ok", `Triaged ${res.data.count} open request${res.data.count === 1 ? "" : "s"} by priority.`);
        } else {
          toast("ok", "No open requests to triage.");
        }
      } else {
        toast("error", res.error);
      }
    } finally {
      setTriaging(false);
    }
  }

  async function suggestReply(requestId: string) {
    if (drafting) return;
    setDrafting(true);
    try {
      const res = await draftSupportReplyAction(requestId);
      if (res.ok) {
        setReply(res.data.reply);
        setDraftMeta({
          category: res.data.category,
          priority: res.data.priority,
          suggestedDocSlugs: res.data.suggestedDocSlugs,
        });
        toast("ok", "AI draft loaded into reply box — review and edit before sending.");
      } else {
        toast("error", res.error);
      }
    } finally {
      setDrafting(false);
    }
  }

  return (
    <>
      <PageHeader title="Support inbox" sub={`${open} open of ${rows.length}. Replies are emailed to the customer. Internal notes stay here.`} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="input !w-64" placeholder="Search name, email, text or reference" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input !w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {["OPEN", "WAITING", "SOLVED"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="input !w-44" value={topic} onChange={(e) => setTopic(e.target.value)}>
          <option value="">All topics</option>
          {topics.map((t) => <option key={t}>{t}</option>)}
        </select>
        {ai && (
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <button
              type="button"
              className="btn"
              disabled={triaging || open === 0}
              onClick={() => void runTriage()}
            >
              {triaging ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-accent" />
              )}
              <span>{triaging ? "Triaging…" : "AI Sort & Triage"}</span>
            </button>
            {hasTriage && (
              <button
                type="button"
                aria-pressed={sortByPriority}
                onClick={() => setSortByPriority((v) => !v)}
                className={cn(
                  "btn",
                  sortByPriority && "!border-accent/50 !bg-accent/10 !text-accent"
                )}
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                <span>Sort by AI priority: {sortByPriority ? "On" : "Off"}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {shown.length === 0 ? (
        <Empty title="Nothing here" hint="New messages from the contact form and the in-app feedback button appear in this list." />
      ) : (
        <div className="card max-h-[72vh] overflow-auto">
          <table className="w-full min-w-[880px] border-collapse">
            <thead>
              <tr>
                {[
                  "Ref",
                  "From",
                  "Topic",
                  ...(hasTriage ? ["AI Triage"] : []),
                  "Workspace",
                  "Status",
                  "Assignee",
                  "Received",
                ].map((h) => (
                  <th key={h} className="th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const t = triage[r.id];
                return (
                  <tr
                    key={r.id}
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => {
                      setSel(r.id);
                      setReply("");
                      setNote("");
                      setDraftMeta(null);
                    }}
                  >
                    <td className="td mono text-xs text-accent">{r.ref}</td>
                    <td className="td">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-soft">{r.email}</div>
                    </td>
                    <td className="td">{r.topic}</td>
                    {hasTriage && (
                      <td className="td max-w-[260px]">
                        {t ? (
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-1">
                              <PriorityBadge priority={t.priority} />
                              <span className="badge border-line bg-muted text-soft">{t.category}</span>
                            </div>
                            <p className="truncate text-xs text-soft" title={t.summary}>{t.summary}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-soft">—</span>
                        )}
                      </td>
                    )}
                    <td className="td">{r.workspaceName ?? "—"}</td>
                    <td className="td"><Badge value={tone[r.status] ?? "PENDING"} label={r.status} /></td>
                    <td className="td">{r.assignee ?? "—"}</td>
                    <td className="td mono text-xs">{fmtDateTime(r.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Drawer open={!!cur} onClose={() => { setSel(null); setDraftMeta(null); }} title={cur ? `Request ${cur.ref}` : ""} wide>
        {cur && (
          <div className="space-y-4 text-[13px]">
            <div className="flex flex-wrap items-center gap-2">
              <Badge value={tone[cur.status] ?? "PENDING"} label={cur.status} />
              <span className="text-soft">{cur.topic} · {cur.source === "IN_APP" ? "sent from inside the app" : cur.source === "CHAT" ? "started in the website chat" : cur.source === "EMAIL" ? "continuing by email" : "contact form"}</span>
              <span className="mono ml-auto text-xs text-soft">{fmtDateTime(cur.createdAt)}</span>
            </div>

            {curTriage && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-muted/50 px-3 py-2 text-xs">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                <PriorityBadge priority={curTriage.priority} />
                <span className="badge border-line bg-surface text-soft">{curTriage.category}</span>
                <span className="text-soft">{curTriage.summary}</span>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs text-soft">From</div>
                {cur.name}
                <div className="mono text-xs">{cur.email}</div>
              </div>
              <div>
                <div className="text-xs text-soft">Workspace</div>
                {cur.workspaceId ? <Link className="text-accent" href={`/admin/workspaces/${cur.workspaceId}`}>{cur.workspaceName}</Link> : "Not linked"}
              </div>
            </div>

            <div className="rounded-lg border border-line bg-muted p-3">
              <p className="whitespace-pre-wrap leading-relaxed">{cur.message}</p>
            </div>

            {cur.messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.kind === "NOTE"
                    ? "rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
                    : m.kind === "VISITOR"
                      ? "rounded-lg border border-accent/40 bg-accent/5 p-3"
                      : m.kind === "SYSTEM"
                        ? "rounded-lg border border-dashed border-line p-3 text-soft"
                        : "rounded-lg border border-line p-3"
                }
              >
                <div className="mono mb-1 text-[11px] uppercase text-soft">
                  {m.kind === "NOTE" ? "Internal note" : m.kind === "VISITOR" ? "Customer (from chat)" : m.kind === "SYSTEM" ? "System" : `Reply${m.emailed ? " (emailed)" : " (email failed)"}`} · {m.author} · {fmtDateTime(m.at)}
                </div>
                <p className="whitespace-pre-wrap">{m.body}</p>
              </div>
            ))}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <select className="input" value={cur.status} onChange={(e) => exec(() => updateRequestAction(cur.id, { status: e.target.value }), { onOk: () => router.refresh() })}>
                  {["OPEN", "WAITING", "SOLVED"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Assignee">
                <div className="flex gap-2">
                  <input
                    className="input"
                    defaultValue={cur.assignee ?? ""}
                    onBlur={(e) => e.target.value !== (cur.assignee ?? "") && exec(() => updateRequestAction(cur.id, { assignee: e.target.value || null }), { onOk: () => router.refresh() })}
                  />
                  <button className="btn" onClick={() => exec(() => updateRequestAction(cur.id, { assignee: me }), { onOk: () => router.refresh() })}>Me</button>
                </div>
              </Field>
            </div>

            <div className="space-y-2 border-t border-line pt-4">
              {ai && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    className="btn !h-7 !text-xs"
                    disabled={drafting || pending}
                    onClick={() => void suggestReply(cur.id)}
                  >
                    {drafting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 text-accent" />
                    )}
                    <span>{drafting ? "Drafting reply…" : "Suggest reply with AI"}</span>
                  </button>
                  {draftMeta && (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <PriorityBadge priority={draftMeta.priority} />
                      <span className="badge border-line bg-muted text-soft">{draftMeta.category}</span>
                    </div>
                  )}
                </div>
              )}

              {draftMeta && (
                <div className="rounded-md border border-line bg-muted/50 px-3 py-2 text-xs text-soft space-y-1.5">
                  <p>AI draft loaded below — review and edit before clicking <strong>Send reply</strong>. Nothing is sent automatically.</p>
                  {draftMeta.suggestedDocSlugs.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-medium text-ink">Referenced docs:</span>
                      {draftMeta.suggestedDocSlugs.map((slug) => (
                        <a
                          key={slug}
                          href={`/support/${slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded border border-line bg-surface px-1.5 py-0.5 text-[11px] text-accent hover:underline"
                        >
                          <BookOpen className="h-3 w-3" />
                          <span>/support/{slug}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {cur.source === "CHAT" && (
                <button
                  className="btn"
                  disabled={pending}
                  onClick={() => {
                    if (confirm(`Move this chat to email? ${cur.email} gets an email with the conversation, and the chat will say it continues by email.`))
                      exec(() => moveRequestToEmailAction(cur.id), { success: "Moved to email", onOk: () => router.refresh() });
                  }}
                >
                  Move to email
                </button>
              )}
              <Field label={`Reply to ${cur.email} (sent by email)`}>
                <textarea className="textarea" rows={draftMeta ? 7 : 4} value={reply} onChange={(e) => setReply(e.target.value)} />
              </Field>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={solve} onChange={(e) => setSolve(e.target.checked)} />
                Mark solved after sending
              </label>
              <button
                className="btn-primary"
                disabled={pending || drafting || reply.trim().length < 2}
                onClick={() =>
                  exec(() => replyToRequestAction(cur.id, { body: reply, markSolved: solve }), {
                    onOk: (r) => {
                      toast(r.emailed ? "ok" : "error", r.emailed ? "Reply sent" : `Saved, but the email failed: ${r.error}`);
                      setReply("");
                      setDraftMeta(null);
                      router.refresh();
                    },
                  })
                }
              >
                Send reply
              </button>
            </div>

            <div className="space-y-2">
              <Field label="Internal note">
                <textarea className="textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <button
                className="btn"
                disabled={pending || note.trim().length < 2}
                onClick={() =>
                  exec(() => addInternalNoteAction(cur.id, { body: note }), {
                    success: "Note added",
                    onOk: () => {
                      setNote("");
                      router.refresh();
                    },
                  })
                }
              >
                Add note
              </button>
            </div>

            {cur.workspaceId && (
              <div className="border-t border-line pt-4">
                <button className="btn" onClick={() => { setAccess(true); setA({ reason: `Support request ${cur.ref}: `, hours: 1 }); }}>
                  Start support access…
                </button>
                <p className="mt-1 text-xs text-soft">Read-only, time-limited, and visible to the customer.</p>
              </div>
            )}
          </div>
        )}
      </Drawer>

      <Modal open={access && !!cur} onClose={() => setAccess(false)} title="Start support access">
        <div className="space-y-3 text-[13px]">
          <p className="text-soft">
            You will see what a Supervisor sees in this workspace, read-only, with no confidential notes, documents or reviews. The owner is emailed and notified, and it appears in their audit log.
          </p>
          <Field label="Reason (shown to the customer)">
            <textarea className="textarea" rows={3} value={a.reason} onChange={(e) => setA({ ...a, reason: e.target.value })} />
          </Field>
          <Field label="Duration">
            <select className="input" value={a.hours} onChange={(e) => setA({ ...a, hours: Number(e.target.value) })}>
              {[1, 2, 4].map((h) => <option key={h} value={h}>{h} hour{h > 1 ? "s" : ""}</option>)}
            </select>
          </Field>
          <button
            className="btn-primary w-full"
            disabled={pending}
            onClick={() =>
              cur?.workspaceId &&
              exec(
                () => startSupportAccessAction({ workspaceId: cur.workspaceId, reason: a.reason, hours: a.hours, requestId: cur.id }),
                { onOk: () => { window.location.href = "/app/overview"; } }
              )
            }
          >
            Start access and open workspace
          </button>
        </div>
      </Modal>
    </>
  );
}
