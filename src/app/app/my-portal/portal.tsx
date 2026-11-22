"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fileAppealAction } from "@/actions/discipline2";
import { addChecklistPhotoAction } from "@/actions/checklists";
import { clockInAction, clockOutAction, requestShiftSwapAction } from "@/actions/operations";
import { submitProfileChangeAction } from "@/actions/records";
import { acknowledgeInfractionAction } from "@/actions/infractions";
import { submitChecklistAction } from "@/actions/checklists";
import ReactMarkdown from "react-markdown";
import { Paperclip } from "lucide-react";
import { acknowledgePolicyAction } from "@/actions/policies";
import { fileIncidentAction } from "@/actions/incidents";
import { submitStaffRequestAction, withdrawStaffRequestAction } from "@/actions/requests";
import { INCIDENT_TYPES } from "@/lib/constants";
import { Badge, Empty, Field, Modal, PageHeader, useAction } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/utils";

type Props = {
  balances: { type: string; allowance: number; used: number; pending: number }[];
  shifts: { id: string; label: string; startsAt: string; endsAt: string; swap: string | null }[]; coworkers: { id: string; name: string }[];
  phone: string; emergencyContact: string; openEntry: { id: string; since: string } | null; appeals: { caseId: string; status: string; note: string }[];
  name: string; staffCode: string; status: string; readiness: string; points: number;
  enrollments: { id: string; courseId: string; title: string; status: string; best: number | null; cert: string | null; due: string | null; reason: string; remedial: boolean }[];
  cases: { id: string; caseNumber: string; severity: string; points: number; policy: string; summary: string; acknowledged: boolean; at: string }[];
  templates: { dueToday?: boolean; dueTime?: string; id: string; title: string; shiftType: string; items: { id: string; label: string; required: boolean }[] }[];
  submissions: { id: string; title: string; at: string; verified: boolean }[];
  policies: { id: string; title: string; description: string; md: string; fileId: string | null; version: number; signed: boolean }[];
  incidents: { id: string; type: string; status: string; at: string; description: string }[];
  documents: { id: string; title: string; category: string; fileId: string; expires: string | null }[];
  requests: { id: string; subtype?: string | null; kind: string; status: string; start: string | null; end: string | null; note: string; by: string | null }[];
  reviews: { id: string; kind: string; period: string; rating: number | null; summary: string; strengths: string; improvements: string; goals: string; author: string; at: string }[];
};

function PolicyCard({ p }: { p: Props["policies"][number] }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [name, setName] = useState("");
  const [show, setShow] = useState(!p.signed);
  return (
    <div className={`card p-4 text-[13px] ${p.signed ? "" : "border-amber-400"}`}>
      <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{p.title}</span><span className="mono text-xs text-soft">v{p.version}</span>{p.signed ? <Badge value="ACTIVE" label="Signed" /> : <Badge value="PENDING" label="Needs your signature" />}
        <span className="ml-auto flex gap-2">{p.fileId && <a className="btn" href={`/api/files/${p.fileId}`} target="_blank" rel="noreferrer"><Paperclip className="h-3.5 w-3.5" />Open PDF</a>}<button className="btn" onClick={() => setShow(!show)}>{show ? "Hide" : "Read"}</button></span></div>
      {p.description && <p className="mt-1 text-soft">{p.description}</p>}
      {show && p.md && <div className="anim-slide-down mt-3 max-h-64 space-y-2 overflow-y-auto rounded-md border border-line bg-muted p-3 leading-relaxed [&_h1]:text-base [&_h1]:font-semibold [&_h2]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_ul]:list-disc"><ReactMarkdown>{p.md}</ReactMarkdown></div>}
      {!p.signed && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1"><Field label="Type your full name to confirm you read this policy"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field></div>
          <button className="btn-primary" disabled={pending} onClick={() => exec(() => acknowledgePolicyAction(p.id, { signatureName: name }), { success: "Policy signed", onOk: () => router.refresh() })}>Sign</button>
        </div>
      )}
    </div>
  );
}

const REQ_LABEL: Record<string, string> = { LOA: "Leave of absence", RETIREMENT: "Retirement", RESIGNATION: "Resignation", TIMEOFF: "Time off" };
const REQ_TONE: Record<string, string> = { PENDING: "PENDING", APPROVED: "PASSED", DENIED: "FAILED", WITHDRAWN: "LOA", COMPLETED: "PASSED" };

function RequestsSection({ items, balances }: { items: Props["requests"]; balances: Props["balances"] }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ kind: "LOA", subtype: "VACATION", startDate: "", endDate: "", reason: "" });
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">My requests</h2><button className="btn" onClick={() => setOpen(true)}>New request</button></div>
      {balances.some((b) => b.allowance > 0) && <div className="mb-2 flex flex-wrap gap-2 text-xs">{balances.filter((b) => b.allowance > 0).map((b) => <span key={b.type} className="rounded-md border border-line px-2 py-1"><span className="text-soft">{b.type.charAt(0) + b.type.slice(1).toLowerCase()}:</span> <span className="mono">{Math.max(0, b.allowance - b.used - b.pending)} of {b.allowance} days left</span></span>)}</div>}
      {items.length === 0 ? <p className="text-[13px] text-soft">Ask for a leave of absence, or tell your manager you are retiring or resigning.</p> : (
        <div className="card divide-y divide-line">{items.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-[13px]">
            <span className="font-medium">{REQ_LABEL[r.kind]}{r.subtype ? ` · ${r.subtype.toLowerCase()}` : ""}</span><span className="mono text-xs text-soft">{r.kind === "LOA" || r.kind === "TIMEOFF" ? `${fmtDate(r.start)} → ${r.end ? fmtDate(r.end) : "open"}` : `last day ${fmtDate(r.end)}`}</span>
            <span className="ml-auto flex items-center gap-2"><Badge value={REQ_TONE[r.status] ?? "PENDING"} label={r.status} />{r.status === "PENDING" && <button className="btn" disabled={pending} onClick={() => exec(() => withdrawStaffRequestAction(r.id), { success: "Request withdrawn", onOk: () => router.refresh() })}>Withdraw</button>}</span>
            {r.note && <p className="w-full text-xs text-soft">{r.by ? `${r.by}: ` : ""}{r.note}</p>}
          </div>))}</div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="New request">
        <div className="space-y-3">
          <Field label="Type"><select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="TIMEOFF">Time off (vacation, sick, personal)</option><option value="LOA">Leave of absence</option><option value="RETIREMENT">Retirement</option><option value="RESIGNATION">Resignation</option></select></Field>
          {f.kind === "TIMEOFF" && <Field label="Type"><select className="input" value={f.subtype} onChange={(e) => setF({ ...f, subtype: e.target.value })}><option value="VACATION">Vacation</option><option value="SICK">Sick</option><option value="PERSONAL">Personal</option></select></Field>}
          {f.kind === "LOA" || f.kind === "TIMEOFF" ? (
            <div className="grid grid-cols-2 gap-3"><Field label={f.kind === "TIMEOFF" ? "First day off" : "Leave starts"}><input className="input mono" type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field><Field label={f.kind === "TIMEOFF" ? "Last day off" : "Expected return (optional)"}><input className="input mono" type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></Field></div>
          ) : (
            <Field label={f.kind === "RETIREMENT" ? "Last working day" : "Last day"}><input className="input mono" type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></Field>
          )}
          <Field label="Reason or details"><textarea className="textarea" rows={4} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
          <p className="text-xs text-soft">Your manager is notified and will reply here. Do not include medical details; share those with your manager or HR directly.</p>
          <button className="btn-primary w-full" disabled={pending} onClick={() => exec(() => submitStaffRequestAction(f), { success: "Request sent", onOk: () => { setOpen(false); setF({ kind: "LOA", subtype: "VACATION", startDate: "", endDate: "", reason: "" }); router.refresh(); } })}>Send request</button>
        </div>
      </Modal>
    </section>
  );
}

function IncidentButton() {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ type: "NEAR_MISS", occurredAt: "", location: "", description: "" });
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>Report an incident</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Report an incident">
        <div className="space-y-3">
          <p className="text-xs text-soft">Report near misses, injuries, hazards and concerns. You will not be written up for reporting something in good faith.</p>
          <Field label="Type"><select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{INCIDENT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="When"><input className="input mono" type="datetime-local" value={f.occurredAt} onChange={(e) => setF({ ...f, occurredAt: e.target.value })} /></Field><Field label="Where"><input className="input" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="e.g. Dock 4" /></Field></div>
          <Field label="What happened"><textarea className="textarea" rows={5} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <p className="text-xs text-soft">If someone is hurt or in danger right now, get help first and call 911 if needed.</p>
          <button className="btn-primary w-full" disabled={pending} onClick={() => exec(() => fileIncidentAction({ ...f, occurredAt: f.occurredAt && !isNaN(new Date(f.occurredAt).getTime()) ? new Date(f.occurredAt).toISOString() : "" }), { success: "Report filed. A manager will review it.", onOk: () => { setOpen(false); setF({ ...f, description: "", location: "" }); router.refresh(); } })}>Submit report</button>
        </div>
      </Modal>
    </>
  );
}

function SignBox({ caseId }: { caseId: string }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [name, setName] = useState("");
  return (
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <div className="min-w-56 flex-1"><Field label="Type your full name to sign. This confirms you received it, not that you agree."><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field></div>
      <button className="btn-primary" disabled={pending} onClick={() => exec(() => acknowledgeInfractionAction(caseId, { signatureName: name }), { success: "Signed", onOk: () => router.refresh() })}>Sign</button>
    </div>
  );
}

function Checklist({ t }: { t: Props["templates"][number] }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [done, setDone] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between"><h3 className="font-medium">{t.title}{t.dueToday && <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs font-normal text-amber-900 dark:bg-amber-900 dark:text-amber-100">Due today{t.dueTime ? ` by ${t.dueTime}` : ""}</span>}</h3><Badge value="LOA" label={t.shiftType.replace("_", " ")} /></div>
      <div className="space-y-1.5">{t.items.map((i) => <label key={i.id} className="flex items-start gap-2 text-[13px]"><input type="checkbox" className="mt-0.5" checked={done.includes(i.id)} onChange={() => setDone((d) => (d.includes(i.id) ? d.filter((x) => x !== i.id) : [...d, i.id]))} />{i.label}{i.required && <span className="text-xs text-rose-600">required</span>}</label>)}</div>
      <textarea className="textarea mt-3" rows={2} placeholder="Handoff notes for the next shift" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <button className="btn-primary mt-2" disabled={pending} onClick={() => exec(() => submitChecklistAction(t.id, { completedIds: done, handoffNotes: notes }), { success: "Checklist submitted", onOk: () => { setDone([]); setNotes(""); router.refresh(); } })}>Submit checklist</button>
    </div>
  );
}

function PhotoButton({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  return (
    <label className="cursor-pointer text-accent">
      {pending ? "Uploading…" : "Add photo"}
      <input type="file" accept="image/*" className="hidden" onChange={(e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const fd = new FormData();
        fd.set("submissionId", submissionId);
        fd.set("file", file);
        exec(() => addChecklistPhotoAction(fd), { success: "Photo added", onOk: () => router.refresh() });
        e.target.value = "";
      }} />
    </label>
  );
}

function ClockWidget({ openEntry }: { openEntry: Props["openEntry"] }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  return (
    <section className="card mb-6 flex flex-wrap items-center gap-3 p-4 text-[13px]">
      <span className="font-semibold">Time clock</span>
      <span className="text-soft">{openEntry ? `Clocked in since ${fmtDateTime(openEntry.since)}` : "You are clocked out."}</span>
      <button className="btn-primary ml-auto" disabled={pending} onClick={() => exec(() => (openEntry ? clockOutAction(openEntry.id) : clockInAction({})), { success: openEntry ? "Clocked out" : "Clocked in", onOk: () => router.refresh() })}>{openEntry ? "Clock out" : "Clock in"}</button>
    </section>
  );
}

function ProfileChange({ phone, emergencyContact }: { phone: string; emergencyContact: string }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ phone, emergencyContact });
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>Request profile update</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Request profile update">
        <div className="space-y-3">
          <Field label="Phone"><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Emergency contact"><input className="input" value={f.emergencyContact} onChange={(e) => setF({ ...f, emergencyContact: e.target.value })} /></Field>
          <p className="text-xs text-soft">A manager reviews changes before they apply.</p>
          <button className="btn-primary w-full" disabled={pending} onClick={() => exec(() => submitProfileChangeAction(f), { success: "Request sent", onOk: () => { setOpen(false); router.refresh(); } })}>Submit</button>
        </div>
      </Modal>
    </>
  );
}

function AppealBox({ caseId, status }: { caseId: string; status?: string }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (status === "OPEN") return <Badge value="PENDING" label="Appeal open" />;
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>{status ? "Appeal again" : "File appeal"}</button>
      <Modal open={open} onClose={() => setOpen(false)} title="File an appeal">
        <div className="space-y-3">
          <Field label="Why do you disagree?"><textarea className="textarea" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <button className="btn-primary w-full" disabled={pending} onClick={() => exec(() => fileAppealAction(caseId, { reason }), { success: "Appeal filed", onOk: () => { setOpen(false); setReason(""); router.refresh(); } })}>Submit appeal</button>
        </div>
      </Modal>
    </>
  );
}

function ShiftsSection({ shifts, coworkers }: { shifts: Props["shifts"]; coworkers: Props["coworkers"] }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [sel, setSel] = useState<string | null>(null);
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  if (!shifts.length) return null;
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold">Upcoming shifts</h2>
      <div className="card divide-y divide-line">{shifts.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-[13px]">
          <span className="font-medium">{s.label || "Shift"}</span><span className="mono text-xs text-soft">{fmtDateTime(s.startsAt)} → {fmtDateTime(s.endsAt)}</span>
          <span className="ml-auto">{s.swap === "PENDING" ? <Badge value="PENDING" label="Swap pending" /> : <button className="btn" onClick={() => { setSel(s.id); setTo(""); setNote(""); }}>Request swap</button>}</span>
        </div>))}</div>
      <Modal open={!!sel} onClose={() => setSel(null)} title="Request a shift swap">
        <div className="space-y-3">
          <Field label="Swap with (optional)"><select className="input" value={to} onChange={(e) => setTo(e.target.value)}><option value="">Give up the shift (anyone)</option>{coworkers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Note"><textarea className="textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <button className="btn-primary w-full" disabled={pending} onClick={() => sel && exec(() => requestShiftSwapAction(sel, { toId: to, note }), { success: "Swap requested", onOk: () => { setSel(null); router.refresh(); } })}>Send request</button>
        </div>
      </Modal>
    </section>
  );
}

export function Portal(p: Props) {
  const pending = p.cases.filter((c) => !c.acknowledged);
  return (
    <>
      <PageHeader title={`Hi, ${p.name.split(" ")[0]}`} sub="Your training, shift checklists and notices.">
        <ProfileChange phone={p.phone} emergencyContact={p.emergencyContact} /><span className="mono text-[13px]">{p.staffCode}</span><Badge value={p.status} /><Badge value={p.readiness} />
      </PageHeader>
      <ClockWidget openEntry={p.openEntry} />
      <ShiftsSection shifts={p.shifts} coworkers={p.coworkers} />
      {pending.length > 0 && (
        <section className="mb-6 space-y-3">
          <h2 className="text-sm font-semibold">Needs your signature</h2>
          {pending.map((c) => (
            <div key={c.id} className="card border-amber-400 p-4 text-[13px]">
              <div className="flex flex-wrap items-center gap-2"><span className="mono font-medium">{c.caseNumber}</span><Badge value={c.severity} /><span className="mono">+{c.points} pts</span><span className="mono text-xs text-soft">{fmtDate(c.at)}</span></div>
              <p className="mt-2 font-medium">{c.policy}</p><p className="text-soft">{c.summary}</p>
              <SignBox caseId={c.id} />
            </div>
          ))}
        </section>
      )}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold">My courses</h2>
        {p.enrollments.length === 0 ? <Empty title="No courses assigned" /> : (
          <div className="card divide-y divide-line">{p.enrollments.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-[13px]">
              <div className="min-w-0 flex-1"><Link href={`/app/training/course/${e.courseId}`} className="font-medium">{e.title}</Link> {e.remedial && <Badge value="RETRAINING_REQUIRED" label="Remedial" />}<div className="text-xs text-soft">{e.reason}{e.due ? ` · due ${fmtDate(e.due)}` : ""}</div></div>
              <Badge value={e.status} />{e.best != null && <span className="mono">{e.best}%</span>}
              {e.cert ? <Link target="_blank" className="mono text-accent" href={`/print/certificate/${e.id}`}>{e.cert}</Link> : <Link className="btn" href={`/app/training/course/${e.courseId}`}>{e.status === "ASSIGNED" ? "Start" : "Continue"}</Link>}
            </div>))}</div>
        )}
      </section>
      {p.policies.length > 0 && (
        <section className="mb-6 space-y-3">
          <h2 className="text-sm font-semibold">Policies</h2>
          {[...p.policies].sort((a, b) => Number(a.signed) - Number(b.signed)).map((x) => <PolicyCard key={x.id} p={x} />)}
        </section>
      )}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold">Shift checklists</h2>
        {p.templates.length === 0 ? <Empty title="No checklists for your department yet" /> : <div className="grid gap-3 lg:grid-cols-2">{p.templates.map((t) => <Checklist key={t.id} t={t} />)}</div>}
        {p.submissions.length > 0 && <ul className="mono mt-3 space-y-1 text-xs text-soft">{p.submissions.map((s) => <li key={s.id}>{fmtDateTime(s.at)} · {s.title} {s.verified ? "· verified" : "· awaiting verification"} · <PhotoButton submissionId={s.id} /></li>)}</ul>}
      </section>
      {p.reviews.length > 0 && (
        <section className="mb-6 space-y-3">
          <h2 className="text-sm font-semibold">Shared with me: reviews and 1:1s</h2>
          {p.reviews.map((r) => (
            <div key={r.id} className="card p-4 text-[13px]">
              <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{r.kind === "ONE_ON_ONE" ? "1:1 summary" : "Performance review"}</span>{r.period && <span className="text-soft">{r.period}</span>}{r.rating && <span className="mono">{r.rating}/5</span>}<span className="ml-auto mono text-xs text-soft">{fmtDate(r.at)} · {r.author}</span></div>
              {([["Summary", r.summary], ["Strengths", r.strengths], ["To improve", r.improvements], ["Goals", r.goals]] as const).filter(([, v]) => v).map(([k, v]) => <div key={k} className="mt-2"><div className="text-xs text-soft">{k}</div><p className="whitespace-pre-wrap">{v}</p></div>)}
            </div>
          ))}
        </section>
      )}
      {p.documents.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold">My documents</h2>
          <div className="card divide-y divide-line">{p.documents.map((d) => <div key={d.id} className="flex items-center gap-3 px-3 py-2 text-[13px]"><Paperclip className="h-4 w-4 text-soft" /><a className="flex-1 font-medium text-accent" href={`/api/files/${d.fileId}`} target="_blank" rel="noreferrer">{d.title}</a><span className="text-xs text-soft">{d.category}{d.expires ? ` · expires ${fmtDate(d.expires)}` : ""}</span></div>)}</div>
        </section>
      )}
      <RequestsSection items={p.requests} balances={p.balances} />
      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">Incident reports</h2><IncidentButton /></div>
        {p.incidents.length === 0 ? <p className="text-[13px] text-soft">You have not filed any reports.</p> : <div className="card divide-y divide-line">{p.incidents.map((i) => <div key={i.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-[13px]"><Badge value="VERBAL_WARNING" label={i.type} /><span className="mono text-xs text-soft">{fmtDate(i.at)}</span><span className="min-w-0 flex-1 truncate">{i.description}</span><Badge value={i.status === "CLOSED" ? "PASSED" : "PENDING"} label={i.status} /></div>)}</div>}
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold">My notices</h2>
        {p.cases.length === 0 ? <Empty title="No infractions on file" /> : <div className="card divide-y divide-line">{p.cases.map((c) => <div key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-[13px]"><span className="mono">{c.caseNumber}</span><Badge value={c.severity} /><span className="flex-1">{c.policy}</span>{c.acknowledged ? <Badge value="ACTIVE" label="Signed" /> : <Badge value="PENDING" label="Awaiting" />}<AppealBox caseId={c.id} status={p.appeals.find((a) => a.caseId === c.id)?.status} /></div>)}</div>}
      </section>
    </>
  );
}
