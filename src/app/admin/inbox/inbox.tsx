"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addInternalNoteAction, replyToRequestAction, startSupportAccessAction, updateRequestAction } from "@/actions/admin";
import { Badge, Drawer, Empty, Field, Modal, PageHeader, useAction, useToast } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

export type Req = { id: string; ref: string; name: string; email: string; topic: string; message: string; status: string; source: string; assignee: string | null; workspaceId: string | null; workspaceName: string | null; createdAt: string; messages: { id: string; kind: string; author: string; body: string; emailed: boolean; at: string }[] };
const tone: Record<string, string> = { OPEN: "PENDING", WAITING: "IN_PROGRESS", SOLVED: "PASSED" };

export function Inbox({ rows, me, initialStatus, openId }: { rows: Req[]; me: string; initialStatus: string; openId: string | null }) {
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
  const shown = useMemo(() => rows.filter((r) => (!status || r.status === status) && (!topic || r.topic === topic) && (!q || (r.name + r.email + r.message + r.ref).toLowerCase().includes(q.toLowerCase()))), [rows, status, topic, q]);
  const cur = rows.find((r) => r.id === sel) ?? null;
  const topics = Array.from(new Set(rows.map((r) => r.topic)));
  const open = rows.filter((r) => r.status !== "SOLVED").length;

  return (
    <>
      <PageHeader title="Support inbox" sub={`${open} open of ${rows.length}. Replies are emailed to the customer. Internal notes stay here.`} />
      <div className="mb-3 flex flex-wrap gap-2">
        <input className="input !w-64" placeholder="Search name, email, text or reference" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input !w-40" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{["OPEN", "WAITING", "SOLVED"].map((s) => <option key={s}>{s}</option>)}</select>
        <select className="input !w-44" value={topic} onChange={(e) => setTopic(e.target.value)}><option value="">All topics</option>{topics.map((t) => <option key={t}>{t}</option>)}</select>
      </div>
      {shown.length === 0 ? <Empty title="Nothing here" hint="New messages from the contact form and the in-app feedback button appear in this list." /> : (
        <div className="card max-h-[72vh] overflow-auto">
          <table className="w-full min-w-[840px] border-collapse"><thead><tr>{["Ref", "From", "Topic", "Workspace", "Status", "Assignee", "Received"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>{shown.map((r) => (
              <tr key={r.id} className="cursor-pointer hover:bg-muted" onClick={() => { setSel(r.id); setReply(""); setNote(""); }}>
                <td className="td mono text-xs text-accent">{r.ref}</td><td className="td"><div className="font-medium">{r.name}</div><div className="text-xs text-soft">{r.email}</div></td><td className="td">{r.topic}</td><td className="td">{r.workspaceName ?? "—"}</td>
                <td className="td"><Badge value={tone[r.status] ?? "PENDING"} label={r.status} /></td><td className="td">{r.assignee ?? "—"}</td><td className="td mono text-xs">{fmtDateTime(r.createdAt)}</td>
              </tr>))}</tbody></table>
        </div>
      )}
      <Drawer open={!!cur} onClose={() => setSel(null)} title={cur ? `Request ${cur.ref}` : ""} wide>
        {cur && (
          <div className="space-y-4 text-[13px]">
            <div className="flex flex-wrap items-center gap-2"><Badge value={tone[cur.status] ?? "PENDING"} label={cur.status} /><span className="text-soft">{cur.topic} · {cur.source === "IN_APP" ? "sent from inside the app" : "contact form"}</span><span className="mono ml-auto text-xs text-soft">{fmtDateTime(cur.createdAt)}</span></div>
            <div className="grid gap-3 sm:grid-cols-2"><div><div className="text-xs text-soft">From</div>{cur.name}<div className="mono text-xs">{cur.email}</div></div><div><div className="text-xs text-soft">Workspace</div>{cur.workspaceId ? <Link className="text-accent" href={`/admin/workspaces/${cur.workspaceId}`}>{cur.workspaceName}</Link> : "Not linked"}</div></div>
            <div className="rounded-lg border border-line bg-muted p-3"><p className="whitespace-pre-wrap leading-relaxed">{cur.message}</p></div>
            {cur.messages.map((m) => (
              <div key={m.id} className={m.kind === "NOTE" ? "rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200" : "rounded-lg border border-line p-3"}>
                <div className="mono mb-1 text-[11px] uppercase text-soft">{m.kind === "NOTE" ? "Internal note" : `Reply${m.emailed ? " (emailed)" : " (email failed)"}`} · {m.author} · {fmtDateTime(m.at)}</div><p className="whitespace-pre-wrap">{m.body}</p>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Status"><select className="input" value={cur.status} onChange={(e) => exec(() => updateRequestAction(cur.id, { status: e.target.value }), { onOk: () => router.refresh() })}>{["OPEN", "WAITING", "SOLVED"].map((s) => <option key={s}>{s}</option>)}</select></Field>
              <Field label="Assignee"><div className="flex gap-2"><input className="input" defaultValue={cur.assignee ?? ""} onBlur={(e) => e.target.value !== (cur.assignee ?? "") && exec(() => updateRequestAction(cur.id, { assignee: e.target.value || null }), { onOk: () => router.refresh() })} /><button className="btn" onClick={() => exec(() => updateRequestAction(cur.id, { assignee: me }), { onOk: () => router.refresh() })}>Me</button></div></Field>
            </div>
            <div className="space-y-2 border-t border-line pt-4">
              <Field label={`Reply to ${cur.email} (sent by email)`}><textarea className="textarea" rows={4} value={reply} onChange={(e) => setReply(e.target.value)} /></Field>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={solve} onChange={(e) => setSolve(e.target.checked)} />Mark solved after sending</label>
              <button className="btn-primary" disabled={pending || reply.trim().length < 2} onClick={() => exec(() => replyToRequestAction(cur.id, { body: reply, markSolved: solve }), { onOk: (r) => { toast(r.emailed ? "ok" : "error", r.emailed ? "Reply sent" : `Saved, but the email failed: ${r.error}`); setReply(""); router.refresh(); } })}>Send reply</button>
            </div>
            <div className="space-y-2">
              <Field label="Internal note"><textarea className="textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
              <button className="btn" disabled={pending || note.trim().length < 2} onClick={() => exec(() => addInternalNoteAction(cur.id, { body: note }), { success: "Note added", onOk: () => { setNote(""); router.refresh(); } })}>Add note</button>
            </div>
            {cur.workspaceId && <div className="border-t border-line pt-4"><button className="btn" onClick={() => { setAccess(true); setA({ reason: `Support request ${cur.ref}: `, hours: 1 }); }}>Start support access…</button><p className="mt-1 text-xs text-soft">Read-only, time-limited, and visible to the customer.</p></div>}
          </div>
        )}
      </Drawer>
      <Modal open={access && !!cur} onClose={() => setAccess(false)} title="Start support access">
        <div className="space-y-3 text-[13px]">
          <p className="text-soft">You will see what a Supervisor sees in this workspace, read-only, with no confidential notes, documents or reviews. The owner is emailed and notified, and it appears in their audit log.</p>
          <Field label="Reason (shown to the customer)"><textarea className="textarea" rows={3} value={a.reason} onChange={(e) => setA({ ...a, reason: e.target.value })} /></Field>
          <Field label="Duration"><select className="input" value={a.hours} onChange={(e) => setA({ ...a, hours: Number(e.target.value) })}>{[1, 2, 4].map((h) => <option key={h} value={h}>{h} hour{h > 1 ? "s" : ""}</option>)}</select></Field>
          <button className="btn-primary w-full" disabled={pending} onClick={() => cur?.workspaceId && exec(() => startSupportAccessAction({ workspaceId: cur.workspaceId, reason: a.reason, hours: a.hours, requestId: cur.id }), { onOk: () => { window.location.href = "/app/overview"; } })}>Start access and open workspace</button>
        </div>
      </Modal>
    </>
  );
}
