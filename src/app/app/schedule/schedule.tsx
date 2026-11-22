"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createShiftAction, decideShiftSwapAction, deleteShiftAction } from "@/actions/operations";
import { WeekGrid } from "./week-grid";
import { Empty, Field, Modal, PageHeader, useAction } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

type ShiftRow = { employeeId?: string | null; id: string; employee: string; department: string | null; startsAt: string; endsAt: string; label: string; notes: string; swap?: string | null };

export function Schedule({
  shifts,
  employees,
  departments,
}: {
  shifts: ShiftRow[];
  employees: { id: string; label: string }[];
  departments: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"week" | "table">("week");
  const [f, setF] = useState({ employeeId: "", departmentId: "", startsAt: "", endsAt: "", label: "Morning Shift", notes: "" });

  return (
    <>
      <PageHeader title="Shift Schedule" sub="Schedule shifts across departments and staff.">
        <button className="btn-primary" onClick={() => setOpen(true)}>Add shift</button>
      </PageHeader>
      <div className="mb-3 flex gap-2"><button className={`btn ${view === "week" ? "!border-accent text-accent" : ""}`} onClick={() => setView("week")}>Week</button><button className={`btn ${view === "table" ? "!border-accent text-accent" : ""}`} onClick={() => setView("table")}>Table</button></div>
      {view === "week" ? <WeekGrid shifts={shifts.map((s) => ({ id: s.id, employeeId: s.employeeId ?? null, employee: s.employee, label: s.label, startsAt: s.startsAt, endsAt: s.endsAt, swap: s.swap ? "PENDING" : null }))} employees={employees} /> : shifts.length === 0 ? (
        <Empty title="No shifts scheduled" hint="Click 'Add shift' to create your team's schedule." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr>
                {["Assigned to", "Shift", "Department", "Starts", "Ends", "Notes", ""].map((h) => (
                  <th key={h} className="th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => (
                <tr key={s.id} className="hover:bg-muted">
                  <td className="td font-medium">{s.employee}</td>
                  <td className="td">{s.label || "Shift"}</td>
                  <td className="td">{s.department ?? "—"}</td>
                  <td className="td mono text-xs">{fmtDateTime(s.startsAt)}</td>
                  <td className="td mono text-xs">{fmtDateTime(s.endsAt)}</td>
                  <td className="td text-soft">{s.notes || "—"}{s.swap && <div className="mt-1 text-amber-700 dark:text-amber-300">{s.swap}<span className="ml-2 inline-flex gap-1">{(["APPROVED", "DENIED"] as const).map((d) => <button key={d} className="btn !h-6 !px-2 !text-xs" disabled={pending} onClick={() => exec(() => decideShiftSwapAction(s.id, { decision: d }), { success: `Swap ${d.toLowerCase()}`, onOk: () => router.refresh() })}>{d === "APPROVED" ? "Approve" : "Deny"}</button>)}</span></div>}</td>
                  <td className="td text-right">
                    <button
                      className="btn !px-2"
                      aria-label="Delete shift"
                      disabled={pending}
                      onClick={() => exec(() => deleteShiftAction(s.id), { success: "Shift removed", onOk: () => router.refresh() })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Schedule shift">
        <div className="space-y-3">
          <Field label="Employee (leave blank for open shift)">
            <select className="input" value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })}>
              <option value="">Open shift</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Department">
              <select className="input" value={f.departmentId} onChange={(e) => setF({ ...f, departmentId: e.target.value })}>
                <option value="">Any</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Shift label">
              <input className="input" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Opening / Mid / Closing" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts">
              <input className="input mono" type="datetime-local" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} />
            </Field>
            <Field label="Ends">
              <input className="input mono" type="datetime-local" value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea className="textarea" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </Field>
          <button
            className="btn-primary w-full"
            disabled={pending || !f.startsAt || !f.endsAt}
            onClick={() => exec(() => createShiftAction(f), { success: "Shift scheduled", onOk: () => { setOpen(false); router.refresh(); } })}
          >
            Save shift
          </button>
        </div>
      </Modal>
    </>
  );
}
