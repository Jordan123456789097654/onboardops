"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { clockInAction, clockOutAction, deleteTimeEntryAction } from "@/actions/operations";
import { Badge, Empty, Field, Modal, PageHeader, useAction } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

type Entry = { id: string; employee: string; clockIn: string; clockOut: string | null; note: string };

export function Timesheets({ entries, employees }: { entries: Entry[]; employees: { id: string; label: string }[] }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [empId, setEmpId] = useState("");
  const [note, setNote] = useState("");

  const duration = (start: string, end: string | null) => {
    if (!end) return "Active";
    const mins = Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <>
      <PageHeader title="Time Clock & Timesheets" sub="Track active clock-ins and shift durations.">
        <a className="btn" href="/api/export/payroll">Payroll hours (CSV)</a>
        <button className="btn-primary" onClick={() => setOpen(true)}>Clock in staff</button>
      </PageHeader>
      {entries.length === 0 ? (
        <Empty title="No time entries recorded" hint="Clock in an employee to start tracking shift hours." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr>
                {["Employee", "Clock in", "Clock out", "Duration", "Note", ""].map((h) => (
                  <th key={h} className="th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-muted">
                  <td className="td font-medium">{e.employee}</td>
                  <td className="td mono text-xs">{fmtDateTime(e.clockIn)}</td>
                  <td className="td mono text-xs">{e.clockOut ? fmtDateTime(e.clockOut) : <Badge value="ACTIVE" label="Clocked in" />}</td>
                  <td className="td mono text-xs">{duration(e.clockIn, e.clockOut)}</td>
                  <td className="td text-soft">{e.note || "—"}</td>
                  <td className="td text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!e.clockOut && (
                        <button
                          className="btn !h-7 !text-xs"
                          disabled={pending}
                          onClick={() => exec(() => clockOutAction(e.id), { success: "Clocked out", onOk: () => router.refresh() })}
                        >
                          Clock out
                        </button>
                      )}
                      <button
                        className="btn !px-2"
                        aria-label="Delete time entry"
                        disabled={pending}
                        onClick={() => exec(() => deleteTimeEntryAction(e.id), { success: "Entry removed", onOk: () => router.refresh() })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Clock in">
        <div className="space-y-3">
          <Field label="Employee">
            <select className="input" value={empId} onChange={(e) => setEmpId(e.target.value)}>
              <option value="">Select employee…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Note (optional)">
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Shift or station note" />
          </Field>
          <button
            className="btn-primary w-full"
            disabled={pending || !empId}
            onClick={() => exec(() => clockInAction({ employeeId: empId, note }), { success: "Clocked in", onOk: () => { setOpen(false); setNote(""); router.refresh(); } })}
          >
            Clock in now
          </button>
        </div>
      </Modal>
    </>
  );
}
