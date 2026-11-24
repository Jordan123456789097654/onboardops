"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sendTestTextAction, setCalendarFeedAction, setSmsOptInAction } from "@/actions/personal";
import { addEmployeeResponseAction, fileAppealAction } from "@/actions/discipline2";
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
import { runAiTaskAction } from "@/actions/ai";
import { INCIDENT_TYPES } from "@/lib/constants";
import { Badge, Empty, Field, Modal, PageHeader, Tabs, useAction, useToast } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import { TodayHub } from "./today-hub";
import { Check, Circle, Sparkles } from "lucide-react";

type Props = {
  aiCare?: boolean;
  locationName: string | null; teamShifts: { id: string; name: string; label: string; startsAt: string; endsAt: string }[]; weekEntries: { clockIn: string; clockOut: string | null }[]; credentials: { id: string; name: string; expires: string }[]; submittedTemplates: { id: string; at: string }[];
  calendarUrl: string; sms: { configured: boolean; optIn: boolean; phone: string };
  balances: { type: string; allowance: number; used: number; pending: number }[];
  shifts: { id: string; label: string; startsAt: string; endsAt: string; swap: string | null }[]; coworkers: { id: string; name: string }[];
  phone: string; emergencyContact: string; openEntry: { id: string; since: string } | null; appeals: { caseId: string; status: string; note: string }[];
  name: string; staffCode: string; status: string; readiness: string; points: number;
  enrollments: { id: string; courseId: string; title: string; status: string; best: number | null; cert: string | null; due: string | null; reason: string; remedial: boolean }[];
  cases: { id: string; caseNumber: string; severity: string; points: number; policy: string; summary: string; acknowledged: boolean; at: string; responded?: boolean }[];
  templates: { dueToday?: boolean; dueTime?: string; id: string; title: string; shiftType: string; items: { id: string; label: string; required: boolean }[] }[];
  submissions: { id: string; title: string; at: string; verified: boolean }[];
  policies: { id: string; title: string; description: string; md: string; fileId: string | null; link?: string; version: number; signed: boolean }[];
  incidents: { id: string; type: string; status: string; at: string; description: string }[];
  documents: { id: string; title: string; category: string; href: string; expires: string | null }[];
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
        <span className="ml-auto flex gap-2">{p.link && <a className="btn" href={p.link} target="_blank" rel="noreferrer"><Paperclip className="h-3.5 w-3.5" />Open link</a>}{p.fileId && <a className="btn" href={`/api/files/${p.fileId}`} target="_blank" rel="noreferrer"><Paperclip className="h-3.5 w-3.5" />Open PDF</a>}<button className="btn" onClick={() => setShow(!show)}>{show ? "Hide" : "Read"}</button></span></div>
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
  useEffect(() => { const h = (e: Event) => { if ((e as CustomEvent).detail === "request") { setF((x) => ({ ...x, kind: "TIMEOFF" })); setOpen(true); } }; window.addEventListener("oo:open", h); return () => window.removeEventListener("oo:open", h); }, []);
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
  useEffect(() => { const h = (e: Event) => { if ((e as CustomEvent).detail === "incident") setOpen(true); }; window.addEventListener("oo:open", h); return () => window.removeEventListener("oo:open", h); }, []);
  const [f, setF] = useState({ type: "NEAR_MISS", occurredAt: "", location: "", description: "", anonymous: false });
  const [photos, setPhotos] = useState<File[]>([]);
  const payload = () => {
    const fd = new FormData();
    fd.set("json", JSON.stringify({ ...f, occurredAt: f.occurredAt && !isNaN(new Date(f.occurredAt).getTime()) ? new Date(f.occurredAt).toISOString() : "" }));
    photos.forEach((p) => fd.append("files", p));
    return fd;
  };
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>Report an incident</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Report an incident">
        <div className="space-y-3">
          <p className="text-xs text-soft">Report near misses, injuries, hazards and concerns. You will not be written up for reporting something in good faith.</p>
          <Field label="Type"><select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{INCIDENT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="When"><input className="input mono" type="datetime-local" value={f.occurredAt} onChange={(e) => setF({ ...f, occurredAt: e.target.value })} /></Field><Field label="Where"><input className="input" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="e.g. Dock 4" /></Field></div>
          <Field label="What happened"><textarea className="textarea" rows={5} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Field label="Photos (optional, up to 2, 4 MB each)"><input className="text-xs" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(e) => setPhotos(Array.from(e.target.files ?? []).slice(0, 2))} /></Field>
          <label className="flex items-start gap-2 text-[13px]"><input type="checkbox" className="mt-0.5" checked={f.anonymous} onChange={(e) => setF({ ...f, anonymous: e.target.checked })} />Report anonymously. Your name is not saved with this report, so it will not appear in your list below and managers cannot reply to you.</label>
          <p className="text-xs text-soft">If someone is hurt or in danger right now, get help first and call 911 if needed.</p>
          <button className="btn-primary w-full" disabled={pending} onClick={() => exec(() => fileIncidentAction(payload()), { success: "Report filed. A manager will review it.", onOk: () => { setOpen(false); setF({ ...f, description: "", location: "" }); setPhotos([]); router.refresh(); } })}>Submit report</button>
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

const QUEUE = "oo-offline-checklists";
type Queued = { templateId: string; completedIds: string[]; handoffNotes: string; at: number };
const readQueue = (): Queued[] => { try { return JSON.parse(localStorage.getItem(QUEUE) ?? "[]"); } catch { return []; } };

/** Offline: keep the finished checklist on this device and send it when the connection returns. */
async function queueOffline(templateId: string, completedIds: string[], handoffNotes: string): Promise<{ ok: true; data: undefined } | { ok: false; error: string }> {
  try {
    localStorage.setItem(QUEUE, JSON.stringify([...readQueue(), { templateId, completedIds, handoffNotes, at: Date.now() }]));
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Could not save offline on this device." };
  }
}

function OfflineSync() {
  const router = useRouter();
  const [waiting, setWaiting] = useState(0);
  useEffect(() => {
    let busy = false;
    const flush = async () => {
      if (busy || !navigator.onLine) return;
      busy = true;
      let q = readQueue();
      setWaiting(q.length);
      while (q.length) {
        const r = await submitChecklistAction(q[0].templateId, { completedIds: q[0].completedIds, handoffNotes: q[0].handoffNotes });
        if (!r.ok && !/required items|not found/i.test(r.error)) break;
        q = q.slice(1);
        localStorage.setItem(QUEUE, JSON.stringify(q));
        setWaiting(q.length);
        if (r.ok) router.refresh();
      }
      busy = false;
    };
    setWaiting(readQueue().length);
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [router]);
  if (!waiting) return null;
  return <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">{waiting} checklist{waiting > 1 ? "s" : ""} saved on this device. {typeof navigator !== "undefined" && navigator.onLine ? "Sending…" : "They will send when you are back online."}</p>;
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
      <button className="btn-primary mt-2" disabled={pending} onClick={() => exec(() => (typeof navigator !== "undefined" && !navigator.onLine ? queueOffline(t.id, done, notes) : submitChecklistAction(t.id, { completedIds: done, handoffNotes: notes })), { success: "Checklist submitted", onOk: () => { setDone([]); setNotes(""); router.refresh(); } })}>Submit checklist</button>
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

function CaseSteps({ signed, responded, appeal }: { signed: boolean; responded: boolean; appeal?: string }) {
  const steps: [string, boolean][] = [["Issued", true], ["You signed (received)", signed], ["Your response added", responded], [appeal ? `Appeal ${appeal === "OPEN" ? "open" : appeal.toLowerCase()}` : "Appeal (optional)", !!appeal]];
  return (
    <ol className="flex w-full flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-soft" aria-label="Case progress">
      {steps.map(([l, done]) => <li key={l} className="flex items-center gap-1">{done ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> : <Circle className="h-3 w-3" aria-hidden />}<span className={done ? "text-ink" : ""}>{l}</span></li>)}
    </ol>
  );
}

function ClockWidget({ openEntry, bare }: { openEntry: Props["openEntry"]; bare?: boolean }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  return (
    <section className={bare ? "flex flex-wrap items-center gap-3 rounded-md border border-line p-3 text-[13px]" : "card mb-6 flex flex-wrap items-center gap-3 p-4 text-[13px]"}>
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

type PortalResponseDraft = { statement: string; tips: string[] };

function ResponseBox({ caseId, aiCare = false, casePolicy, caseSummary }: { caseId: string; aiCare?: boolean; casePolicy?: string; caseSummary?: string }) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();
  const { exec: execAi, pending: aiPending } = useAction();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<PortalResponseDraft | null>(null);

  const helpWriteNeutrally = () => {
    execAi(
      () =>
        runAiTaskAction("portal.response", {
          roughNotes: text.slice(0, 5000),
          casePolicy: casePolicy?.trim() ? casePolicy.trim().slice(0, 160) : undefined,
          caseSummary: caseSummary?.trim() ? caseSummary.trim().slice(0, 2500) : undefined,
        }) as Promise<{ ok: true; data: PortalResponseDraft } | { ok: false; error: string }>,
      {
        onOk: (res) => {
          setDraft(res);
          toast("ok", "Draft ready — review and edit before submitting.");
        },
      }
    );
  };

  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>Add my response</button>
      <Modal open={open} onClose={() => { setOpen(false); setDraft(null); }} title="Your written response">
        <div className="space-y-3">
          <p className="text-xs text-soft">Tell your side. This is added to the case record and your manager is notified. You can still sign or appeal separately.</p>
          <Field label="Your response">
            <textarea
              className="textarea"
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write your rough notes or full statement here…"
            />
          </Field>
          {aiCare && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  className="btn !h-7 !text-xs"
                  disabled={aiPending || pending || text.trim().length < 10}
                  onClick={helpWriteNeutrally}
                >
                  <Sparkles className="h-3.5 w-3.5 text-accent" />
                  {aiPending ? "Drafting…" : "Help me write neutrally (AI)"}
                </button>
                <span className="text-[11px] text-soft">
                  Names &amp; contact details are scrubbed before AI. Nothing is submitted until you review and click Submit response.
                </span>
              </div>
              {draft && (
                <div className="rounded-lg border border-accent/40 bg-accent/5 p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between gap-2 font-semibold">
                    <span className="inline-flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-accent" />
                      Suggested calm, factual wording
                    </span>
                    <button type="button" className="font-normal text-soft underline" onClick={() => setDraft(null)}>
                      Discard
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap rounded border border-line bg-surface p-2.5 text-[13px] text-ink">
                    {draft.statement}
                  </p>
                  {draft.tips.length > 0 && (
                    <ul className="list-disc space-y-0.5 pl-4 text-soft">
                      {draft.tips.map((tip, i) => (
                        <li key={i}>{tip}</li>
                      ))}
                    </ul>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-primary !h-8 flex-1 text-xs"
                      onClick={() => {
                        setText(draft.statement);
                        setDraft(null);
                        toast("ok", "Copied into your response — review or edit before clicking Submit response.");
                      }}
                    >
                      Use this wording
                    </button>
                    <button
                      type="button"
                      className="btn !h-8 text-xs"
                      onClick={() => setDraft(null)}
                    >
                      Discard
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <button
            className="btn-primary w-full"
            disabled={pending || aiPending}
            onClick={() =>
              exec(() => addEmployeeResponseAction(caseId, { statement: text }), {
                success: "Response added",
                onOk: () => {
                  setOpen(false);
                  setText("");
                  setDraft(null);
                  router.refresh();
                },
              })
            }
          >
            Submit response
          </button>
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

function Connections({ calendarUrl, sms }: { calendarUrl: string; sms: Props["sms"] }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [phone, setPhone] = useState(sms.phone);
  const [copied, setCopied] = useState(false);
  return (
    <section className="card mb-6 space-y-4 p-4 text-[13px]">
      <div>
        <h2 className="text-sm font-semibold">Calendar feed</h2>
        <p className="text-soft">Add your shifts and approved time off to Google, Apple or Outlook calendar. Anyone with this private link can see them, so do not share it.</p>
        {calendarUrl ? (
          <div className="mt-2 space-y-2">
            <input className="input mono text-xs" readOnly value={calendarUrl} onFocus={(e) => e.currentTarget.select()} />
            <div className="flex flex-wrap gap-2">
              <button className="btn" onClick={() => { navigator.clipboard?.writeText(calendarUrl).then(() => setCopied(true)).catch(() => {}); }}>{copied ? "Copied" : "Copy link"}</button>
              <button className="btn" disabled={pending} onClick={() => { if (confirm("Make a new link? The old one stops working.")) exec(() => setCalendarFeedAction(), { success: "New link created", onOk: () => router.refresh() }); }}>New link</button>
              <button className="btn" disabled={pending} onClick={() => exec(() => setCalendarFeedAction(true), { success: "Calendar feed turned off", onOk: () => router.refresh() })}>Turn off</button>
            </div>
          </div>
        ) : <button className="btn mt-2" disabled={pending} onClick={() => exec(() => setCalendarFeedAction(), { success: "Calendar link created", onOk: () => router.refresh() })}>Create my calendar link</button>}
      </div>
      {sms.configured && (
        <div className="border-t border-line pt-4">
          <h2 className="text-sm font-semibold">Text messages</h2>
          <p className="text-soft">Get a text for new shifts, swap answers and request decisions. Message and data rates may apply. Reply STOP to opt out at any time.</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <div className="min-w-48"><Field label="Mobile number"><input className="input mono" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="404-555-0142" /></Field></div>
            {sms.optIn ? (
              <>
                <button className="btn" disabled={pending} onClick={() => exec(() => sendTestTextAction(), { success: "Test text sent" })}>Send a test</button>
                <button className="btn" disabled={pending} onClick={() => exec(() => setSmsOptInAction({ optIn: false, phone }), { success: "Texts turned off", onOk: () => router.refresh() })}>Turn off</button>
              </>
            ) : <button className="btn-primary" disabled={pending} onClick={() => exec(() => setSmsOptInAction({ optIn: true, phone }), { success: "Texts turned on", onOk: () => router.refresh() })}>I agree, turn on texts</button>}
          </div>
        </div>
      )}
    </section>
  );
}

const TABS = ["home", "schedule", "training", "policies", "checklists", "requests", "records"];

export function Portal(p: Props) {
  const pending = p.cases.filter((c) => !c.acknowledged);
  const [tab, setTab] = useState("home");
  const go = (id: string) => { setTab(id); try { history.replaceState(null, "", `#${id}`); } catch { /* ignore */ } };
  useEffect(() => {
    const fromHash = () => { const h = window.location.hash.slice(1); if (TABS.includes(h)) setTab(h); };
    fromHash();
    const onTab = (e: Event) => { const t = (e as CustomEvent).detail; if (TABS.includes(t)) setTab(t); };
    window.addEventListener("hashchange", fromHash);
    window.addEventListener("oo:tab", onTab);
    return () => { window.removeEventListener("hashchange", fromHash); window.removeEventListener("oo:tab", onTab); };
  }, []);
  return (
    <>
      <PageHeader title={`Hi, ${p.name.split(" ")[0]}`} sub="Your training, shift checklists and notices.">
        <Link className="btn" href="/app/my-portal/records">What is recorded about me</Link><ProfileChange phone={p.phone} emergencyContact={p.emergencyContact} /><span className="mono text-[13px]">{p.staffCode}</span><Badge value={p.status} /><Badge value={p.readiness} />
      </PageHeader>
      <OfflineSync />
      <Tabs value={tab} onChange={go} tabs={[
        { id: "home", label: "Home" },
        { id: "schedule", label: "Schedule" },
        { id: "training", label: `Training${p.enrollments.filter((e) => e.status !== "PASSED").length ? ` (${p.enrollments.filter((e) => e.status !== "PASSED").length})` : ""}` },
        { id: "policies", label: `Policies${p.policies.filter((x) => !x.signed).length ? ` (${p.policies.filter((x) => !x.signed).length})` : ""}` },
        { id: "checklists", label: "Checklists" },
        { id: "requests", label: "Requests" },
        { id: "records", label: `Records${pending.length ? ` (${pending.length})` : ""}` },
      ]} />
      <div className={tab === "home" ? "mt-4" : "hidden"} role="tabpanel" aria-label="home">
      <TodayHub clock={<ClockWidget bare openEntry={p.openEntry} />} locationName={p.locationName} myShifts={p.shifts} teamShifts={p.teamShifts} weekEntries={p.weekEntries} templates={p.templates} submittedTemplateIds={p.submittedTemplates} unsignedCases={p.cases.filter((c) => !c.acknowledged).map((c) => ({ id: c.id, caseNumber: c.caseNumber }))} policies={p.policies.map((x) => ({ id: x.id, title: x.title, signed: x.signed }))} enrollments={p.enrollments.map((e) => ({ id: e.id, title: e.title, status: e.status, due: e.due, courseId: e.courseId }))} credentials={p.credentials} requests={p.requests} />
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
      </div>
      <div className={tab === "schedule" ? "mt-4" : "hidden"} role="tabpanel" aria-label="schedule">
      <ShiftsSection shifts={p.shifts} coworkers={p.coworkers} />
      <Connections calendarUrl={p.calendarUrl} sms={p.sms} />
      </div>
      <div className={tab === "training" ? "mt-4" : "hidden"} role="tabpanel" aria-label="training">
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
      </div>
      <div className={tab === "policies" ? "mt-4" : "hidden"} role="tabpanel" aria-label="policies">
      {p.policies.length > 0 && (
        <section id="policies" className="mb-6 scroll-mt-20 space-y-3">
          <h2 className="text-sm font-semibold">Policies</h2>
          {[...p.policies].sort((a, b) => Number(a.signed) - Number(b.signed)).map((x) => <PolicyCard key={x.id} p={x} />)}
        </section>
      )}
      {p.policies.length === 0 && <Empty title="No policies assigned to you" />}
      </div>
      <div className={tab === "checklists" ? "mt-4" : "hidden"} role="tabpanel" aria-label="checklists">
      <section id="checklists" className="mb-6 scroll-mt-20">
        <h2 className="mb-2 text-sm font-semibold">Shift checklists</h2>
        {p.templates.length === 0 ? <Empty title="No checklists for your department yet" /> : <div className="grid gap-3 lg:grid-cols-2">{p.templates.map((t) => <Checklist key={t.id} t={t} />)}</div>}
        {p.submissions.length > 0 && <ul className="mono mt-3 space-y-1 text-xs text-soft">{p.submissions.map((s) => <li key={s.id}>{fmtDateTime(s.at)} · {s.title} {s.verified ? "· verified" : "· awaiting verification"} · <PhotoButton submissionId={s.id} /></li>)}</ul>}
      </section>
      </div>
      <div className={tab === "requests" ? "mt-4" : "hidden"} role="tabpanel" aria-label="requests">
      <RequestsSection items={p.requests} balances={p.balances} />
      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">Incident reports</h2><IncidentButton /></div>
        {p.incidents.length === 0 ? <p className="text-[13px] text-soft">You have not filed any reports.</p> : <div className="card divide-y divide-line">{p.incidents.map((i) => <div key={i.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-[13px]"><Badge value="VERBAL_WARNING" label={i.type} /><span className="mono text-xs text-soft">{fmtDate(i.at)}</span><span className="min-w-0 flex-1 truncate">{i.description}</span><Badge value={i.status === "CLOSED" ? "PASSED" : "PENDING"} label={i.status} /></div>)}</div>}
      </section>
      </div>
      <div className={tab === "records" ? "mt-4" : "hidden"} role="tabpanel" aria-label="records">
      <section id="notices" className="scroll-mt-20">
        <h2 className="mb-2 text-sm font-semibold">My notices</h2>
        {p.cases.length === 0 ? <Empty title="No infractions on file" /> : <div className="card divide-y divide-line">{p.cases.map((c) => <div key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-[13px]"><span className="mono">{c.caseNumber}</span><Badge value={c.severity} /><span className="flex-1">{c.policy}</span>{c.acknowledged ? <Badge value="ACTIVE" label="Signed" /> : <Badge value="PENDING" label="Awaiting" />}<ResponseBox caseId={c.id} aiCare={!!p.aiCare} casePolicy={c.policy} caseSummary={c.summary} /><AppealBox caseId={c.id} status={p.appeals.find((a) => a.caseId === c.id)?.status} /><CaseSteps signed={c.acknowledged} responded={!!c.responded} appeal={p.appeals.find((a) => a.caseId === c.id)?.status} /></div>)}</div>}
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
        <section id="documents" className="mb-6 scroll-mt-20">
          <h2 className="mb-2 text-sm font-semibold">My documents</h2>
          <div className="card divide-y divide-line">{p.documents.map((d) => <div key={d.id} className="flex items-center gap-3 px-3 py-2 text-[13px]"><Paperclip className="h-4 w-4 text-soft" /><a className="flex-1 font-medium text-accent" href={d.href} target="_blank" rel="noreferrer">{d.title}</a><span className="text-xs text-soft">{d.category}{d.expires ? ` · expires ${fmtDate(d.expires)}` : ""}</span></div>)}</div>
        </section>
      )}
      </div>
    </>
  );
}
