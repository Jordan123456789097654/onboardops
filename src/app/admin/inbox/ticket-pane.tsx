"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, Check, ChevronDown, FileText, Link2, Loader2, Merge, Paperclip, Plus, ShieldBan, Sparkles, Trash2, UserCheck, X } from "lucide-react";
import { addInternalNoteAction, moveRequestToEmailAction, replyToRequestAction, startSupportAccessAction } from "@/actions/admin";
import { draftSupportReplyAction, type SupportReplyDraft } from "@/actions/admin-ai";
import {
  createCannedAction,
  deleteTicketAction,
  getTicketActivityAction,
  linkTicketsAction,
  markSeenAction,
  markSpamAction,
  mergeTicketsAction,
  reanalyzeTicketAction,
  staffTypingAction,
  updateTicketAction,
} from "@/actions/support-admin";
import { Field, Modal, useAction, useToast } from "@/components/ui";
import { PRIORITIES } from "@/lib/support-constants";
import { fillTemplate } from "@/lib/support-templates";
import { cn, fmtDateTime } from "@/lib/utils";
import { PRIORITY_STYLE, SENTIMENT_STYLE, type InboxInfo, type Req } from "./types";

const SOURCE_LABEL: Record<string, string> = { IN_APP: "from inside the app", CHAT: "website chat", EMAIL: "email", CONTACT: "contact form", HELP: "help article" };
const sizeOf = (n: number) => (n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);

export function TicketPane({ r, all, info, ai, me, onBack, onSelect }: { r: Req; all: Req[]; info: InboxInfo; ai: boolean; me: string; onBack: () => void; onSelect: (id: string) => void }) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();
  const [reply, setReply] = useState("");
  const [solve, setSolve] = useState(false);
  const [note, setNote] = useState("");
  const [tag, setTag] = useState("");
  const [linkRef, setLinkRef] = useState("");
  const [mergeId, setMergeId] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draftMeta, setDraftMeta] = useState<Pick<SupportReplyDraft, "suggestedDocSlugs"> | null>(null);
  const [tpl, setTpl] = useState(false);
  const [tplQ, setTplQ] = useState("");
  const [manage, setManage] = useState(false);
  const [activity, setActivity] = useState<{ id: string; who: string; summary: string; at: string }[] | null>(null);
  const [access, setAccess] = useState(false);
  const [a, setA] = useState({ reason: "", hours: 1 });
  const lastPing = useRef(0);
  const threadRef = useRef<HTMLDivElement>(null);

  const refresh = () => router.refresh();
  const upd = (patch: Record<string, unknown>, success?: string) => exec(() => updateTicketAction(r.id, patch), { success, onOk: refresh });

  const lastVisitor = [...r.messages].reverse().find((m) => m.kind === "VISITOR");
  useEffect(() => {
    void markSeenAction(r.id);
  }, [r.id, lastVisitor?.id]);

  useEffect(() => {
    setReply(""); setNote(""); setSolve(false); setDraftMeta(null); setActivity(null); setManage(false); setTpl(false);
  }, [r.id]);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [r.id, r.messages.length]);

  const sameCustomer = useMemo(() => all.filter((x) => x.id !== r.id && x.email.toLowerCase() === r.email.toLowerCase()), [all, r]);
  const linked = r.linkedIds.map((id) => ({ id, ref: id.slice(-8).toUpperCase(), row: all.find((x) => x.id === id) }));
  const templates = useMemo(() => {
    const q = tplQ.trim().toLowerCase();
    const list = info.canned.filter((t) => !q || (t.title + t.body + t.grp).toLowerCase().includes(q));
    const groups = new Map<string, typeof list>();
    list.forEach((t) => groups.set(t.grp, [...(groups.get(t.grp) ?? []), t]));
    return Array.from(groups.entries());
  }, [info.canned, tplQ]);

  function onType(v: string) {
    setReply(v);
    if (v.length > 0 && Date.now() - lastPing.current > 4000) {
      lastPing.current = Date.now();
      void staffTypingAction(r.id);
    }
  }

  async function suggest() {
    if (drafting) return;
    setDrafting(true);
    try {
      const res = await draftSupportReplyAction(r.id);
      if (res.ok) {
        setReply(res.data.reply);
        setDraftMeta({ suggestedDocSlugs: res.data.suggestedDocSlugs });
        toast("ok", "Draft added. Read it and edit before you send.");
      } else toast("error", res.error);
    } finally {
      setDrafting(false);
    }
  }

  function useTemplate(body: string) {
    const text = fillTemplate(body, { name: r.name, ref: r.ref, agent: me });
    setReply((cur) => (cur.trim() ? `${cur.trimEnd()}\n\n${text}` : text));
    setTpl(false);
    setTplQ("");
  }

  function addTag(t: string) {
    const v = t.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
    if (!v || r.tags.includes(v)) return setTag("");
    setTag("");
    upd({ tags: [...r.tags, v] });
  }

  const statusTone = r.status === "SOLVED" ? "bg-emerald-500" : r.status === "WAITING" ? "bg-blue-500" : "bg-amber-500";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start gap-3 border-b border-line px-4 py-3">
        <button type="button" onClick={onBack} className="btn !px-2 lg:hidden" aria-label="Back to list"><ArrowLeft className="h-4 w-4" /></button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-[15px] font-semibold">{r.name}</h2>
            <span className="mono text-[11px] text-accent">#{r.ref}</span>
            <span className={cn("badge mono uppercase", PRIORITY_STYLE[r.priority])}>{r.priority}</span>
            {r.sentiment && SENTIMENT_STYLE[r.sentiment] && <span className={cn("badge", SENTIMENT_STYLE[r.sentiment])}>{r.sentiment}</span>}
            {r.rating !== null && <span className="badge border-line bg-muted text-soft">{r.rating >= 4 ? "Rated helpful" : "Rated unhelpful"}</span>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-soft">
            <span className="mono">{r.email}</span>
            <span>·</span>
            <span>{r.topic}, {SOURCE_LABEL[r.source] ?? r.source.toLowerCase()}{r.pageUrl ? ` (on ${r.pageUrl})` : ""}</span>
            <span>·</span>
            {r.workspaceId ? <Link className="text-accent" href={`/admin/workspaces/${r.workspaceId}`}>{r.workspaceName}</Link> : <span>no workspace</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="flex items-center gap-1.5 text-[12px] font-medium"><span className={cn("h-2 w-2 rounded-full", statusTone)} />{r.status.replace(/_/g, " ")}</span>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" ref={threadRef}>
        {(r.aiSummary || r.resolvedHint) && (
          <div className="space-y-2 rounded-xl border border-accent/30 bg-accent/5 px-3.5 py-2.5 text-[12.5px]">
            {r.aiSummary && <div className="flex items-start gap-2"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" /><span><strong>AI summary:</strong> {r.aiSummary}{r.category ? ` (${r.category})` : ""}</span></div>}
            {r.resolvedHint && r.status !== "SOLVED" && (
              <div className="flex flex-wrap items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span>This looks resolved. The customer's last message reads like it worked out.</span>
                {info.can.close && <button type="button" className="btn !h-7 !text-xs" disabled={pending} onClick={() => upd({ status: "SOLVED" }, "Marked solved")}>Mark solved</button>}
              </div>
            )}
          </div>
        )}

        <div className="rounded-xl border border-line bg-muted/60 p-3.5">
          <div className="mono mb-1 text-[11px] uppercase text-soft">Customer · {fmtDateTime(r.createdAt)}</div>
          <p className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed">{r.message}</p>
        </div>

        {r.messages.map((m) => {
          const mine = m.kind === "REPLY";
          const style =
            m.kind === "NOTE" ? "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
            : m.kind === "VISITOR" ? "border-accent/40 bg-accent/5"
            : m.kind === "SYSTEM" ? "border-dashed border-line text-soft"
            : "border-line bg-surface";
          return (
            <div key={m.id} className={cn("rounded-xl border p-3.5", style, mine && "ml-6", m.kind === "VISITOR" && "mr-6")}>
              <div className="mono mb-1 text-[11px] uppercase text-soft">
                {m.kind === "NOTE" ? "Internal note" : m.kind === "VISITOR" ? "Customer" : m.kind === "SYSTEM" ? "System" : `Reply${m.emailed ? " · emailed" : " · email failed"}`} · {m.author} · {fmtDateTime(m.at)}
              </div>
              <p className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed">{m.body}</p>
              {m.files.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.files.map((f) =>
                    f.mime.startsWith("image/") ? (
                      <a key={f.id} href={`/api/support/file/${f.id}`} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-line">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/support/file/${f.id}`} alt={f.name} className="max-h-40 max-w-[220px] object-cover" />
                      </a>
                    ) : (
                      <a key={f.id} href={`/api/support/file/${f.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px]"><FileText className="h-3.5 w-3.5" />{f.name}<span className="text-soft">{sizeOf(f.size)}</span></a>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
        {r.rating !== null && r.ratingNote && <div className="rounded-xl border border-line bg-muted/60 p-3 text-[12.5px] text-soft"><strong className="text-ink">Customer feedback:</strong> {r.ratingNote}</div>}
      </div>

      <div className="space-y-3 border-t border-line bg-surface px-4 py-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <select aria-label="Status" className="input" value={r.status} onChange={(e) => upd({ status: e.target.value })}>
            {info.statuses.filter((s) => s !== "SOLVED" || info.can.close).map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
          <select aria-label="Priority" className="input" value={r.priority} onChange={(e) => upd({ priority: e.target.value })}>
            {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
          </select>
          <select aria-label="Assignee" className="input" value={r.assignee ?? ""} onChange={(e) => upd({ assignee: e.target.value || null })}>
            <option value="">Unassigned</option>
            {Array.from(new Set([...(r.assignee ? [r.assignee] : []), ...info.staff])).map((s) => <option key={s}>{s}</option>)}
          </select>
          {info.inboxes.length > 0 ? (
            <select aria-label="Inbox" className="input" value={r.inbox ?? ""} onChange={(e) => upd({ inbox: e.target.value || null })}>
              <option value="">No inbox</option>
              {info.inboxes.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          ) : (
            <button type="button" className="btn justify-center" disabled={pending || r.assignee === me} onClick={() => upd({ assignee: me }, "Assigned to you")}><UserCheck className="h-3.5 w-3.5" />Assign to me</button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {r.tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full border border-line bg-muted px-2 py-0.5 text-[11.5px]">
              {t}
              <button type="button" aria-label={`Remove tag ${t}`} onClick={() => upd({ tags: r.tags.filter((x) => x !== t) })}><X className="h-3 w-3 text-soft" /></button>
            </span>
          ))}
          <form onSubmit={(e) => { e.preventDefault(); addTag(tag); }} className="inline-flex items-center gap-1">
            <input className="input !h-7 !w-28 !text-xs" placeholder="Add tag" value={tag} onChange={(e) => setTag(e.target.value)} list={`tags-${r.id}`} />
            <datalist id={`tags-${r.id}`}>{["bug", "billing", "onboarding", "general", "feature-request", "account"].map((t) => <option key={t} value={t} />)}</datalist>
            <button type="submit" className="btn !h-7 !px-2" aria-label="Add tag"><Plus className="h-3 w-3" /></button>
          </form>
          {linked.map((l) => (
            <span key={l.id} className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11.5px]">
              <Link2 className="h-3 w-3 text-soft" />
              {l.row ? <button type="button" className="text-accent" onClick={() => onSelect(l.id)}>#{l.ref}</button> : <span>#{l.ref}</span>}
              <button type="button" aria-label={`Unlink ${l.ref}`} onClick={() => exec(() => linkTicketsAction({ a: r.id, b: l.id, unlink: true }), { onOk: refresh })}><X className="h-3 w-3 text-soft" /></button>
            </span>
          ))}
        </div>

        {ai && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn !h-7 !text-xs" disabled={drafting || pending} onClick={() => void suggest()}>
              {drafting ? <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" /> : <Sparkles className="h-3.5 w-3.5 text-accent" />}
              {drafting ? "Drafting…" : "Suggest reply"}
            </button>
            <button type="button" className="btn !h-7 !text-xs" disabled={pending} onClick={() => exec(() => reanalyzeTicketAction(r.id), { success: "AI re-read this ticket", onOk: refresh })}>Re-run AI sort</button>
            {draftMeta && draftMeta.suggestedDocSlugs.map((s) => (
              <a key={s} href={`/support/${s}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded border border-line bg-surface px-1.5 py-0.5 text-[11px] text-accent hover:underline"><BookOpen className="h-3 w-3" />/support/{s}</a>
            ))}
          </div>
        )}

        <div className="relative">
          <textarea className="textarea w-full" rows={reply.length > 200 ? 8 : 4} placeholder={`Reply to ${r.email}. It's sent by email${r.source === "CHAT" ? " and appears in their chat" : ""}.`} value={reply} onChange={(e) => onType(e.target.value)} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" className="btn !h-8" onClick={() => setTpl((v) => !v)} aria-expanded={tpl}><FileText className="h-3.5 w-3.5" />Templates<ChevronDown className="h-3 w-3" /></button>
            {reply.trim().length > 20 && (
              <button type="button" className="btn !h-8" onClick={() => { const title = window.prompt("Name this template"); if (title) exec(() => createCannedAction({ title, body: reply.replace(r.name.split(/\s+/)[0], "{{name}}") }), { success: "Template saved", onOk: refresh }); }}>Save as template</button>
            )}
            {r.source === "CHAT" && (
              <button type="button" className="btn !h-8" disabled={pending} onClick={() => { if (confirm(`Move this chat to email? ${r.email} gets an email with the conversation, and the chat will say it continues by email.`)) exec(() => moveRequestToEmailAction(r.id), { success: "Moved to email", onOk: refresh }); }}>Move to email</button>
            )}
            <label className="ml-auto flex items-center gap-1.5 text-xs"><input type="checkbox" checked={solve} onChange={(e) => setSolve(e.target.checked)} disabled={!info.can.close} />Solve after sending</label>
            <button
              className="btn-primary"
              disabled={pending || drafting || reply.trim().length < 2}
              onClick={() => exec(() => replyToRequestAction(r.id, { body: reply, markSolved: solve }), { onOk: (res) => { toast(res.emailed ? "ok" : "error", res.emailed ? "Reply sent" : `Saved, but the email failed: ${res.error}`); setReply(""); setDraftMeta(null); setSolve(false); refresh(); } })}
            >Send reply</button>
          </div>
          {tpl && (
            <div className="absolute bottom-full left-0 z-20 mb-2 w-full max-w-md overflow-hidden rounded-xl border border-line bg-surface shadow-2xl">
              <input autoFocus className="input !rounded-none !border-0 !border-b" placeholder="Search 50+ templates" value={tplQ} onChange={(e) => setTplQ(e.target.value)} />
              <div className="max-h-72 overflow-y-auto p-1">
                {templates.length === 0 && <p className="p-3 text-xs text-soft">No templates match.</p>}
                {templates.map(([grp, list]) => (
                  <div key={grp}>
                    <div className="px-2 pb-0.5 pt-2 text-[10.5px] font-semibold uppercase tracking-wide text-soft">{grp}</div>
                    {list.map((t) => (
                      <div key={t.id} className="group flex items-center gap-1">
                        <button type="button" className="flex-1 truncate rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-muted" onClick={() => useTemplate(t.body)} title={t.body.slice(0, 200)}>{t.title}</button>
                        {!t.builtin && <span className="mr-1 rounded bg-muted px-1 text-[10px] text-soft">yours</span>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <input className="input flex-1" placeholder="Internal note (only staff see this)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn" disabled={pending || note.trim().length < 2} onClick={() => exec(() => addInternalNoteAction(r.id, { body: note }), { success: "Note added", onOk: () => { setNote(""); refresh(); } })}>Add note</button>
        </div>

        <button type="button" className="text-[12px] font-medium text-soft underline underline-offset-2 hover:text-ink" onClick={() => setManage((v) => !v)}>{manage ? "Hide" : "More actions"}: link, merge, spam, activity</button>
        {manage && (
          <div className="space-y-3 rounded-xl border border-line bg-muted/50 p-3 text-[12.5px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-16 text-soft">Link to</span>
              <input className="input !h-8 !w-36" placeholder="Ref, e.g. AB12CD34" value={linkRef} onChange={(e) => setLinkRef(e.target.value)} />
              <button className="btn !h-8" disabled={pending || linkRef.trim().length < 4} onClick={() => { const t = all.find((x) => x.ref === linkRef.trim().toUpperCase()); if (!t) return toast("error", "No ticket with that reference is loaded."); exec(() => linkTicketsAction({ a: r.id, b: t.id }), { success: "Linked", onOk: () => { setLinkRef(""); refresh(); } }); }}><Link2 className="h-3.5 w-3.5" />Link</button>
            </div>
            {sameCustomer.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-16 text-soft">Merge</span>
                <select className="input !h-8 !w-56" value={mergeId} onChange={(e) => setMergeId(e.target.value)}>
                  <option value="">Another ticket from this customer</option>
                  {sameCustomer.map((x) => <option key={x.id} value={x.id}>#{x.ref} · {x.message.slice(0, 40)}</option>)}
                </select>
                <button className="btn !h-8" disabled={pending || !mergeId} onClick={() => { if (confirm("Merge that ticket into this one? Its messages move here and it is closed. This can't be undone.")) exec(() => mergeTicketsAction({ sourceId: mergeId, targetId: r.id }), { success: "Merged", onOk: () => { setMergeId(""); refresh(); } }); }}><Merge className="h-3.5 w-3.5" />Merge into this</button>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-16 text-soft">Spam</span>
              {r.spam ? (
                <button className="btn !h-8" disabled={pending} onClick={() => exec(() => markSpamAction({ id: r.id, spam: false }), { success: "Restored", onOk: refresh })}>Not spam</button>
              ) : (
                <>
                  <button className="btn !h-8" disabled={pending || !info.can.close} onClick={() => exec(() => markSpamAction({ id: r.id, spam: true }), { success: "Marked as spam", onOk: refresh })}>Mark as spam</button>
                  {info.can.block && <button className="btn !h-8" disabled={pending} onClick={() => { if (confirm(`Mark as spam and block ${r.email} from opening new requests?`)) exec(() => markSpamAction({ id: r.id, spam: true, block: true }), { success: "Spam, sender blocked", onOk: refresh }); }}><ShieldBan className="h-3.5 w-3.5" />Spam and block sender</button>}
                </>
              )}
              {info.can.delete && <button className="btn !h-8 text-rose-600" disabled={pending} onClick={() => { if (confirm("Delete this ticket and all its messages permanently? This can't be undone.")) exec(() => deleteTicketAction(r.id), { success: "Deleted", onOk: () => { onBack(); refresh(); } }); }}><Trash2 className="h-3.5 w-3.5" />Delete</button>}
            </div>
            {r.workspaceId && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-16 text-soft">Access</span>
                <button className="btn !h-8" onClick={() => { setAccess(true); setA({ reason: `Support request ${r.ref}: `, hours: 1 }); }}>Start support access…</button>
                <span className="text-soft">Read-only, time-limited, visible to the customer.</span>
              </div>
            )}
            <div>
              <button className="btn !h-8" onClick={async () => { const res = await getTicketActivityAction(r.id); if (res.ok) setActivity(res.data); else toast("error", res.error); }}>Show activity log</button>
              {activity && (
                <ul className="mt-2 space-y-1">
                  {activity.length === 0 && <li className="text-soft">No staff actions recorded yet.</li>}
                  {activity.map((x) => <li key={x.id} className="flex gap-2"><span className="mono shrink-0 text-[11px] text-soft">{fmtDateTime(x.at)}</span><span>{x.who}: {x.summary}</span></li>)}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      <Modal open={access} onClose={() => setAccess(false)} title="Start support access">
        <div className="space-y-3 text-[13px]">
          <p className="text-soft">You will see what a Supervisor sees in this workspace, read-only, with no confidential notes, documents or reviews. The owner is emailed and notified, and it appears in their audit log.</p>
          <Field label="Reason (shown to the customer)"><textarea className="textarea" rows={3} value={a.reason} onChange={(e) => setA({ ...a, reason: e.target.value })} /></Field>
          <Field label="Duration">
            <select className="input" value={a.hours} onChange={(e) => setA({ ...a, hours: Number(e.target.value) })}>{[1, 2, 4].map((h) => <option key={h} value={h}>{h} hour{h > 1 ? "s" : ""}</option>)}</select>
          </Field>
          <button className="btn-primary w-full" disabled={pending} onClick={() => r.workspaceId && exec(() => startSupportAccessAction({ workspaceId: r.workspaceId, reason: a.reason, hours: a.hours, requestId: r.id }), { onOk: () => { window.location.href = "/app/overview"; } })}>Start access and open workspace</button>
        </div>
      </Modal>
    </div>
  );
}
