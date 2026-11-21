"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { assignEmployeeRoleAction, bulkInviteAction } from "@/actions/access";
import { sendAccessLinkAction } from "@/actions/employees";
import { Badge, Modal, PageHeader, useAction, useToast } from "@/components/ui";
import type { InviteOutcome } from "@/lib/invites";

type Row = { id: string; name: string; email: string; code: string; dept: string | null; hasLogin: boolean; role: string | null; verified: boolean };
const ROLES = ["EMPLOYEE", "SUPERVISOR", "MANAGER", "ADMIN"] as const;

export function Access({ rows, signInUrl }: { rows: Row[]; signInUrl: string }) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();
  const [sel, setSel] = useState<string[]>([]);
  const [bulkRole, setBulkRole] = useState<"EMPLOYEE" | "SUPERVISOR" | "MANAGER" | "ADMIN">("EMPLOYEE");
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [result, setResult] = useState<InviteOutcome[] | null>(null);
  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!q || (r.name + r.email + r.code).toLowerCase().includes(q.toLowerCase())) &&
          (!roleFilter || (roleFilter === "NO_LOGIN" ? !r.hasLogin : r.role === roleFilter))
      ),
    [rows, q, roleFilter]
  );
  const without = shown.filter((r) => !r.hasLogin);
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const copy = (t: string) => { navigator.clipboard?.writeText(t); toast("ok", "Copied"); };
  const total = rows.length, active = rows.filter((r) => r.hasLogin).length;

  return (
    <>
      <PageHeader title="Staff accounts & roles" sub={`${active} of ${total} employees can sign in. Assign Manager, Supervisor, Admin or Employee roles in one click.`} />
      <div className="card mb-4 p-4 text-[13px]"><div className="font-medium">Your staff sign-in page</div><p className="mt-0.5 text-soft">Share this address. It shows your company name and signs employees into your workspace only.</p><div className="mt-2 flex flex-wrap items-center gap-2"><code className="mono rounded-md border border-line bg-muted px-2 py-1 text-xs">{signInUrl}</code><button className="btn" onClick={() => copy(signInUrl)}><Copy className="h-3.5 w-3.5" />Copy</button></div></div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="input !w-64" placeholder="Search name, email or ID" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input !w-44" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All roles</option>
          {["OWNER", ...ROLES].map((r) => <option key={r} value={r}>{r}</option>)}
          <option value="NO_LOGIN">No login yet</option>
        </select>
        <button className="btn" onClick={() => setSel(without.map((r) => r.id))}>Select everyone without access ({without.length})</button>
        {sel.length > 0 && <button className="btn" onClick={() => setSel([])}>Clear</button>}
        <div className="ml-auto flex items-center gap-2">
          <select className="input !w-40" value={bulkRole} onChange={(e) => setBulkRole(e.target.value as any)} aria-label="Role for bulk invite">
            {ROLES.map((r) => <option key={r} value={r}>Invite as {r}</option>)}
          </select>
          <button className="btn-primary" disabled={pending || sel.length === 0} onClick={() => exec(() => bulkInviteAction(sel, bulkRole), { onOk: (r) => { setResult(r); setSel([]); router.refresh(); } })}>{pending ? "Sending…" : `Send invites to ${sel.length}`}</button>
        </div>
      </div>
      <div className="card max-h-[68vh] overflow-auto">
        <table className="w-full min-w-[780px] border-collapse">
          <thead><tr><th className="th w-10" /><th className="th">Employee</th><th className="th">Department</th><th className="th">Sign-in</th><th className="th">Access role</th><th className="th" /></tr></thead>
          <tbody>{shown.map((r) => (
            <tr key={r.id} className="hover:bg-muted">
              <td className="td">{!r.hasLogin && <input type="checkbox" aria-label={`Select ${r.name}`} checked={sel.includes(r.id)} onChange={() => toggle(r.id)} />}</td>
              <td className="td"><div className="font-medium">{r.name} <span className="mono text-xs text-soft">{r.code}</span></div><div className="text-xs text-soft">{r.email}</div></td>
              <td className="td">{r.dept ?? "—"}</td>
              <td className="td">{r.hasLogin ? <span className="flex items-center gap-2"><Badge value="ACTIVE" label="Has access" />{!r.verified && <Badge value="PENDING" label="Not verified" />}</span> : <Badge value="LOA" label="No login yet" />}</td>
              <td className="td">
                {r.role === "OWNER" ? (
                  <Badge value="ACTIVE" label="OWNER" />
                ) : (
                  <select
                    className="input !h-7 !w-40 !text-xs font-medium"
                    value={r.role ?? ""}
                    disabled={pending}
                    onChange={(e) => {
                      const nextRole = e.target.value;
                      if (!nextRole) return;
                      exec(() => assignEmployeeRoleAction(r.id, nextRole), {
                        onOk: (res) => {
                          if (res.invited && res.link && !res.emailed) {
                            navigator.clipboard?.writeText(res.link);
                            toast("ok", `${r.name} assigned ${res.role}. Invite link copied to clipboard.`);
                          } else {
                            toast("ok", res.invited ? `${r.name} invited as ${res.role}` : `${r.name} updated to ${res.role}`);
                          }
                          router.refresh();
                        },
                      });
                    }}
                  >
                    {!r.hasLogin && <option value="">Assign role &amp; invite…</option>}
                    {ROLES.map((roleOpt) => (
                      <option key={roleOpt} value={roleOpt}>{roleOpt}</option>
                    ))}
                  </select>
                )}
              </td>
              <td className="td text-right">{r.hasLogin && <button className="btn" disabled={pending} onClick={() => exec(() => sendAccessLinkAction(r.id), { onOk: (x) => { if (!x.emailed) navigator.clipboard?.writeText(x.inviteUrl); toast("ok", x.emailed ? "Set-password link emailed" : "Email is not set up, so the link was copied to your clipboard. Share it privately."); } })}>Send new link</button>}</td>
            </tr>))}</tbody>
        </table>
      </div>
      <Modal open={!!result} onClose={() => setResult(null)} title="Invites sent">
        {result && (
          <div className="space-y-3 text-[13px]">
            <p>{result.filter((r) => r.result === "invited").length} invited, {result.filter((r) => r.result === "linked").length} linked to an existing account, {result.filter((r) => r.result === "skipped").length} skipped.</p>
            {result.some((r) => r.link && !r.emailed) && <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">Some emails could not be sent (email is not fully set up). Copy each person&apos;s link below and share it privately.</p>}
            <div className="max-h-64 divide-y divide-line overflow-y-auto rounded-md border border-line">{result.map((r) => (
              <div key={r.employeeId} className="flex items-center gap-2 px-2 py-1.5 text-xs"><span className="min-w-0 flex-1 truncate">{r.name} <span className="text-soft">{r.email}</span></span><span className="text-soft">{r.result === "skipped" ? r.reason : r.result}{r.result === "invited" && !r.emailed ? " (not emailed)" : ""}</span>{r.link && !r.emailed && <button className="btn !h-6 !px-2" onClick={() => copy(r.link!)}>Copy link</button>}</div>
            ))}</div>
            <button className="btn-primary w-full" onClick={() => setResult(null)}>Done</button>
          </div>
        )}
      </Modal>
    </>
  );
}
