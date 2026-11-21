"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { assignCourseAction } from "@/actions/courses";
import { Field, Modal, useAction } from "@/components/ui";

export function AssignCourse({ courseId, courseTitle, employees }: { courseId: string; courseTitle: string; employees: { id: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [reason, setReason] = useState("Assigned by manager");
  const [dueDate, setDueDate] = useState("");
  const router = useRouter();
  const { exec, pending } = useAction();
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>Assign</button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Assign: ${courseTitle}`}>
        <div className="space-y-3">
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-line p-2">
            {employees.map((e) => (<label key={e.id} className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={sel.includes(e.id)} onChange={() => toggle(e.id)} /><span className="mono">{e.label}</span></label>))}
          </div>
          <Field label="Reason"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <Field label="Due date (optional, defaults to the course setting)"><input className="input mono" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
          <button className="btn-primary w-full" disabled={pending} onClick={() => exec(() => assignCourseAction(courseId, { employeeIds: sel, reason, dueDate }), { onOk: (d) => { setOpen(false); setSel([]); router.refresh(); }, success: "Assignments saved. People already enrolled were skipped." })}>Assign to {sel.length} employee{sel.length === 1 ? "" : "s"}</button>
        </div>
      </Modal>
    </>
  );
}
