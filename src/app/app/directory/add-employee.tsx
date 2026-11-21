"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createEmployeeAction } from "@/actions/employees";
import { Drawer, Field, useAction } from "@/components/ui";

type Opt = { id: string; name: string };

export function AddEmployee({ departments, roles, defaultOpen }: { departments: Opt[]; roles: Opt[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const router = useRouter();
  const { exec, pending } = useAction();
  const [f, setF] = useState({ fullName: "", email: "", phone: "", emergencyContact: "", departmentId: "", jobRoleId: "", hireDate: new Date().toISOString().slice(0, 10), sendInvite: true, accessRole: "EMPLOYEE" as "EMPLOYEE" | "SUPERVISOR" | "MANAGER" | "ADMIN" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    exec(() => createEmployeeAction(f), {
      success: "Employee added. Required courses were assigned and an invite was sent.",
      onOk: (d) => { setOpen(false); router.push(`/app/employee/${d.id}`); },
    });
  };
  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>Add employee</button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Add employee">
        <form onSubmit={submit} className="space-y-3">
          <Field label="Full name"><input className="input" value={f.fullName} onChange={set("fullName")} required /></Field>
          <Field label="Work email"><input className="input" type="email" value={f.email} onChange={set("email")} required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone"><input className="input" value={f.phone} onChange={set("phone")} /></Field>
            <Field label="Hire date"><input className="input mono" type="date" value={f.hireDate} onChange={set("hireDate")} /></Field>
          </div>
          <Field label="Emergency contact"><input className="input" value={f.emergencyContact} onChange={set("emergencyContact")} placeholder="Name and phone" /></Field>
          <Field label="Department">
            <select className="input" value={f.departmentId} onChange={set("departmentId")}><option value="">None</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          </Field>
          <Field label="Job role (assigns required courses)">
            <select className="input" value={f.jobRoleId} onChange={set("jobRoleId")}><option value="">None</option>{roles.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          </Field>
          <Field label="Workspace access role (permissions level)">
            <select className="input" value={f.accessRole} onChange={set("accessRole")}>
              <option value="EMPLOYEE">Employee (My Portal only)</option>
              <option value="SUPERVISOR">Supervisor (Verify checklists &amp; log warnings)</option>
              <option value="MANAGER">Manager (Manage staff, training &amp; infractions)</option>
              <option value="ADMIN">Admin (Full workspace management &amp; settings)</option>
            </select>
          </Field>
          <label className="flex items-start gap-2 text-[13px]"><input type="checkbox" className="mt-0.5" checked={f.sendInvite} onChange={(e) => setF({ ...f, sendInvite: e.target.checked })} />Send a sign-in invite so they can create their own login</label>
          <button className="btn-primary w-full" disabled={pending}>{pending ? "Adding…" : "Add employee"}</button>
        </form>
      </Drawer>
    </>
  );
}
