"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteApplicationAction, deletePostingAction, savePostingAction, setPostingStatusAction, updateApplicationAction } from "@/actions/careers";
import { Badge, Empty, Field, Modal, useAction } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

type Posting = { id: string; title: string; team: string; location: string; type: string; description: string; status: string; applications: number };
type App = { id: string; name: string; email: string; link: string; message: string; status: string; notes: string; at: string; posting: string };
const STATUSES = ["NEW", "REVIEWING", "INTERVIEW", "OFFER", "HIRED", "REJECTED"];
const blank = { title: "", team: "", location: "Remote", type: "Full-time", description: "" };

function AppRow({ a }: { a: App }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [status, setStatus] = useState(a.status);
  const [notes, setNotes] = useState(a.notes);
  const [open, setOpen] = useState(false);
  return (
    <div className="card p-3 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <button className="text-left font-medium" onClick={() => setOpen(!open)}>{a.name}</button>
        <a className="mono text-xs text-accent" href={`mailto:${a.email}`}>{a.email}</a>
        <span className="text-xs text-soft">· {a.posting}</span>
        <span className="ml-auto mono text-xs text-soft">{fmtDateTime(a.at)}</span>
        <Badge value={status === "HIRED" ? "PASSED" : status === "REJECTED" ? "FAILED" : "PENDING"} label={status} />
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          <p className="whitespace-pre-wrap">{a.message}</p>
          {a.link && <a className="mono block break-all text-xs text-accent" href={a.link} target="_blank" rel="noreferrer noopener">{a.link}</a>}
          <div className="flex flex-wrap items-center gap-2">
            <select className="input !w-40" value={status} onChange={(e) => setStatus(e.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
            <button className="btn" disabled={pending} onClick={() => exec(() => updateApplicationAction(a.id, { status, notes }), { success: "Saved", onOk: () => router.refresh() })}>Save</button>
          </div>
          <textarea className="textarea" rows={2} placeholder="Private notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      )}
    </div>
  );
}

export function CareersAdmin({ postings, apps, isOwner }: { postings: Posting[]; apps: App[]; isOwner: boolean }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [edit, setEdit] = useState<(typeof blank & { id?: string }) | null>(null);
  const [tab, setTab] = useState<"postings" | "apps">("apps");
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <button className={`btn ${tab === "apps" ? "!border-accent text-accent" : ""}`} onClick={() => setTab("apps")}>Applications ({apps.length})</button>
        <button className={`btn ${tab === "postings" ? "!border-accent text-accent" : ""}`} onClick={() => setTab("postings")}>Job postings ({postings.length})</button>
        <button className="btn-primary ml-auto" onClick={() => { setTab("postings"); setEdit({ ...blank }); }}>New posting</button>
      </div>
      {tab === "apps" ? (
        apps.length === 0 ? <Empty title="No applications yet" hint="Introductions and applications from the public Careers page appear here." /> : <div className="space-y-2">{apps.map((a) => (
          <div key={a.id}><AppRow a={a} />{isOwner && <button className="mt-1 text-xs text-rose-600" disabled={pending} onClick={() => { if (confirm(`Delete ${a.name}'s application? This cannot be undone.`)) exec(() => deleteApplicationAction(a.id), { success: "Deleted", onOk: () => router.refresh() }); }}>Delete</button>}</div>
        ))}</div>
      ) : (
        postings.length === 0 ? <Empty title="No postings" hint="While none are open, the Careers page says you are not hiring yet and offers an introduction form." /> : <div className="space-y-2">{postings.map((p) => (
          <div key={p.id} className="card flex flex-wrap items-center gap-3 p-3 text-[13px]">
            <div className="min-w-0 flex-1"><div className="font-medium">{p.title}</div><div className="mono text-xs text-soft">{[p.team, p.location, p.type].filter(Boolean).join(" · ")} · {p.applications} application{p.applications === 1 ? "" : "s"}</div></div>
            <Badge value={p.status === "OPEN" ? "PASSED" : "LOA"} label={p.status} />
            <button className="btn" onClick={() => setEdit({ id: p.id, title: p.title, team: p.team, location: p.location, type: p.type, description: p.description })}>Edit</button>
            <button className="btn" disabled={pending} onClick={() => exec(() => setPostingStatusAction(p.id, p.status === "OPEN" ? "CLOSED" : "OPEN"), { onOk: () => router.refresh() })}>{p.status === "OPEN" ? "Close" : "Reopen"}</button>
            {isOwner && <button className="btn-danger" disabled={pending} onClick={() => { if (confirm(`Delete "${p.title}"? Its applications are kept as general introductions.`)) exec(() => deletePostingAction(p.id), { success: "Deleted", onOk: () => router.refresh() }); }}>Delete</button>}
          </div>
        ))}</div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit posting" : "New posting"}>
        {edit && (
          <div className="space-y-3">
            <Field label="Title"><input className="input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Team"><input className="input" value={edit.team} onChange={(e) => setEdit({ ...edit, team: e.target.value })} /></Field>
              <Field label="Location"><input className="input" value={edit.location} onChange={(e) => setEdit({ ...edit, location: e.target.value })} /></Field>
              <Field label="Type"><input className="input" value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value })} /></Field>
            </div>
            <Field label="Description"><textarea className="textarea" rows={8} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <p className="text-xs text-soft">New postings are open right away and appear on the public Careers page. Do not state pay or terms you have not decided on.</p>
            <button className="btn-primary w-full" disabled={pending} onClick={() => exec(() => savePostingAction(edit), { success: "Saved", onOk: () => { setEdit(null); router.refresh(); } })}>Save posting</button>
          </div>
        )}
      </Modal>
    </>
  );
}
