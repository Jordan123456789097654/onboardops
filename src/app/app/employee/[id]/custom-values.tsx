"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveEmployeeCustomValuesAction, saveTimeOffAllowanceAction } from "@/actions/records";
import { assignLocationAction } from "@/actions/integrations";
import { addCoachingNoteAction, deleteCoachingNoteAction } from "@/actions/coaching";
import { Field, useAction } from "@/components/ui";

export type CField = { id: string; label: string; type: string; options: string[] };

export function CustomValues({ employeeId, fields, values, canEdit }: { employeeId: string; fields: CField[]; values: Record<string, string>; canEdit: boolean }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [v, setV] = useState<Record<string, string>>(values);
  if (!fields.length) return null;
  const set = (id: string, val: string) => setV((x) => ({ ...x, [id]: val }));
  return (
    <section className="card mt-4 space-y-3 p-4 text-[13px]">
      <h2 className="text-sm font-semibold">Custom fields</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <Field key={f.id} label={f.label}>
            {f.type === "select" ? (
              <select className="input" disabled={!canEdit} value={v[f.id] ?? ""} onChange={(e) => set(f.id, e.target.value)}><option value="">—</option>{f.options.map((o) => <option key={o} value={o}>{o}</option>)}</select>
            ) : f.type === "yesno" ? (
              <select className="input" disabled={!canEdit} value={v[f.id] ?? ""} onChange={(e) => set(f.id, e.target.value)}><option value="">—</option><option value="Yes">Yes</option><option value="No">No</option></select>
            ) : (
              <input className="input" type={f.type === "date" ? "date" : "text"} disabled={!canEdit} value={v[f.id] ?? ""} onChange={(e) => set(f.id, e.target.value)} />
            )}
          </Field>
        ))}
      </div>
      {canEdit && <button className="btn-primary" disabled={pending} onClick={() => exec(() => saveEmployeeCustomValuesAction(employeeId, v), { success: "Saved", onOk: () => router.refresh() })}>Save custom fields</button>}
    </section>
  );
}

type Bal = { type: string; allowance: number; used: number; pending: number };

export function TimeOffBalances({ employeeId, balances, canEdit }: { employeeId: string; balances: Bal[]; canEdit: boolean }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [a, setA] = useState<Record<string, number>>(Object.fromEntries(balances.map((b) => [b.type, b.allowance])));
  return (
    <section className="card mt-4 space-y-3 p-4 text-[13px]">
      <h2 className="text-sm font-semibold">Time off this year</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {balances.map((b) => (
          <div key={b.type} className="rounded-md border border-line p-3">
            <div className="text-xs text-soft">{b.type.charAt(0) + b.type.slice(1).toLowerCase()}</div>
            <div className="mono text-lg font-semibold">{b.allowance > 0 ? `${Math.max(0, b.allowance - b.used - b.pending)} left` : `${b.used} used`}</div>
            <div className="text-xs text-soft">{b.used} used · {b.pending} pending</div>
            {canEdit && <label className="mt-2 block text-xs text-soft">Yearly days (0 = not tracked)<input className="input mono mt-1" type="number" min={0} max={365} value={a[b.type]} onChange={(e) => setA({ ...a, [b.type]: Number(e.target.value) })} /></label>}
          </div>
        ))}
      </div>
      {canEdit && <button className="btn" disabled={pending} onClick={() => exec(() => saveTimeOffAllowanceAction(employeeId, a), { success: "Allowance saved", onOk: () => router.refresh() })}>Save yearly allowance</button>}
    </section>
  );
}

export type Coach = { id: string; author: string; note: string; at: string };

export function CoachingNotes({ employeeId, notes }: { employeeId: string; notes: Coach[] }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [text, setText] = useState("");
  return (
    <section className="card mt-4 space-y-3 p-4 text-[13px]">
      <h2 className="text-sm font-semibold">Coaching notes</h2>
      <p className="text-xs text-soft">Informal notes for managers. They are not infractions, carry no points, and the employee cannot see them.</p>
      {notes.map((n) => (
        <div key={n.id} className="rounded-md border border-line p-2"><div className="mono text-[11px] text-soft">{n.author} · {new Date(n.at).toLocaleDateString()}</div><div className="whitespace-pre-wrap">{n.note}</div>
          <button className="mt-1 text-xs text-rose-600" disabled={pending} onClick={() => { if (confirm("Delete this note?")) exec(() => deleteCoachingNoteAction(n.id), { success: "Deleted", onOk: () => router.refresh() }); }}>Delete</button></div>
      ))}
      <textarea className="textarea" rows={2} placeholder="e.g. Talked through lateness; agreed to text before shift if running late." value={text} onChange={(e) => setText(e.target.value)} />
      <button className="btn" disabled={pending} onClick={() => exec(() => addCoachingNoteAction(employeeId, { note: text }), { success: "Note added", onOk: () => { setText(""); router.refresh(); } })}>Add note</button>
    </section>
  );
}

export function LocationPicker({ employeeId, locationId, locations, canEdit }: { employeeId: string; locationId: string; locations: { id: string; name: string }[]; canEdit: boolean }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  if (!locations.length) return null;
  return (
    <section className="card mt-4 flex flex-wrap items-center gap-3 p-4 text-[13px]">
      <h2 className="text-sm font-semibold">Location</h2>
      <select className="input !w-56" disabled={!canEdit || pending} value={locationId} onChange={(e) => exec(() => assignLocationAction(employeeId, e.target.value), { success: "Location updated", onOk: () => router.refresh() })}>
        <option value="">Not assigned</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
    </section>
  );
}
