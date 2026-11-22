"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveCustomFieldsAction } from "@/actions/records";
import { Field, useAction } from "@/components/ui";

type F = { id?: string; label: string; type: "text" | "date" | "select" | "yesno"; options: string[]; showToEmployee: boolean };

export function FieldsPanel({ initial }: { initial: F[] }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [fields, setFields] = useState<F[]>(initial);
  const set = (i: number, p: Partial<F>) => setFields((a) => a.map((f, j) => (j === i ? { ...f, ...p } : f)));
  return (
    <div className="card space-y-3 p-4 text-[13px]">
      <p className="text-soft">Extra fields that appear on every employee record. Values are edited on each employee&apos;s page.</p>
      {fields.map((f, i) => (
        <div key={f.id ?? i} className="grid gap-2 rounded-md border border-line p-2 sm:grid-cols-[1fr_8rem_auto]">
          <input className="input" placeholder="Label (e.g. Forklift badge #)" value={f.label} onChange={(e) => set(i, { label: e.target.value })} />
          <select className="input" value={f.type} onChange={(e) => set(i, { type: e.target.value as F["type"] })}><option value="text">Text</option><option value="date">Date</option><option value="select">Choice</option><option value="yesno">Yes / no</option></select>
          <button className="btn-danger" onClick={() => setFields((a) => a.filter((_, j) => j !== i))}>Remove</button>
          {f.type === "select" && <input className="input sm:col-span-3" placeholder="Choices, comma separated" value={f.options.join(", ")} onChange={(e) => set(i, { options: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />}
          <label className="flex items-center gap-2 text-xs sm:col-span-3"><input type="checkbox" checked={f.showToEmployee} onChange={(e) => set(i, { showToEmployee: e.target.checked })} />Visible to the employee</label>
        </div>
      ))}
      <div className="flex gap-2">
        <button className="btn" onClick={() => setFields((a) => [...a, { label: "", type: "text", options: [], showToEmployee: false }])}>Add field</button>
        <button className="btn-primary" disabled={pending} onClick={() => exec(() => saveCustomFieldsAction(fields), { success: "Custom fields saved", onOk: () => router.refresh() })}>Save fields</button>
      </div>
    </div>
  );
}
