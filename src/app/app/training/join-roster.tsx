"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { joinTrainingRosterAction } from "@/actions/self-training";
import { useAction } from "@/components/ui";

/** For owners, admins and managers who are not on the roster yet: lets them take courses themselves. */
export function JoinRoster({ roles }: { roles: { id: string; title: string }[] }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [roleId, setRoleId] = useState("");
  return (
    <div className="card mb-4 p-4 text-[13px]">
      <h2 className="font-medium">Take the courses yourself</h2>
      <p className="mt-0.5 text-soft">You are not on the training roster yet, so courses, policies and checklists are not assigned to you. Add yourself to take them like everyone else. Pick a job role to get the courses it requires, or leave it blank and take courses from the catalog.</p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="block"><span className="label">Job role (optional)</span>
          <select className="input !w-64" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            <option value="">No job role</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>
        </label>
        <button className="btn-primary" disabled={pending} onClick={() => exec(() => joinTrainingRosterAction({ jobRoleId: roleId }), { success: "You are on the roster. Open My Portal to start.", onOk: () => { router.push("/app/my-portal"); router.refresh(); } })}>{pending ? "Adding…" : "Add me to the roster"}</button>
      </div>
    </div>
  );
}
