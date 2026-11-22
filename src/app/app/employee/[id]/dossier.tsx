"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { assignEmployeeRoleAction } from "@/actions/access";
import { changeStatusAction, grantPortalAccessAction, sendAccessLinkAction, updateEmployeeAction } from "@/actions/employees";
import { CustomValues, TimeOffBalances, type CField } from "./custom-values";
import { DocumentsPanel, ReviewsPanel, type Doc, type Rev } from "./extras";
import { Badge, Empty, Field, Modal, PageHeader, Tabs, useAction } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/utils";

type Opt = { id: string; name: string };
type Emp = {
  id: string; staffCode: string; fullName: string; email: string; phone: string | null; emergencyContact: string | null; departmentId: string | null; jobRoleId: string | null;
  department: string | null; jobRole: string | null; status: string; readiness: string; strikePoints: number; hireDate: string; shiftAvailability: Record<string, string>; hasLogin: boolean; memberRole: string | null;
  enrollments: { id: string; course: string; status: string; bestScore: number | null; attempts: number; cert: string | null; completedAt: string | null; due: string | null; reason: string }[];
  infractions: { id: string; caseNumber: string; severity: string; points: number; policy: string; summary: string; createdAt: string; acknowledged: boolean; issuedBy: string; confidential: string; timeline: { id: string; type: string; note: string; actor: string; at: string; confidential: boolean }[] }[];
  checklists: { id: string; title: string; at: string; verified: boolean }[];
  audit: { id: string; at: string; actor: string; summary: string; hash: string }[];
  documents: Doc[];
  reviews: Rev[];
};

export function Dossier({ emp, departments, roles, perms, fields = [], customValues = {}, balances = [] }: { balances?: { type: string; allowance: number; used: number; pending: number }[]; fields?: CField[]; customValues?: Record<string, string>; emp: Emp; departments: Opt[]; roles: Opt[]; perms: { manage: boolean; admin: boolean; owner: boolean } }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [tab, setTab] = useState("overview");
  const [statusOpen, setStatusOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [status, setStatus] = useState(emp.status);
  const [reason, setReason] = useState("");
  const [pw, setPw] = useState("");
  const [grantRole, setGrantRole] = useState<"EMPLOYEE" | "SUPERVISOR" | "MANAGER" | "ADMIN">("EMPLOYEE");
  const [link, setLink] = useState<{ url: string; emailed: boolean } | null>(null);
  const [f, setF] = useState({ fullName: emp.fullName, email: emp.email, phone: emp.phone ?? "", emergencyContact: emp.emergencyContact ?? "", departmentId: emp.departmentId ?? "", jobRoleId: emp.jobRoleId ?? "", hireDate: emp.hireDate.slice(0, 10) });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const refresh = () => router.refresh();

  const tabs = [{ id: "overview", label: "Overview & Shifts" }, { id: "training", label: "Training & Certificates" }, { id: "infractions", label: "Infractions & Discipline" }, ...(perms.manage ? [{ id: "documents", label: "Documents" }, { id: "reviews", label: "Reviews & 1:1s" }] : []), { id: "audit", label: "Immutable Audit Trail" }];

  return (
    <>
      <PageHeader title={emp.fullName} sub={`${emp.jobRole ?? "No job role"} · ${emp.department ?? "No department"}`}>
        <Link href={`/print/dossier/${emp.id}`} target="_blank" className="btn">Export Printable PDF Dossier</Link>
        {perms.manage && <button className="btn" onClick={() => setEditOpen(true)}>Edit</button>}
        {perms.manage && <button className="btn-primary" onClick={() => setStatusOpen(true)}>Change Status</button>}
      </PageHeader>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="mono text-[13px]">{emp.staffCode}</span><Badge value={emp.status} /><Badge value={emp.readiness} /><span className="mono text-[13px]">{emp.strikePoints} strike pts</span>
      </div>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      <div className="mt-4">
        {tab === "overview" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card divide-y divide-line text-[13px]">
              {[["Email", emp.email], ["Phone", emp.phone ?? "—"], ["Emergency contact", emp.emergencyContact ?? "—"], ["Hire date", fmtDate(emp.hireDate)]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-3 py-2"><span className="text-soft">{k}</span><span className="mono text-right">{v}</span></div>
              ))}
              <div className="flex items-center justify-between gap-4 px-3 py-2">
                <span className="text-soft">Workspace access role</span>
                {emp.memberRole === "OWNER" ? (
                  <Badge value="ACTIVE" label="OWNER" />
                ) : perms.manage ? (
                  <select
                    className="input !h-7 !w-44 !text-xs font-medium"
                    value={emp.memberRole ?? ""}
                    disabled={pending}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (!next) return;
                      exec(() => assignEmployeeRoleAction(emp.id, next), {
                        success: `Role updated to ${next}`,
                        onOk: (res) => {
                          if (res.invited && res.link) setLink({ url: res.link, emailed: !!res.emailed });
                          refresh();
                        },
                      });
                    }}
                  >
                    {!emp.hasLogin && <option value="">Assign role &amp; invite…</option>}
                    {["EMPLOYEE", "SUPERVISOR", "MANAGER", ...(perms.admin ? ["ADMIN"] : [])].map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                ) : (
                  <span className="mono">{emp.memberRole ?? "None"}</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-4 px-3 py-2"><span className="text-soft">Sign-in access</span>{emp.hasLogin ? <span className="flex items-center gap-2">Enabled{perms.manage && <button className="btn" onClick={() => exec(() => sendAccessLinkAction(emp.id), { onOk: (r) => setLink({ url: r.inviteUrl, emailed: r.emailed }) })}>Send set-password link</button>}</span> : perms.manage ? <button className="btn" onClick={() => setAccessOpen(true)}>Grant access</button> : <span>None</span>}</div>
            </div>
            <div className="space-y-4">
              <div className="card p-3 text-[13px]">
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-soft">Shift availability</h3>
                {Object.keys(emp.shiftAvailability).length === 0 ? <p className="text-soft">Not set.</p> : Object.entries(emp.shiftAvailability).map(([d, v]) => <div key={d} className="flex justify-between py-0.5"><span className="uppercase text-soft">{d}</span><span className="mono">{v}</span></div>)}
              </div>
              <div className="card p-3 text-[13px]">
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-soft">Recent checklists</h3>
                {emp.checklists.length === 0 ? <p className="text-soft">None submitted.</p> : emp.checklists.map((c) => <div key={c.id} className="flex items-center justify-between py-0.5"><span>{c.title}</span><span className="mono text-xs text-soft">{fmtDateTime(c.at)} {c.verified ? "· verified" : ""}</span></div>)}
              </div>
            </div>
          </div>
        )}
        {tab === "overview" && balances.length > 0 && <TimeOffBalances employeeId={emp.id} balances={balances} canEdit={perms.manage} />}
        {tab === "overview" && <CustomValues employeeId={emp.id} fields={fields} values={customValues} canEdit={perms.manage} />}
        {tab === "training" && (emp.enrollments.length === 0 ? <Empty title="No courses assigned" hint="Assign a job role with required courses, or assign a course from the Training Academy." /> : (
          <div className="card overflow-x-auto"><table className="w-full min-w-[720px] border-collapse"><thead><tr>{["Course", "Status", "Best", "Attempts", "Certificate", "Due", "Why assigned"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>{emp.enrollments.map((e) => (
              <tr key={e.id} className="hover:bg-muted"><td className="td font-medium">{e.course}</td><td className="td"><Badge value={e.status} /></td><td className="td mono">{e.bestScore != null ? `${e.bestScore}%` : "—"}</td><td className="td mono">{e.attempts}</td>
                <td className="td mono">{e.cert ? <Link className="text-accent" target="_blank" href={`/print/certificate/${e.id}`}>{e.cert}</Link> : "—"}</td><td className="td mono">{fmtDate(e.due)}</td><td className="td text-soft">{e.reason}</td></tr>
            ))}</tbody></table></div>
        ))}
        {tab === "infractions" && (emp.infractions.length === 0 ? <Empty title="No infractions on file" /> : (
          <div className="space-y-3">{emp.infractions.map((c) => (
            <div key={c.id} className="card p-3 text-[13px]">
              <div className="flex flex-wrap items-center gap-2"><span className="mono font-medium">{c.caseNumber}</span><Badge value={c.severity} /><span className="mono">+{c.points} pts</span><span className="mono text-xs text-soft">{fmtDate(c.createdAt)}</span>
                <span className="ml-auto">{c.acknowledged ? <Badge value="ACTIVE" label="Acknowledged" /> : <Badge value="PENDING" label="Awaiting signature" />}</span></div>
              <p className="mt-2 font-medium">{c.policy}</p><p className="text-soft">{c.summary}</p><p className="mt-1 text-xs text-soft">Issued by {c.issuedBy}</p>
              {c.confidential && <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"><span className="mono text-[11px] uppercase">Confidential</span><br />{c.confidential}</p>}
              <ol className="mt-3 space-y-1 border-l border-line pl-3">{c.timeline.map((t) => <li key={t.id} className="text-xs"><span className="mono text-soft">{fmtDateTime(t.at)}</span> · {t.actor}: {t.note}{t.confidential ? " (confidential)" : ""}</li>)}</ol>
            </div>
          ))}</div>
        ))}
        {tab === "documents" && perms.manage && <DocumentsPanel employeeId={emp.id} docs={emp.documents} isAdmin={perms.admin} />}
        {tab === "reviews" && perms.manage && <ReviewsPanel employeeId={emp.id} reviews={emp.reviews} />}
        {tab === "audit" && (perms.admin ? (emp.audit.length === 0 ? <Empty title="No audit entries yet" /> : (
          <div className="card divide-y divide-line">{emp.audit.map((a) => <div key={a.id} className="px-3 py-2 text-[13px]"><div className="flex flex-wrap gap-x-3"><span className="mono text-xs text-soft">{fmtDateTime(a.at)}</span><span className="text-xs text-soft">{a.actor}</span></div><div>{a.summary}</div><div className="mono text-[11px] text-soft">sha256:{a.hash.slice(0, 24)}…</div></div>)}</div>
        )) : <Empty title="Audit trail is limited to owners and admins" />)}
      </div>

      <Modal open={statusOpen} onClose={() => setStatusOpen(false)} title="Change status">
        <div className="space-y-3">
          <Field label="New status"><select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>{["ONBOARDING", "ACTIVE", "LOA", "SUSPENDED", ...(perms.admin ? ["TERMINATED"] : [])].map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Reason (recorded in the audit log)"><textarea className="textarea" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <button className="btn-primary w-full" disabled={pending} onClick={() => exec(() => changeStatusAction(emp.id, { status, reason }), { success: "Status updated", onOk: () => { setStatusOpen(false); setReason(""); refresh(); } })}>Save status</button>
        </div>
      </Modal>
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit employee">
        <div className="space-y-3">
          <Field label="Full name"><input className="input" value={f.fullName} onChange={set("fullName")} /></Field>
          <Field label="Email"><input className="input" value={f.email} onChange={set("email")} /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Phone"><input className="input" value={f.phone} onChange={set("phone")} /></Field><Field label="Emergency contact"><input className="input" value={f.emergencyContact} onChange={set("emergencyContact")} /></Field></div>
          <Field label="Department"><select className="input" value={f.departmentId} onChange={set("departmentId")}><option value="">None</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <Field label="Job role (changing it assigns that role's required courses)"><select className="input" value={f.jobRoleId} onChange={set("jobRoleId")}><option value="">None</option>{roles.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <button className="btn-primary w-full" disabled={pending} onClick={() => exec(() => updateEmployeeAction(emp.id, f), { success: "Employee updated", onOk: () => { setEditOpen(false); refresh(); } })}>Save changes</button>
        </div>
      </Modal>
      <Modal open={accessOpen} onClose={() => { setAccessOpen(false); setLink(null); }} title="Grant sign-in access">
        {link ? (
          <div className="space-y-3 text-[13px]">
            <p>{link.emailed ? `We emailed ${emp.email} a link to set a password.` : "Email is not configured, so no message was sent. Share this link with the employee directly."} It works once and expires in 7 days.</p>
            <div className="break-all rounded-md border border-line bg-muted p-2 mono text-xs">{link.url}</div>
            <button className="btn w-full" onClick={() => { navigator.clipboard?.writeText(link.url); }}>Copy link</button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[13px] text-soft">Creates a login for {emp.email} and sends them a link to choose their own password. Or set a temporary password yourself below.</p>
            <Field label="Access role">
              <select className="input" value={grantRole} onChange={(e) => setGrantRole(e.target.value as any)}>
                {["EMPLOYEE", "SUPERVISOR", "MANAGER", ...(perms.admin ? ["ADMIN"] : [])].map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </Field>
            <Field label="Temporary password (optional, 8+ characters)"><input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Leave blank to send an invite link" /></Field>
            <button className="btn-primary w-full" disabled={pending} onClick={() => exec(() => grantPortalAccessAction(emp.id, { password: pw, role: grantRole }), { success: "Access granted", onOk: (r) => { setPw(""); if (r.inviteUrl) setLink({ url: r.inviteUrl, emailed: r.emailed }); else setAccessOpen(false); refresh(); } })}>{pw ? "Grant access with this password" : "Grant access and send invite"}</button>
          </div>
        )}
      </Modal>
    </>
  );
}
