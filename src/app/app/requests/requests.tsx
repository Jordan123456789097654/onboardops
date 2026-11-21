"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { decideStaffRequestAction } from "@/actions/requests";
import { Badge, Drawer, Empty, Field, PageHeader, useAction } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/utils";

type Row = { id: string; kind: string; status: string; employeeId: string; employee: string; department: string | null; start: string | null; end: string | null; reason: string; by: string | null; note: string; at: string; decidedAt: string | null };
const KIND: Record<string, string> = { LOA: "Leave of absence", RETIREMENT: "Retirement", RESIGNATION: "Resignation" };
const TONE: Record<string, string> = { PENDING: "PENDING", APPROVED: "PASSED", DENIED: "FAILED", WITHDRAWN: "LOA" };

export function Requests({ rows, canDecide, isAdmin }: { rows: Row[]; canDecide: boolean; isAdmin: boolean }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [status, setStatus] = useState("PENDING");
  const [sel, setSel] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const shown = useMemo(() => rows.filter((r) => !status || r.status === status), [rows, status]);
  const cur = rows.find((r) => r.id === sel) ?? null;
  const pendingCount = rows.filter((r) => r.status === "PENDING").length;
  const decide = (decision: "APPROVED" | "DENIED") => cur && exec(() => decideStaffRequestAction(cur.id, { decision, note }), { success: decision === "APPROVED" ? "Approved. The employee was notified." : "Denied. The employee was notified.", onOk: () => { setSel(null); setNote(""); router.refresh(); } });
  return (
    <>
      <PageHeader title="Staff requests" sub={`${pendingCount} waiting. Leave of absence, retirement and resignation requests from employees.`} />
      <div className="mb-3"><select className="input !w-44" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option>{["PENDING", "APPROVED", "DENIED", "WITHDRAWN"].map((s) => <option key={s}>{s}</option>)}</select></div>
      {shown.length === 0 ? <Empty title="No requests here" hint="Employees send these from My Portal." /> : (
        <div className="card max-h-[72vh] overflow-auto"><table className="w-full min-w-[760px] border-collapse"><thead><tr>{["Employee", "Request", "Dates", "Status", "Received"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>{shown.map((r) => (
            <tr key={r.id} className="cursor-pointer hover:bg-muted" onClick={() => { setSel(r.id); setNote(r.note); }}>
              <td className="td"><div className="font-medium">{r.employee}</div><div className="text-xs text-soft">{r.department ?? "No department"}</div></td><td className="td">{KIND[r.kind]}</td>
              <td className="td mono text-xs">{r.kind === "LOA" ? `${fmtDate(r.start)} → ${r.end ? fmtDate(r.end) : "open"}` : `last day ${fmtDate(r.end)}`}</td>
              <td className="td"><Badge value={TONE[r.status]} label={r.status} /></td><td className="td mono text-xs">{fmtDateTime(r.at)}</td>
            </tr>))}</tbody></table></div>
      )}
      <Drawer open={!!cur} onClose={() => setSel(null)} title={cur ? KIND[cur.kind] : ""}>
        {cur && (
          <div className="space-y-4 text-[13px]">
            <div className="flex items-center gap-2"><Badge value={TONE[cur.status]} label={cur.status} /><Link className="text-accent" href={`/app/employee/${cur.employeeId}`}>{cur.employee}</Link></div>
            <div className="grid grid-cols-2 gap-3"><div><div className="text-xs text-soft">{cur.kind === "LOA" ? "Starts" : "Last day"}</div><div className="mono">{fmtDate(cur.kind === "LOA" ? cur.start : cur.end)}</div></div>{cur.kind === "LOA" && <div><div className="text-xs text-soft">Returns</div><div className="mono">{cur.end ? fmtDate(cur.end) : "Not set"}</div></div>}</div>
            <div><div className="text-xs text-soft">Reason</div><p className="mt-0.5 whitespace-pre-wrap">{cur.reason}</p></div>
            {cur.status !== "PENDING" && <div className="rounded-md border border-line bg-muted p-3"><div className="text-xs text-soft">Decided by {cur.by} {fmtDateTime(cur.decidedAt)}</div>{cur.note || "No note."}</div>}
            {cur.status === "PENDING" && canDecide && (
              <div className="space-y-2 border-t border-line pt-4">
                {cur.kind !== "LOA" && !isAdmin && <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">Only an owner or admin can accept a {KIND[cur.kind].toLowerCase()}.</p>}
                <Field label="Note to the employee (required if denying)"><textarea className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
                <div className="flex gap-2"><button className="btn-primary" disabled={pending || (cur.kind !== "LOA" && !isAdmin)} onClick={() => decide("APPROVED")}>Approve</button><button className="btn" disabled={pending} onClick={() => decide("DENIED")}>Deny</button></div>
                <p className="text-xs text-soft">{cur.kind === "LOA" ? "Approving sets the employee to Leave of absence on the start date and back to Active after the return date." : "Approving records the separation. On the last day the employee is marked as separated and loses access."}</p>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
}
