"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveEmployeeCustomValuesAction, saveTimeOffAllowanceAction } from "@/actions/records";
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
