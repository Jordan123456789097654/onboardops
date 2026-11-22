"use client";
import { useMemo, useState } from "react";
import { decideProfileChangeAction } from "@/actions/records";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { decideStaffRequestAction } from "@/actions/requests";
import { Badge, Drawer, Empty, Field, PageHeader, useAction } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/utils";

type Row = { id: string; kind: string; status: string; employeeId: string; employee: string; department: string | null; start: string | null; end: string | null; reason: string; by: string | null; note: string; at: string; decidedAt: string | null };
const KIND: Record<string, string> = { LOA: "Leave of absence", RETIREMENT: "Retirement", RESIGNATION: "Resignation", TIMEOFF: "Time off" };
const isLeave = (k: string) => k === "LOA" || k === "TIMEOFF";
const DAY = 86400000;
const span = (r: Row) => { const a = r.start ? new Date(r.start).getTime() : NaN; const b = r.end ? new Date(r.end).getTime() : a; return [a, isNaN(b) ? a : b] as const; };
const overlapping = (cur: Row, rows: Row[]) => {
  const [a, b] = span(cur);
  if (isNaN(a)) return [];
  return rows.filter((o) => o.id !== cur.id && isLeave(o.kind) && (o.status === "PENDING" || o.status === "APPROVED") && o.department === cur.department && (() => { const [c, d] = span(o); return !isNaN(c) && c <= b && d >= a; })());
};

function LeaveCalendar({ rows }: { rows: Row[] }) {
  const [m, setM] = useState(() => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1)); });
  const first = m.getTime();
  const lead = m.getUTCDay();
  const dim = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 0)).getUTCDate();
  const leave = rows.filter((r) => isLeave(r.kind) && (r.status === "PENDING" || r.status === "APPROVED"));
  const cells = Array.from({ length: Math.ceil((lead + dim) / 7) * 7 }, (_, i) => i - lead + 1);
  return (
    <div className="card p-3">
      <div className="mb-2 flex items-center justify-between text-[13px]">
        <button className="btn" onClick={() => setM(new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() - 1, 1)))}>Prev</button>
        <span className="font-medium">{m.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</span>
        <button className="btn" onClick={() => setM(new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1)))}>Next</button>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-line bg-line text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="bg-muted px-1 py-1 text-center text-soft">{d}</div>)}
        {cells.map((n, i) => {
          if (n < 1 || n > dim) return <div key={i} className="min-h-16 bg-surface" />;
          const t = first + (n - 1) * DAY;
          const here = leave.filter((r) => { const [a, b] = span(r); return !isNaN(a) && a <= t && b >= t; });
          return (
            <div key={i} className={`min-h-16 bg-surface p-1 ${here.length > 1 ? "bg-amber-50 dark:bg-amber-950" : ""}`}>
              <div className="mono text-soft">{n}</div>
              {here.slice(0, 3).map((r) => <div key={r.id} className={`truncate rounded px-1 ${r.status === "APPROVED" ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100" : "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100"}`} title={`${r.employee} (${r.status.toLowerCase()})`}>{r.employee.split(" ").slice(1).join(" ") || r.employee}</div>)}
              {here.length > 3 && <div className="text-soft">+{here.length - 3} more</div>}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-soft">Green is approved, yellow is waiting. Shaded days have more than one person off.</p>
    </div>
  );
}
const TONE: Record<string, string> = { PENDING: "PENDING", APPROVED: "PASSED", DENIED: "FAILED", WITHDRAWN: "LOA" };

export type ProfileChange = { id: string; employee: string; changes: Record<string, string>; at: string };

function ProfileQueue({ items }: { items: ProfileChange[] }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  if (!items.length) return null;
  return (
    <section className="card mb-4 p-4 text-[13px]">
      <h2 className="mb-2 text-sm font-semibold">Profile update requests</h2>
      <div className="divide-y divide-line">{items.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center gap-3 py-2">
          <span className="font-medium">{c.employee}</span>
          <span className="mono text-xs text-soft">{Object.entries(c.changes).map(([k, v]) => `${k}: ${v}`).join(" · ")}</span>
          <span className="ml-auto flex gap-2">{(["APPROVED", "DENIED"] as const).map((d) => <button key={d} className="btn" disabled={pending} onClick={() => exec(() => decideProfileChangeAction(c.id, { decision: d, note: "" }), { success: d === "APPROVED" ? "Applied" : "Denied", onOk: () => router.refresh() })}>{d === "APPROVED" ? "Approve" : "Deny"}</button>)}</span>
        </div>))}</div>
    </section>
  );
}

export function Requests({ rows, canDecide, isAdmin, profileChanges = [] }: { rows: Row[]; canDecide: boolean; isAdmin: boolean; profileChanges?: ProfileChange[] }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [status, setStatus] = useState("PENDING");
  const [view, setView] = useState<"list" | "calendar">("list");
  const [sel, setSel] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const shown = useMemo(() => rows.filter((r) => !status || r.status === status), [rows, status]);
  const cur = rows.find((r) => r.id === sel) ?? null;
  const pendingCount = rows.filter((r) => r.status === "PENDING").length;
  const decide = (decision: "APPROVED" | "DENIED") => cur && exec(() => decideStaffRequestAction(cur.id, { decision, note }), { success: decision === "APPROVED" ? "Approved. The employee was notified." : "Denied. The employee was notified.", onOk: () => { setSel(null); setNote(""); router.refresh(); } });
  return (
    <>
      {canDecide && <ProfileQueue items={profileChanges} />}
      <PageHeader title="Staff requests" sub={`${pendingCount} waiting. Leave of absence, retirement and resignation requests from employees.`} />
      <div className="mb-3"><select className="input !w-44" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option>{["PENDING", "APPROVED", "DENIED", "WITHDRAWN"].map((s) => <option key={s}>{s}</option>)}</select></div>
      <div className="mb-3 flex gap-2"><button className={`btn ${view === "list" ? "!border-accent text-accent" : ""}`} onClick={() => setView("list")}>List</button><button className={`btn ${view === "calendar" ? "!border-accent text-accent" : ""}`} onClick={() => setView("calendar")}>Calendar</button></div>
      {view === "calendar" ? <LeaveCalendar rows={rows} /> : shown.length === 0 ? <Empty title="No requests here" hint="Employees send these from My Portal." /> : (
        <div className="card max-h-[72vh] overflow-auto"><table className="w-full min-w-[760px] border-collapse"><thead><tr>{["Employee", "Request", "Dates", "Status", "Received"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>{shown.map((r) => (
            <tr key={r.id} className="cursor-pointer hover:bg-muted" onClick={() => { setSel(r.id); setNote(r.note); }}>
              <td className="td"><div className="font-medium">{r.employee}</div><div className="text-xs text-soft">{r.department ?? "No department"}</div></td><td className="td">{KIND[r.kind]}</td>
              <td className="td mono text-xs">{isLeave(r.kind) ? `${fmtDate(r.start)} → ${r.end ? fmtDate(r.end) : "open"}` : `last day ${fmtDate(r.end)}`}{r.status === "PENDING" && isLeave(r.kind) && overlapping(r, rows).length > 0 && <span className="ml-2 rounded bg-amber-100 px-1 text-amber-900 dark:bg-amber-900 dark:text-amber-100">overlap</span>}</td>
              <td className="td"><Badge value={TONE[r.status]} label={r.status} /></td><td className="td mono text-xs">{fmtDateTime(r.at)}</td>
            </tr>))}</tbody></table></div>
      )}
      <Drawer open={!!cur} onClose={() => setSel(null)} title={cur ? KIND[cur.kind] : ""}>
        {cur && (
          <div className="space-y-4 text-[13px]">
            <div className="flex items-center gap-2"><Badge value={TONE[cur.status]} label={cur.status} /><Link className="text-accent" href={`/app/employee/${cur.employeeId}`}>{cur.employee}</Link></div>
            {isLeave(cur.kind) && cur.status === "PENDING" && overlapping(cur, rows).length > 0 && <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">Same days off in {cur.department ?? "this team"}: {overlapping(cur, rows).map((o) => `${o.employee} (${o.status.toLowerCase()})`).join(", ")}.</p>}
            <div className="grid grid-cols-2 gap-3"><div><div className="text-xs text-soft">{isLeave(cur.kind) ? "Starts" : "Last day"}</div><div className="mono">{fmtDate(isLeave(cur.kind) ? cur.start : cur.end)}</div></div>{isLeave(cur.kind) && <div><div className="text-xs text-soft">Returns</div><div className="mono">{cur.end ? fmtDate(cur.end) : "Not set"}</div></div>}</div>
            <div><div className="text-xs text-soft">Reason</div><p className="mt-0.5 whitespace-pre-wrap">{cur.reason}</p></div>
            {cur.status !== "PENDING" && <div className="rounded-md border border-line bg-muted p-3"><div className="text-xs text-soft">Decided by {cur.by} {fmtDateTime(cur.decidedAt)}</div>{cur.note || "No note."}</div>}
            {cur.status === "PENDING" && canDecide && (
              <div className="space-y-2 border-t border-line pt-4">
                {!isLeave(cur.kind) && !isAdmin && <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">Only an owner or admin can accept a {KIND[cur.kind].toLowerCase()}.</p>}
                <Field label="Note to the employee (required if denying)"><textarea className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
                <div className="flex gap-2"><button className="btn-primary" disabled={pending || (!isLeave(cur.kind) && !isAdmin)} onClick={() => decide("APPROVED")}>Approve</button><button className="btn" disabled={pending} onClick={() => decide("DENIED")}>Deny</button></div>
                <p className="text-xs text-soft">{isLeave(cur.kind) ? "Approving sets the employee to Leave of absence on the start date and back to Active after the return date." : "Approving records the separation. On the last day the employee is marked as separated and loses access."}</p>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
}
