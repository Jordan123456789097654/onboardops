"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { reassignEnrollmentAction } from "@/actions/compliance-review";
import { useAction } from "@/components/ui";

/** Sends the course back to the person for another attempt. Their previous results stay on record. */
export function ReassignForm({ enrollmentId }: { enrollmentId: string }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) return <button className="btn" onClick={() => setOpen(true)}>Reassign course</button>;
  return (
    <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); exec(() => reassignEnrollmentAction(enrollmentId, reason), { success: "Reassigned. The employee has been notified.", onOk: () => { setOpen(false); router.refresh(); } }); }}>
      <input className="input !w-72" placeholder="Reason (shown to the employee)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
      <button className="btn-primary" disabled={pending}>{pending ? "Reassigning…" : "Reassign"}</button>
      <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
    </form>
  );
}
