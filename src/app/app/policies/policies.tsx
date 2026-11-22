"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Paperclip } from "lucide-react";
import { savePolicyAction } from "@/actions/policies";
import { Badge, Empty, Field, Modal, PageHeader, useAction } from "@/components/ui";
import { Bar } from "@/components/motion";
import { ACCEPT_ATTR } from "@/lib/files-client";

type Row = { id: string; title: string; description: string; contentMarkdown: string; fileId: string | null; fileName: string | null; version: number; appliesToAll: boolean; requiredJobRoleIds: string[]; isPublished: boolean; total: number; signed: number; unsigned: string[] };
type Draft = { id?: string; title: string; description: string; contentMarkdown: string; appliesToAll: boolean; requiredJobRoleIds: string[]; publish: boolean; newVersion: boolean; fileName?: string | null };

const blank = (): Draft => ({ title: "", description: "", contentMarkdown: "", appliesToAll: true, requiredJobRoleIds: [], publish: true, newVersion: false });

export function Policies({ rows, roles, canEdit }: { rows: Row[]; roles: { id: string; title: string }[]; canEdit: boolean }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const close = () => { setDraft(null); setFile(null); };
  const save = () => {
    if (!draft) return;
    const fd = new FormData();
    const { fileName, ...json } = draft;
    fd.set("json", JSON.stringify(json));
    if (file) fd.set("file", file);
    exec(() => savePolicyAction(fd), { success: draft.publish ? "Policy saved. Employees in scope were notified if this needs a new signature." : "Draft saved", onOk: () => { close(); router.refresh(); } });
  };
  return (
    <>
      <PageHeader title="Policies" sub="Publish a policy or handbook, assign it to job roles, and track who has signed the current version.">
        {canEdit && <button className="btn-primary" onClick={() => setDraft(blank())}>New policy</button>}
      </PageHeader>
      {rows.length === 0 ? <Empty title="No policies yet" hint="Upload a PDF or write the policy text, choose who must sign it, and publish." /> : (
        <div className="space-y-3">
          {rows.map((p) => {
            const pct = p.total ? Math.round((p.signed / p.total) * 100) : 0;
            return (
              <div key={p.id} className="card lift p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <FileText className="h-4 w-4 text-soft" /><h2 className="font-medium">{p.title}</h2><span className="mono text-xs text-soft">v{p.version}</span>
                  {p.isPublished ? <Badge value="ACTIVE" label="Published" /> : <Badge value="LOA" label="Draft" />}
                  <span className="ml-auto flex gap-2">
                    <a className="btn" href={`/print/policy/${p.id}`} target="_blank" rel="noreferrer">Sign-off sheet</a>
                    {p.fileId && <a className="btn" href={`/api/files/${p.fileId}`} target="_blank" rel="noreferrer"><Paperclip className="h-3.5 w-3.5" />PDF</a>}
                    <button className="btn" onClick={() => setOpen(open === p.id ? null : p.id)}>{p.unsigned.length} unsigned</button>
                    {canEdit && <button className="btn" onClick={() => setDraft({ id: p.id, title: p.title, description: p.description, contentMarkdown: p.contentMarkdown, appliesToAll: p.appliesToAll, requiredJobRoleIds: p.requiredJobRoleIds, publish: p.isPublished, newVersion: false, fileName: p.fileName })}>Edit</button>}
                  </span>
                </div>
                {p.description && <p className="mt-1 text-[13px] text-soft">{p.description}</p>}
                <div className="mt-3 flex items-center gap-3"><Bar pct={pct} className="flex-1" /><span className="mono text-xs text-soft">{p.signed}/{p.total} signed</span></div>
                {open === p.id && <div className="anim-slide-down mt-3 rounded-md border border-line bg-muted p-3 text-[13px]">{p.unsigned.length === 0 ? "Everyone in scope has signed this version." : <><div className="mb-1 text-xs font-medium text-soft">Has not signed v{p.version}</div><ul className="columns-2 gap-4">{p.unsigned.map((u) => <li key={u} className="mono text-xs">{u}</li>)}</ul></>}</div>}
              </div>
            );
          })}
        </div>
      )}
      <Modal open={!!draft} onClose={close} title={draft?.id ? "Edit policy" : "New policy"}>
        {draft && (
          <div className="space-y-3">
            <Field label="Title"><input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
            <Field label="Short description"><input className="input" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>
            <Field label="Policy text (Markdown, optional if you upload a PDF)"><textarea className="textarea" rows={6} value={draft.contentMarkdown} onChange={(e) => setDraft({ ...draft, contentMarkdown: e.target.value })} /></Field>
            <Field label={`PDF or document (max 4 MB)${draft.fileName ? `. Current: ${draft.fileName}` : ""}`}><input type="file" accept={ACCEPT_ATTR} className="text-xs" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
            <div>
              <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={draft.appliesToAll} onChange={(e) => setDraft({ ...draft, appliesToAll: e.target.checked })} />Everyone must sign</label>
              {!draft.appliesToAll && <div className="mt-2 space-y-1 rounded-md border border-line p-2">{roles.map((r) => <label key={r.id} className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={draft.requiredJobRoleIds.includes(r.id)} onChange={() => setDraft({ ...draft, requiredJobRoleIds: draft.requiredJobRoleIds.includes(r.id) ? draft.requiredJobRoleIds.filter((x) => x !== r.id) : [...draft.requiredJobRoleIds, r.id] })} />{r.title}</label>)}</div>}
            </div>
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={draft.publish} onChange={(e) => setDraft({ ...draft, publish: e.target.checked })} />Published (visible to employees)</label>
            {draft.id && (() => {
              const orig = rows.find((r) => r.id === draft.id)?.contentMarkdown ?? "";
              const lines = (t: string) => t.split(String.fromCharCode(10));
              const oldL = lines(orig), newL = lines(draft.contentMarkdown);
              const removed = oldL.filter((l) => l.trim() && !newL.includes(l)), added = newL.filter((l) => l.trim() && !oldL.includes(l));
              if (!removed.length && !added.length) return null;
              return (
                <div className="rounded-md border border-line bg-muted p-2 text-xs">
                  <div className="mb-1 font-medium">Changes from the saved version ({removed.length} removed, {added.length} added)</div>
                  <div className="max-h-40 space-y-0.5 overflow-y-auto mono">{removed.map((l, i) => <div key={`r${i}`} className="text-rose-700 dark:text-rose-300">- {l}</div>)}{added.map((l, i) => <div key={`a${i}`} className="text-emerald-700 dark:text-emerald-300">+ {l}</div>)}</div>
                  {!draft.newVersion && <p className="mt-1 text-soft">The text changed. Tick &quot;new version&quot; below if employees must sign again.</p>}
                </div>
              );
            })()}
            {draft.id && <label className="flex items-start gap-2 text-[13px]"><input type="checkbox" className="mt-0.5" checked={draft.newVersion} onChange={(e) => setDraft({ ...draft, newVersion: e.target.checked })} />This is a new version. Everyone in scope must sign again and is notified.</label>}
            <button className="btn-primary w-full" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save policy"}</button>
          </div>
        )}
      </Modal>
    </>
  );
}
