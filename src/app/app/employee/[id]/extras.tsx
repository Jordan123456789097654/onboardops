"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Lock, Trash2 } from "lucide-react";
import { deleteDocumentAction, uploadDocumentAction } from "@/actions/documents";
import { saveReviewAction } from "@/actions/reviews";
import { Badge, Empty, Field, Modal, useAction } from "@/components/ui";
import { DOC_CATEGORIES } from "@/lib/constants";
import { ACCEPT_ATTR } from "@/lib/files-client";
import { fmtDate } from "@/lib/utils";

export type Doc = { id: string; title: string; category: string; restricted: boolean; visible: boolean; expires: string | null; by: string; at: string; fileId: string };
export type Rev = { id: string; kind: string; period: string; rating: number | null; summary: string; strengths: string; improvements: string; goals: string; privateNotes: string; status: string; author: string; at: string };

export function DocumentsPanel({ employeeId, docs, isAdmin }: { employeeId: string; docs: Doc[]; isAdmin: boolean }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [f, setF] = useState({ title: "", category: DOC_CATEGORIES[5] as string, restricted: false, visibleToEmployee: false, expiresAt: "" });
  const upload = () => {
    if (!file) return;
    const fd = new FormData();
    fd.set("json", JSON.stringify({ ...f, employeeId }));
    fd.set("file", file);
    exec(() => uploadDocumentAction(fd), { success: "Document uploaded", onOk: () => { setOpen(false); setFile(null); setF({ ...f, title: "" }); router.refresh(); } });
  };
  const soon = (d: string | null) => d && new Date(d).getTime() < Date.now() + 30 * 86400000;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><p className="text-[13px] text-soft">Licenses, signed forms and other records. Restricted documents are visible only to owners and admins.</p><button className="btn-primary" onClick={() => setOpen(true)}>Upload document</button></div>
      {docs.length === 0 ? <Empty title="No documents" hint="Upload a PDF or image (up to 4 MB)." /> : (
        <div className="card divide-y divide-line">{docs.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-[13px]">
            {d.restricted ? <Lock className="h-4 w-4 text-amber-600" aria-label="Restricted" /> : <FileText className="h-4 w-4 text-soft" />}
            <div className="min-w-0 flex-1"><a className="font-medium text-accent" href={`/api/files/${d.fileId}`} target="_blank" rel="noreferrer">{d.title}</a><div className="text-xs text-soft">{d.category} · uploaded {fmtDate(d.at)} by {d.by}{d.visible ? " · employee can see" : ""}</div></div>
            {d.expires && <span className="mono text-xs">{soon(d.expires) ? <Badge value="RETRAINING_REQUIRED" label={`Expires ${fmtDate(d.expires)}`} /> : `Expires ${fmtDate(d.expires)}`}</span>}
            {(!d.restricted || isAdmin) && <button className="btn !px-2" aria-label="Remove document" disabled={pending} onClick={() => { if (confirm(`Remove "${d.title}"? This cannot be undone.`)) exec(() => deleteDocumentAction(d.id), { success: "Document removed", onOk: () => router.refresh() }); }}><Trash2 className="h-3.5 w-3.5" /></button>}
          </div>))}</div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Upload document">
        <div className="space-y-3">
          <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">Only upload what you are legally required or authorized to keep. Never upload Social Security cards, bank details or medical records.</p>
          <Field label="Title"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category"><select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{DOC_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Expires (optional)"><input className="input mono" type="date" value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} /></Field>
          </div>
          <Field label="File (PDF, image, DOCX or TXT, max 4 MB)"><input type="file" accept={ACCEPT_ATTR} className="text-xs" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
          {isAdmin && <label className="flex items-start gap-2 text-[13px]"><input type="checkbox" className="mt-0.5" checked={f.restricted || f.category.startsWith("Work authorization")} disabled={f.category.startsWith("Work authorization")} onChange={(e) => setF({ ...f, restricted: e.target.checked })} />Restricted: only owners and admins can open it (always on for work-authorization documents)</label>}
          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={f.visibleToEmployee && !f.restricted} disabled={f.restricted || f.category.startsWith("Work authorization")} onChange={(e) => setF({ ...f, visibleToEmployee: e.target.checked })} />Let the employee see this document in their portal</label>
          <button className="btn-primary w-full" disabled={pending || !file || f.title.length < 2} onClick={upload}>{pending ? "Uploading…" : "Upload"}</button>
        </div>
      </Modal>
    </div>
  );
}

const blank = (): Partial<Rev> & { kind: string } => ({ kind: "ONE_ON_ONE", period: "", rating: null, summary: "", strengths: "", improvements: "", goals: "", privateNotes: "" });

export function ReviewsPanel({ employeeId, reviews }: { employeeId: string; reviews: Rev[] }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [draft, setDraft] = useState<(Partial<Rev> & { kind: string }) | null>(null);
  const save = (share: boolean) => draft && exec(() => saveReviewAction({ id: draft.id, employeeId, kind: draft.kind, periodLabel: draft.period ?? "", rating: draft.rating ?? null, summary: draft.summary ?? "", strengths: draft.strengths ?? "", improvements: draft.improvements ?? "", goals: draft.goals ?? "", privateNotes: draft.privateNotes ?? "", share }), { success: share ? "Shared with the employee" : "Draft saved", onOk: () => { setDraft(null); router.refresh(); } });
  const set = (k: keyof Rev, v: string | number | null) => draft && setDraft({ ...draft, [k]: v });
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><p className="text-[13px] text-soft">Visible to owners, admins and managers only. Private notes are never shared. Shared entries are locked.</p><button className="btn-primary" onClick={() => setDraft(blank())}>New entry</button></div>
      {reviews.length === 0 ? <Empty title="No reviews or 1:1 notes yet" /> : reviews.map((r) => (
        <div key={r.id} className="card p-4 text-[13px]">
          <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{r.kind === "ONE_ON_ONE" ? "1:1" : "Performance review"}</span>{r.period && <span className="text-soft">{r.period}</span>}{r.rating && <span className="mono">{r.rating}/5</span>}<Badge value={r.status === "SHARED" ? "ACTIVE" : "PENDING"} label={r.status === "SHARED" ? "Shared" : "Draft"} /><span className="ml-auto mono text-xs text-soft">{fmtDate(r.at)} · {r.author}</span>{r.status === "DRAFT" && <button className="btn" onClick={() => setDraft(r)}>Edit</button>}</div>
          {([["Summary", r.summary], ["Strengths", r.strengths], ["To improve", r.improvements], ["Goals", r.goals]] as const).filter(([, v]) => v).map(([k, v]) => <div key={k} className="mt-2"><div className="text-xs text-soft">{k}</div><p className="whitespace-pre-wrap">{v}</p></div>)}
          {r.privateNotes && <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"><div className="mono text-[11px] uppercase">Private, never shared</div>{r.privateNotes}</div>}
        </div>
      ))}
      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? "Edit entry" : "New review or 1:1"}>
        {draft && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Type"><select className="input" value={draft.kind} onChange={(e) => set("kind", e.target.value)}><option value="ONE_ON_ONE">1:1 note</option><option value="REVIEW">Review</option></select></Field>
              <Field label="Period"><input className="input" placeholder="Q4 2026" value={draft.period ?? ""} onChange={(e) => set("period", e.target.value)} /></Field>
              <Field label="Rating"><select className="input" value={draft.rating ?? ""} onChange={(e) => set("rating", e.target.value ? Number(e.target.value) : null)}><option value="">None</option>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select></Field>
            </div>
            <Field label="Summary (shared)"><textarea className="textarea" rows={3} value={draft.summary ?? ""} onChange={(e) => set("summary", e.target.value)} /></Field>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Strengths (shared)"><textarea className="textarea" rows={3} value={draft.strengths ?? ""} onChange={(e) => set("strengths", e.target.value)} /></Field><Field label="To improve (shared)"><textarea className="textarea" rows={3} value={draft.improvements ?? ""} onChange={(e) => set("improvements", e.target.value)} /></Field></div>
            <Field label="Goals (shared)"><textarea className="textarea" rows={2} value={draft.goals ?? ""} onChange={(e) => set("goals", e.target.value)} /></Field>
            <Field label="Private notes (managers only, never shared)"><textarea className="textarea" rows={2} value={draft.privateNotes ?? ""} onChange={(e) => set("privateNotes", e.target.value)} /></Field>
            <div className="flex gap-2"><button className="btn flex-1" disabled={pending} onClick={() => save(false)}>Save draft</button><button className="btn-primary flex-1" disabled={pending} onClick={() => { if (confirm("Share this with the employee? It will be locked and the employee is notified.")) save(true); }}>Share with employee</button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
