"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { setStaffRoleAction } from "@/actions/admin";
import { Field, PageHeader, useAction } from "@/components/ui";

type S = { id: string; name: string; email: string; role: string; bootstrap: boolean };

export function StaffManager({ staff, me }: { staff: S[]; me: string }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("SUPPORT");
  return (
    <>
      <PageHeader title="Staff & roles" sub="Owner can do everything. Support handles the inbox, recovery and support access. Read-only sees the dashboard and workspace list." />
      <div className="card mb-6 divide-y divide-line">
        {staff.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-[13px]">
            <div className="min-w-0 flex-1"><div className="font-medium">{s.name}{s.email === me ? " (you)" : ""}</div><div className="mono text-xs text-soft">{s.email}</div></div>
            {s.bootstrap ? <span className="mono text-xs text-soft">OWNER (set by PLATFORM_OWNER_EMAILS)</span> : (
              <><select className="input !w-36" value={s.role} disabled={pending} onChange={(e) => exec(() => setStaffRoleAction({ email: s.email, role: e.target.value }), { success: "Role updated", onOk: () => router.refresh() })}>{["OWNER", "SUPPORT", "VIEWER"].map((r) => <option key={r}>{r}</option>)}</select>
                {s.email !== me && <button className="btn" disabled={pending} onClick={() => exec(() => setStaffRoleAction({ email: s.email, role: "NONE" }), { success: "Access removed", onOk: () => router.refresh() })}>Remove</button>}</>
            )}
          </div>
        ))}
      </div>
      <form className="card max-w-xl space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); exec(() => setStaffRoleAction({ email, role }), { success: "Staff member added", onOk: () => { setEmail(""); router.refresh(); } }); }}>
        <h2 className="text-sm font-semibold">Add a staff member</h2>
        <p className="text-xs text-soft">They need an OnboardOps account first (ask them to register). They will be emailed.</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_160px]"><Field label="Account email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field><Field label="Role"><select className="input" value={role} onChange={(e) => setRole(e.target.value)}>{["SUPPORT", "VIEWER", "OWNER"].map((r) => <option key={r}>{r}</option>)}</select></Field></div>
        <button className="btn-primary" disabled={pending}>Add staff member</button>
      </form>
    </>
  );
}
