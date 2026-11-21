"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteCustomRoleAction, saveCustomRoleAction, saveRolePermsAction } from "@/actions/features";
import { PERMS } from "@/lib/perms";
import { Field, Modal, useAction } from "@/components/ui";

type CRole = { id: string; name: string; description: string; baseRole: string; members: number };
const BUILT = [["MANAGER", "Manager"], ["SUPERVISOR", "Supervisor"], ["EMPLOYEE", "Employee"]] as const;

export function RolesPanel({ initial, customRoles, customEnabled }: { initial: Record<string, string[]>; customRoles: CRole[]; customEnabled: boolean }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [grants, setGrants] = useState<Record<string, string[]>>(initial);
  const [edit, setEdit] = useState<{ id?: string; name: string; description: string; baseRole: string } | null>(null);
  const columns = [...BUILT.map(([k, l]) => ({ key: k as string, label: l, built: true })), ...(customEnabled ? customRoles.map((r) => ({ key: `custom:${r.id}`, label: r.name, built: false })) : [])];
  const has = (col: string, perm: string) => (grants[col] ?? []).includes(perm);
  const isDefault = (col: string, perm: string) => PERMS.find((p) => p.key === perm)?.defaults.includes(col as "MANAGER") ?? false;
  const toggle = (col: string, perm: string) => setGrants((g) => ({ ...g, [col]: has(col, perm) ? (g[col] ?? []).filter((x) => x !== perm) : [...(g[col] ?? []), perm] }));
  const groups = Array.from(new Set(PERMS.map((p) => p.group)));
  const dirty = JSON.stringify(grants) !== JSON.stringify(initial);
  return (
    <div className="space-y-6">
      <p className="text-[13px] text-soft">Owners and Admins can do everything. Choose what other roles can do. Ticks that are locked are what the role always has. Custom roles start from a base level and get exactly the extra permissions you tick.</p>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-left">
          <thead><tr><th className="th !static">Permission</th>{columns.map((c) => <th key={c.key} className="th !static text-center">{c.label}</th>)}</tr></thead>
          <tbody>
            {groups.map((g) => (
              <>
                <tr key={`g-${g}`}><td colSpan={columns.length + 1} className="bg-muted px-3 py-1.5 text-xs font-semibold text-soft">{g}</td></tr>
                {PERMS.filter((p) => p.group === g).map((p) => (
                  <tr key={p.key} className="hover:bg-muted"><td className="td">{p.label}</td>
                    {columns.map((c) => { const locked = c.built && isDefault(c.key, p.key); return <td key={c.key} className="td text-center"><input type="checkbox" aria-label={`${c.label}: ${p.label}`} checked={locked || has(c.key, p.key)} disabled={locked} onChange={() => toggle(c.key, p.key)} /></td>; })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn-primary" disabled={pending || !dirty} onClick={() => exec(() => saveRolePermsAction(grants), { success: "Permissions saved", onOk: () => router.refresh() })}>Save permissions</button>

      {customEnabled ? (
        <section>
          <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">Custom roles</h2><button className="btn" onClick={() => setEdit({ name: "", description: "", baseRole: "EMPLOYEE" })}>New role</button></div>
          {customRoles.length === 0 ? <p className="text-[13px] text-soft">No custom roles yet. Try a &ldquo;Safety lead&rdquo;: Employee base, plus course building and incident review.</p> : (
            <div className="card divide-y divide-line">{customRoles.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-[13px]"><div className="min-w-0 flex-1"><div className="font-medium">{r.name}</div><div className="text-xs text-soft">Base: {r.baseRole.toLowerCase()} · {r.members} member{r.members === 1 ? "" : "s"}{r.description ? ` · ${r.description}` : ""}</div></div>
                <button className="btn" onClick={() => setEdit({ id: r.id, name: r.name, description: r.description, baseRole: r.baseRole })}>Edit</button>
                <button className="btn !px-2" aria-label={`Delete ${r.name}`} disabled={pending} onClick={() => { if (confirm(`Delete the role "${r.name}"?`)) exec(() => deleteCustomRoleAction(r.id), { success: "Role deleted", onOk: () => router.refresh() }); }}><Trash2 className="h-3.5 w-3.5" /></button></div>
            ))}</div>
          )}
          <p className="mt-2 text-xs text-soft">Assign a custom role to a person under Access.</p>
        </section>
      ) : <p className="text-xs text-soft">Custom roles are turned off. Switch them on under Features.</p>}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit role" : "New custom role"}>
        {edit && (
          <div className="space-y-3">
            <Field label="Role name"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Safety lead" /></Field>
            <Field label="Description (optional)"><input className="input" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <Field label="Base level"><select className="input" value={edit.baseRole} onChange={(e) => setEdit({ ...edit, baseRole: e.target.value })}><option value="EMPLOYEE">Employee (own portal only)</option><option value="SUPERVISOR">Supervisor (see staff, warn, verify)</option><option value="MANAGER">Manager (run people and training)</option></select></Field>
            <p className="text-xs text-soft">Pick the closest level, then add specific permissions in the table above.</p>
            <button className="btn-primary w-full" disabled={pending} onClick={() => exec(() => saveCustomRoleAction(edit), { success: "Role saved", onOk: () => { setEdit(null); router.refresh(); } })}>Save role</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
