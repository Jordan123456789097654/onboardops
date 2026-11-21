"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addCaseNoteAction, issueInfractionAction, logAppealAction } from "@/actions/infractions";
import { Badge, Drawer, Empty, Field, Modal, PageHeader, useAction, useToast } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/utils";

export type CaseRow = {
  id: string; caseNumber: string; employeeId: string; employee: string; severity: string; points: number; policy: string; summary: string; evidence: string[]; confidential: string;
  acknowledged: boolean; signedBy: string | null; acknowledgedAt: string | null; issuedBy: string; createdAt: string;
  timeline: { id: string; type: string; note: string; actor: string; at: string; confidential: boolean }[];
};

export function Ledger({ rows, employees, severities, canConfidential, defaultOpen }: { rows: CaseRow[]; employees: { id: string; label: string }[]; severities: string[]; canConfidential: boolean; defaultOpen: boolean }) {
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
      <PageHeader title="Infractions" sub="Case ledger. Cases and timeline entries are append-only."><button className="btn-primary" onClick={() => setLogOpen(true)}>Log Infraction</button></PageHeader>
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
