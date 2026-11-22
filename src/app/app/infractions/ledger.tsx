"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addCaseAttachmentAction, applyStrikeDecayAction, decideAppealAction, deleteDisciplineRuleAction, saveDisciplineRuleAction } from "@/actions/discipline2";
import { addCaseNoteAction, issueInfractionAction, logAppealAction } from "@/actions/infractions";
import { Badge, Drawer, Empty, Field, Modal, PageHeader, useAction, useToast } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/utils";

export type CaseRow = {
  id: string; caseNumber: string; employeeId: string; employee: string; severity: string; points: number; policy: string; summary: string; evidence: string[]; confidential: string;
  acknowledged: boolean; signedBy: string | null; acknowledgedAt: string | null; issuedBy: string; createdAt: string;
  attachments: { id: string; kind: string; title: string; statement: string; author: string; at: string }[];
  appeals: { id: string; status: string; reason: string; by: string; reviewer: string | null; decision: string; at: string }[];
  timeline: { id: string; type: string; note: string; actor: string; at: string; confidential: boolean }[];
};

type RuleRow = { id: string; whenSeverity: string; count: number; withinDays: number; escalateTo: string };
type TemplateOpt = { id: string; name: string; severity: string; points: number; policy: string; summary: string };

export function Ledger({ rows, employees, templates = [], rules = [], isAdmin = false, severities, canConfidential, defaultOpen }: { rules?: RuleRow[]; isAdmin?: boolean; rows: CaseRow[]; employees: { id: string; label: string }[]; templates?: TemplateOpt[]; severities: string[]; canConfidential: boolean; defaultOpen: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();
  const [q, setQ] = useState("");
  const [sev, setSev] = useState("");
  const [ack, setAck] = useState("");
  const [logOpen, setLogOpen] = useState(defaultOpen);
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [noteConf, setNoteConf] = useState(false);
  const [appeal, setAppeal] = useState("");
  const [att, setAtt] = useState({ kind: "WITNESS", title: "", statement: "" });
  const [dec, setDec] = useState<Record<string, string>>({});
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rule, setRule] = useState({ whenSeverity: "VERBAL_WARNING", count: 3, withinDays: 90, escalateTo: "WRITTEN_INFRACTION" });
  const SEVS = ["VERBAL_WARNING", "WRITTEN_INFRACTION", "STRIKE_POINTS", "SUSPENSION", "TERMINATION"];
  const [f, setF] = useState({ employeeId: "", severity: severities[0] ?? "VERBAL_WARNING", pointsAdded: 0, policyViolated: "", summary: "", evidence: "", confidentialManagerNotes: "" });

  const shown = useMemo(() => rows.filter((r) => (!q || (r.caseNumber + r.employee + r.policy).toLowerCase().includes(q.toLowerCase())) && (!sev || r.severity === sev) && (!ack || (ack === "yes") === r.acknowledged)), [rows, q, sev, ack]);
  const open = rows.find((r) => r.id === openId) ?? null;

  const submit = () => {
    const evidenceUrls = f.evidence.split(/\s+/).filter(Boolean);
    exec(() => issueInfractionAction({ ...f, evidenceUrls, pointsAdded: Number(f.pointsAdded) }), {
      onOk: (d) => { toast("ok", `${d.caseNumber} logged${d.effects.length ? `. Automatic: ${d.effects.join("; ")}` : ""}`); setLogOpen(false); setF({ ...f, policyViolated: "", summary: "", evidence: "", confidentialManagerNotes: "", pointsAdded: 0 }); router.refresh(); },
    });
  };

  return (
    <>
      <PageHeader title="Infractions" sub="Case ledger. Cases and timeline entries are append-only."><a className="btn" href="/app/infractions/trends">Trends</a>{isAdmin && <button className="btn" onClick={() => setRulesOpen(true)}>Discipline rules</button>}<button className="btn-primary" onClick={() => setLogOpen(true)}>Log Infraction</button></PageHeader>
      <div className="mb-3 flex flex-wrap gap-2">
        <input className="input !w-64" placeholder="Search case, employee, policy" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input !w-48" value={sev} onChange={(e) => setSev(e.target.value)}><option value="">All severities</option>{["VERBAL_WARNING", "WRITTEN_INFRACTION", "STRIKE_POINTS", "SUSPENSION", "TERMINATION"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select>
        <select className="input !w-44" value={ack} onChange={(e) => setAck(e.target.value)}><option value="">Any signature state</option><option value="yes">Acknowledged</option><option value="no">Unacknowledged</option></select>
      </div>
      {shown.length === 0 ? <Empty title="No cases match" hint="Log an infraction or adjust the filters." /> : (
        <div className="card max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[800px] border-collapse">
            <thead><tr>{["Case", "Employee", "Severity", "Pts", "Policy", "Signature", "Date"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>{shown.map((r) => (
              <tr key={r.id} className="cursor-pointer hover:bg-muted" onClick={() => setOpenId(r.id)}>
                <td className="td mono text-accent">{r.caseNumber}</td><td className="td">{r.employee}</td><td className="td"><Badge value={r.severity} /></td><td className="td mono">+{r.points}</td><td className="td">{r.policy}</td>
                <td className="td">{r.acknowledged ? <Badge value="ACTIVE" label="Signed" /> : <Badge value="PENDING" label="Awaiting" />}</td><td className="td mono">{fmtDate(r.createdAt)}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}

      <Modal open={logOpen} onClose={() => setLogOpen(false)} title="Log infraction">
        <div className="space-y-3">
          {templates.length > 0 && (
            <Field label="Pre-fill from corrective-action template (optional)">
              <select
                className="input"
                defaultValue=""
                onChange={(e) => {
                  const t = templates.find((x) => x.id === e.target.value);
                  if (t) {
                    setF({ ...f, severity: severities.includes(t.severity) ? t.severity : f.severity, pointsAdded: t.points, policyViolated: t.policy, summary: t.summary });
                  }
                }}
              >
                <option value="">Choose a template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.severity.replace(/_/g, " ")}, +{t.points} pts)</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Employee"><select className="input" value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })}><option value="">Select…</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Severity"><select className="input" value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}>{severities.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select></Field>
            <Field label="Strike points"><input className="input mono" type="number" min={0} max={20} value={f.pointsAdded} onChange={(e) => setF({ ...f, pointsAdded: Number(e.target.value) })} /></Field>
          </div>
          <Field label="Policy violated"><input className="input" value={f.policyViolated} onChange={(e) => setF({ ...f, policyViolated: e.target.value })} placeholder="e.g. Attendance, Policy 2.1" /></Field>
          <Field label="What happened (visible to the employee)"><textarea className="textarea" rows={4} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} /></Field>
          <Field label="Evidence links (one per line)"><textarea className="textarea mono" rows={2} value={f.evidence} onChange={(e) => setF({ ...f, evidence: e.target.value })} /></Field>
          {canConfidential && <Field label="Confidential manager notes (never shown to the employee)"><textarea className="textarea" rows={3} value={f.confidentialManagerNotes} onChange={(e) => setF({ ...f, confidentialManagerNotes: e.target.value })} /></Field>}
          <button className="btn-primary w-full" disabled={pending} onClick={submit}>{pending ? "Logging…" : "Log infraction"}</button>
        </div>
      </Modal>

      <Modal open={rulesOpen} onClose={() => setRulesOpen(false)} title="Progressive discipline rules">
        <div className="space-y-3 text-[13px]">
          {rules.length === 0 ? <p className="text-soft">No rules yet.</p> : <ul className="divide-y divide-line">{rules.map((r) => <li key={r.id} className="flex items-center justify-between gap-2 py-2"><span>{r.count} x {r.whenSeverity.replace(/_/g, " ")} within {r.withinDays} days, then <b>{r.escalateTo.replace(/_/g, " ")}</b></span><button className="btn-danger" disabled={pending} onClick={() => exec(() => deleteDisciplineRuleAction(r.id), { success: "Rule removed", onOk: () => router.refresh() })}>Delete</button></li>)}</ul>}
          <div className="grid grid-cols-2 gap-2 border-t border-line pt-3">
            <Field label="When severity"><select className="input" value={rule.whenSeverity} onChange={(e) => setRule({ ...rule, whenSeverity: e.target.value })}>{SEVS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select></Field>
            <Field label="Escalate to"><select className="input" value={rule.escalateTo} onChange={(e) => setRule({ ...rule, escalateTo: e.target.value })}>{SEVS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select></Field>
            <Field label="Count"><input className="input mono" type="number" min={2} max={10} value={rule.count} onChange={(e) => setRule({ ...rule, count: Number(e.target.value) })} /></Field>
            <Field label="Within days"><input className="input mono" type="number" min={7} max={730} value={rule.withinDays} onChange={(e) => setRule({ ...rule, withinDays: Number(e.target.value) })} /></Field>
          </div>
          <button className="btn-primary w-full" disabled={pending} onClick={() => exec(() => saveDisciplineRuleAction({ ...rule, enabled: true }), { success: "Rule added", onOk: () => router.refresh() })}>Add rule</button>
          <button className="btn w-full" disabled={pending} onClick={() => exec(() => applyStrikeDecayAction(), { onOk: (d) => { toast("ok", `Decay applied: ${d.updated} employee(s) updated (${d.decayDays}-day window)`); router.refresh(); } })}>Apply strike decay now</button>
        </div>
      </Modal>

      <Drawer open={!!open} onClose={() => setOpenId(null)} title={open ? `${open.caseNumber} · case dossier` : ""} wide>
        {open && (
          <div className="space-y-4 text-[13px]">
            <div className="flex flex-wrap items-center gap-2"><Badge value={open.severity} /><span className="mono">+{open.points} pts</span><span className="ml-auto">{open.acknowledged ? <Badge value="ACTIVE" label="Acknowledged" /> : <Badge value="PENDING" label="Awaiting signature" />}</span></div>
            <div><div className="text-xs text-soft">Employee</div><a className="text-accent" href={`/app/employee/${open.employeeId}`}>{open.employee}</a></div>
            <div><div className="text-xs text-soft">Policy</div>{open.policy}</div>
            <div><div className="text-xs text-soft">Summary</div>{open.summary}</div>
            {open.evidence.length > 0 && <div><div className="text-xs text-soft">Evidence</div>{open.evidence.map((u) => <a key={u} className="mono block break-all text-accent" href={u} target="_blank" rel="noreferrer">{u}</a>)}</div>}
            {open.confidential && <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"><div className="mono text-[11px] uppercase">Confidential manager notes</div>{open.confidential}</div>}
            <div className="mono text-xs text-soft">Issued by {open.issuedBy} · {fmtDateTime(open.createdAt)}{open.acknowledged ? ` · signed "${open.signedBy}" ${fmtDateTime(open.acknowledgedAt)}` : ""}</div>
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-soft">Timeline (append-only)</h3>
              <ol className="space-y-2 border-l border-line pl-3">{open.timeline.map((t) => <li key={t.id}><div className="mono text-[11px] text-soft">{fmtDateTime(t.at)} · {t.type.replace(/_/g, " ")}{t.confidential ? " · confidential" : ""}</div><div>{t.actor}: {t.note}</div></li>)}</ol>
            </div>
            <div className="space-y-2 border-t border-line pt-4">
              <Field label="Add timeline note"><textarea className="textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
              {canConfidential && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={noteConf} onChange={(e) => setNoteConf(e.target.checked)} />Confidential (hidden from supervisors and the employee)</label>}
              <button className="btn" disabled={pending} onClick={() => exec(() => addCaseNoteAction(open.id, { note, isConfidential: noteConf }), { success: "Note added", onOk: () => { setNote(""); router.refresh(); } })}>Add note</button>
            </div>
            <div className="space-y-2 border-t border-line pt-4">
              <h3 className="text-xs font-medium uppercase tracking-wider text-soft">Witness statements and evidence</h3>
              {open.attachments.length === 0 && <p className="text-soft">None attached.</p>}
              {open.attachments.map((a) => <div key={a.id} className="rounded-md border border-line p-2"><div className="mono text-[11px] text-soft">{a.kind} · {a.author} · {fmtDateTime(a.at)}</div><div className="font-medium">{a.title}</div>{a.statement && <div className="whitespace-pre-wrap">{a.statement}</div>}</div>)}
              <div className="grid grid-cols-3 gap-2"><select className="input" value={att.kind} onChange={(e) => setAtt({ ...att, kind: e.target.value })}><option value="WITNESS">Witness</option><option value="EVIDENCE">Evidence</option></select><input className="input col-span-2" placeholder="Title / witness name" value={att.title} onChange={(e) => setAtt({ ...att, title: e.target.value })} /></div>
              <textarea className="textarea" rows={3} placeholder="Statement or description" value={att.statement} onChange={(e) => setAtt({ ...att, statement: e.target.value })} />
              <button className="btn" disabled={pending} onClick={() => exec(() => addCaseAttachmentAction(open.id, att), { success: "Added", onOk: () => { setAtt({ ...att, title: "", statement: "" }); router.refresh(); } })}>Add to case</button>
            </div>
            {open.appeals.length > 0 && <div className="space-y-2 border-t border-line pt-4">
              <h3 className="text-xs font-medium uppercase tracking-wider text-soft">Appeals</h3>
              {open.appeals.map((a) => <div key={a.id} className="rounded-md border border-line p-2"><div className="flex items-center gap-2"><Badge value={a.status === "OPEN" ? "PENDING" : a.status === "UPHELD" ? "FAILED" : "PASSED"} label={a.status} /><span className="mono text-[11px] text-soft">{a.by} · {fmtDateTime(a.at)}</span></div><div className="mt-1">{a.reason}</div>
                {a.status !== "OPEN" && <div className="mt-1 text-soft">{a.reviewer}: {a.decision}</div>}
                {a.status === "OPEN" && <div className="mt-2 space-y-2"><textarea className="textarea" rows={2} placeholder="Decision note" value={dec[a.id] ?? ""} onChange={(e) => setDec({ ...dec, [a.id]: e.target.value })} /><div className="flex gap-2">{(["UPHELD", "OVERTURNED"] as const).map((d) => <button key={d} className="btn" disabled={pending} onClick={() => exec(() => decideAppealAction(a.id, { decision: d, note: dec[a.id] ?? "" }), { success: `Appeal ${d.toLowerCase()}`, onOk: () => router.refresh() })}>{d === "UPHELD" ? "Uphold" : "Overturn"}</button>)}</div></div>}
              </div>)}
            </div>}
            <div className="space-y-2">
              <Field label="Log an appeal"><textarea className="textarea" rows={2} value={appeal} onChange={(e) => setAppeal(e.target.value)} /></Field>
              <button className="btn" disabled={pending} onClick={() => exec(() => logAppealAction(open.id, { note: appeal }), { success: "Appeal logged", onOk: () => { setAppeal(""); router.refresh(); } })}>Log appeal</button>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}
