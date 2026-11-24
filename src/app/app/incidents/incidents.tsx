"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { convertIncidentAction, updateIncidentAction } from "@/actions/incidents";
import { runAiTaskAction } from "@/actions/ai";
import { Badge, Drawer, Empty, Field, PageHeader, useAction, useToast } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

type Row = { id: string; type: string; status: string; at: string; filedAt: string; location: string; description: string; by: string; notes: string; caseNumber: string | null; anonymous: boolean; photos: string[]; investigatorId: string; investigator: string; due: string; injury: { bodyPart?: string; treatment?: string; daysAway?: number } };
const tone: Record<string, string> = { NEW: "PENDING", REVIEWING: "IN_PROGRESS", CLOSED: "PASSED", CONVERTED: "WRITTEN_INFRACTION" };

type AiIncidentDraft = { target: "reviewer_notes" | "case_summary"; rewritten: string; followUpChecklist: string[]; flags: string[] };

export function Incidents({ rows, employees, members = [], severities, canManage, aiCare = false }: { members?: { id: string; name: string }[]; rows: Row[]; employees: { id: string; label: string }[]; severities: string[]; canManage: boolean; aiCare?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();
  const [status, setStatus] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [conv, setConv] = useState(false);
  const [inv, setInv] = useState({ investigatorMemberId: "", investigationDue: "", bodyPart: "", treatment: "", daysAway: 0 });
  const [f, setF] = useState({ employeeId: "", severity: severities[0] ?? "VERBAL_WARNING", pointsAdded: 0, policyViolated: "", summary: "", confidentialManagerNotes: "" });
  const [aiDraft, setAiDraft] = useState<AiIncidentDraft | null>(null);
  const shown = useMemo(() => rows.filter((r) => !status || r.status === status), [rows, status]);
  const open = rows.find((r) => r.id === openId) ?? null;
  const select = (r: Row) => { setOpenId(r.id); setNotes(r.notes); setAiDraft(null); setInv({ investigatorMemberId: r.investigatorId, investigationDue: r.due, bodyPart: r.injury.bodyPart ?? "", treatment: r.injury.treatment ?? "", daysAway: r.injury.daysAway ?? 0 }); setConv(false); setF((x) => ({ ...x, summary: r.description, policyViolated: "" })); };

  const runIncidentAi = (target: "reviewer_notes" | "case_summary") => {
    if (!open) return;
    const empName = employees.find((e) => e.id === f.employeeId)?.label.replace(/^EMP-\d+\s*/i, "");
    const names = [open.by, open.investigator, empName].filter((x): x is string => !!x && x !== "Anonymous");
    exec(
      () =>
        runAiTaskAction("incident.rewrite", {
          incidentType: open.type,
          location: open.location || undefined,
          description: target === "case_summary" ? (f.summary || open.description) : open.description,
          reviewerNotes: notes || undefined,
          target,
          names,
        }) as Promise<{ ok: true; data: { rewritten: string; followUpChecklist: string[]; flags: string[] } } | { ok: false; error: string }>,
      {
        onOk: (res) => {
          setAiDraft({ target, ...res });
          toast("ok", "Neutral summary ready — review before applying.");
        },
      }
    );
  };

  return (
    <>
      <PageHeader title="Incident Reports" sub="Near misses, injuries, hazards and conduct concerns filed by anyone on the team. Review them, then close them or turn them into a case.">{canManage && <a className="btn" href="/api/export/osha">Injury log (CSV)</a>}</PageHeader>
      <div className="mb-3"><select className="input !w-48" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{["NEW", "REVIEWING", "CLOSED", "CONVERTED"].map((s) => <option key={s}>{s}</option>)}</select></div>
      {shown.length === 0 ? <Empty title="No incident reports" hint="Employees file them from My Portal." /> : (
        <div className="card max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead><tr>{["Type", "Happened", "Where", "Reported by", "Status", "Summary"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>{shown.map((r) => (
              <tr key={r.id} className="cursor-pointer hover:bg-muted" onClick={() => select(r)}>
                <td className="td"><Badge value={r.type === "INJURY" ? "SUSPENSION" : r.type === "NEAR_MISS" ? "STRIKE_POINTS" : "VERBAL_WARNING"} label={r.type} /></td>
                <td className="td mono text-xs">{fmtDateTime(r.at)}</td><td className="td">{r.location || "—"}</td><td className="td">{r.by}</td>
                <td className="td"><Badge value={tone[r.status] ?? "PENDING"} label={r.status} /></td><td className="td max-w-xs truncate text-soft">{r.description}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
      <Drawer open={!!open} onClose={() => setOpenId(null)} title="Incident report" wide>
        {open && (
          <div className="space-y-4 text-[13px]">
            <div className="flex flex-wrap items-center gap-2"><Badge value="VERBAL_WARNING" label={open.type} /><Badge value={tone[open.status] ?? "PENDING"} label={open.status} />{open.caseNumber && <span className="mono">→ {open.caseNumber}</span>}</div>
            <div className="grid gap-3 sm:grid-cols-2"><div><div className="text-xs text-soft">Happened</div><div className="mono">{fmtDateTime(open.at)}</div></div><div><div className="text-xs text-soft">Location</div>{open.location || "—"}</div><div><div className="text-xs text-soft">Reported by</div>{open.by}</div><div><div className="text-xs text-soft">Filed</div><div className="mono">{fmtDateTime(open.filedAt)}</div></div></div>
            <div><div className="text-xs text-soft">What happened</div><p className="mt-0.5 whitespace-pre-wrap leading-relaxed">{open.description}</p></div>
            {open.anonymous && <p className="text-xs text-soft">Filed anonymously. The reporter&apos;s identity was not saved.</p>}
            {open.photos.length > 0 && <div className="flex flex-wrap gap-2">{open.photos.map((id) => <a key={id} href={`/api/files/${id}`} target="_blank" rel="noreferrer"><img src={`/api/files/${id}`} alt="Incident photo" className="h-24 w-24 rounded-md border border-line object-cover" /></a>)}</div>}
            {(open.investigator || open.due) && <p className="text-xs text-soft">Investigator: <span className="font-medium text-ink">{open.investigator || "unassigned"}</span>{open.due ? ` · due ${open.due}` : ""}</p>}
            {canManage && open.status !== "CONVERTED" && (
              <div className="space-y-2 border-t border-line pt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Investigator"><select className="input" value={inv.investigatorMemberId} onChange={(e) => setInv({ ...inv, investigatorMemberId: e.target.value })}><option value="">Unassigned</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
                  <Field label="Investigation due"><input className="input mono" type="date" value={inv.investigationDue} onChange={(e) => setInv({ ...inv, investigationDue: e.target.value })} /></Field>
                </div>
                {open.type === "INJURY" && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Body part"><input className="input" value={inv.bodyPart} onChange={(e) => setInv({ ...inv, bodyPart: e.target.value })} /></Field>
                    <Field label="Treatment"><input className="input" placeholder="First aid, clinic, ER" value={inv.treatment} onChange={(e) => setInv({ ...inv, treatment: e.target.value })} /></Field>
                    <Field label="Days away from work"><input className="input mono" type="number" min={0} value={inv.daysAway} onChange={(e) => setInv({ ...inv, daysAway: Number(e.target.value) })} /></Field>
                  </div>
                )}
                <Field label="Reviewer notes (internal)"><textarea className="textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
                {aiCare && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button type="button" className="btn !h-7 !text-xs" disabled={pending} onClick={() => runIncidentAi("reviewer_notes")}>
                        <Sparkles className="h-3.5 w-3.5 text-accent" />{pending ? "Drafting…" : "Structure & neutralize with AI"}
                      </button>
                      <span className="text-[11px] text-soft">Names &amp; contact details scrubbed before AI. Draft only.</span>
                    </div>
                    {aiDraft && aiDraft.target === "reviewer_notes" && (
                      <div className="space-y-2 rounded-lg border border-accent/40 bg-accent/5 p-3 text-xs">
                        <div className="flex items-center justify-between gap-2 font-semibold">
                          <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-accent" />Structured review draft</span>
                          <button type="button" className="font-normal text-soft underline" onClick={() => setAiDraft(null)}>Discard</button>
                        </div>
                        <p className="whitespace-pre-wrap rounded border border-line bg-surface p-2.5 text-[13px] text-ink">{aiDraft.rewritten}</p>
                        {aiDraft.followUpChecklist.length > 0 && (
                          <div>
                            <div className="font-medium text-soft">Suggested investigator follow-ups:</div>
                            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-soft">{aiDraft.followUpChecklist.map((item, i) => <li key={i}>{item}</li>)}</ul>
                          </div>
                        )}
                        {aiDraft.flags.length > 0 && (
                          <ul className="list-disc space-y-0.5 pl-4 text-amber-800 dark:text-amber-300">{aiDraft.flags.map((fl, i) => <li key={i}>{fl}</li>)}</ul>
                        )}
                        <button type="button" className="btn-primary !h-8 w-full text-xs" onClick={() => { setNotes(aiDraft.rewritten); setAiDraft(null); toast("ok", "Applied draft to reviewer notes."); }}>
                          Apply to reviewer notes
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {(["REVIEWING", "CLOSED"] as const).map((s) => <button key={s} className="btn" disabled={pending} onClick={() => exec(() => updateIncidentAction(open.id, { status: s, reviewerNotes: notes, investigatorMemberId: inv.investigatorMemberId, investigationDue: inv.investigationDue, ...(open.type === "INJURY" ? { injury: { bodyPart: inv.bodyPart, treatment: inv.treatment, daysAway: inv.daysAway } } : {}) }), { success: `Marked ${s.toLowerCase()}`, onOk: () => router.refresh() })}>{s === "REVIEWING" ? "Start review" : "Close"}</button>)}
                  <button className="btn-primary" onClick={() => setConv(!conv)}>Turn into a case</button>
                </div>
                {conv && (
                  <div className="anim-slide-down space-y-3 rounded-lg border border-line p-3">
                    <p className="text-xs text-soft">Only open a case if someone&apos;s conduct needs documented follow-up. Reports made in good faith, such as stop-work or near-miss reports, should not be punished.</p>
                    <Field label="Employee the case is about"><select className="input" value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })}><option value="">Select…</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}</select></Field>
                    <div className="grid grid-cols-2 gap-3"><Field label="Severity"><select className="input" value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}>{severities.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select></Field><Field label="Strike points"><input className="input mono" type="number" min={0} value={f.pointsAdded} onChange={(e) => setF({ ...f, pointsAdded: Number(e.target.value) })} /></Field></div>
                    <Field label="Policy violated"><input className="input" value={f.policyViolated} onChange={(e) => setF({ ...f, policyViolated: e.target.value })} /></Field>
                    <Field label="Summary (visible to the employee)"><textarea className="textarea" rows={3} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} /></Field>
                    {aiCare && (
                      <div className="space-y-2">
                        <button type="button" className="btn !h-7 !text-xs" disabled={pending || (f.summary || open.description).trim().length < 10} onClick={() => runIncidentAi("case_summary")}>
                          <Sparkles className="h-3.5 w-3.5 text-accent" />{pending ? "Rewriting…" : "Rewrite case summary neutrally with AI"}
                        </button>
                        {aiDraft && aiDraft.target === "case_summary" && (
                          <div className="space-y-2 rounded-lg border border-accent/40 bg-accent/5 p-3 text-xs">
                            <div className="flex items-center justify-between gap-2 font-semibold">
                              <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-accent" />Neutral case summary draft</span>
                              <button type="button" className="font-normal text-soft underline" onClick={() => setAiDraft(null)}>Discard</button>
                            </div>
                            <p className="whitespace-pre-wrap rounded border border-line bg-surface p-2.5 text-[13px] text-ink">{aiDraft.rewritten}</p>
                            {aiDraft.flags.length > 0 && (
                              <ul className="list-disc space-y-0.5 pl-4 text-amber-800 dark:text-amber-300">{aiDraft.flags.map((fl, i) => <li key={i}>{fl}</li>)}</ul>
                            )}
                            <button type="button" className="btn-primary !h-8 w-full text-xs" onClick={() => { setF({ ...f, summary: aiDraft.rewritten }); setAiDraft(null); toast("ok", "Applied neutral summary."); }}>
                              Use this summary
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    <Field label="Confidential manager notes"><textarea className="textarea" rows={2} value={f.confidentialManagerNotes} onChange={(e) => setF({ ...f, confidentialManagerNotes: e.target.value })} /></Field>
                    <button className="btn-primary w-full" disabled={pending} onClick={() => exec(() => convertIncidentAction(open.id, { ...f, pointsAdded: Number(f.pointsAdded) }), { success: "Case created", onOk: () => { setConv(false); router.refresh(); } })}>Create case</button>
                  </div>
                )}
              </div>
            )}
            {open.notes && !canManage && <div><div className="text-xs text-soft">Reviewer notes</div>{open.notes}</div>}
          </div>
        )}
      </Drawer>
    </>
  );
}
