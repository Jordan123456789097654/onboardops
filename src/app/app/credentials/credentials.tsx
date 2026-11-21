"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteCredentialAction, saveCredentialAction } from "@/actions/records";
import { Badge, Empty, Field, Modal, PageHeader, useAction } from "@/components/ui";
import { fmtDate } from "@/lib/utils";

type CredRow = { id: string; employee: string; name: string; number: string; issuer: string; expiresAt: string | null };

export function Credentials({ rows, employees }: { rows: CredRow[]; employees: { id: string; label: string }[] }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ employeeId: "", name: "", number: "", issuer: "", issuedAt: "", expiresAt: "", notes: "" });

  return (
    <>
      <PageHeader title="Credentials" sub="Licenses and certifications across all staff, sorted by expiry.">
        <button className="btn-primary" onClick={() => setOpen(true)}>Add credential</button>
      </PageHeader>
      {rows.length === 0 ? (
        <Empty title="No credentials yet" hint="Click 'Add credential' to track staff licenses and expiry dates." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse">
            <thead>
              <tr>
                {["Employee", "Credential", "Number", "Issuer", "Expires", ""].map((h) => (
                  <th key={h} className="th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const soon = c.expiresAt && new Date(c.expiresAt).getTime() < Date.now() + 30 * 86400000;
                return (
                  <tr key={c.id} className="hover:bg-muted">
                    <td className="td font-medium">{c.employee}</td>
                    <td className="td">{c.name}</td>
                    <td className="td mono">{c.number || "—"}</td>
                    <td className="td">{c.issuer || "—"}</td>
                    <td className="td mono">
                      {c.expiresAt ? (
                        soon ? <Badge value="RETRAINING_REQUIRED" label={`Expires ${fmtDate(c.expiresAt)}`} /> : fmtDate(c.expiresAt)
                      ) : (
                        "No expiry"
                      )}
                    </td>
                    <td className="td text-right">
                      <button
                        className="btn !px-2"
                        aria-label="Delete credential"
                        disabled={pending}
                        onClick={() => exec(() => deleteCredentialAction(c.id), { success: "Credential removed", onOk: () => router.refresh() })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add credential or license">
        <div className="space-y-3">
          <Field label="Employee">
            <select className="input" value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })}>
              <option value="">Select employee…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Credential / license name">
            <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Forklift Operator License" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="License number (optional)">
              <input className="input mono" value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} />
            </Field>
            <Field label="Issuer (optional)">
              <input className="input" value={f.issuer} onChange={(e) => setF({ ...f, issuer: e.target.value })} placeholder="OSHA / State Board" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Issued date (optional)">
              <input className="input mono" type="date" value={f.issuedAt} onChange={(e) => setF({ ...f, issuedAt: e.target.value })} />
            </Field>
            <Field label="Expires date (optional)">
              <input className="input mono" type="date" value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} />
            </Field>
          </div>
          <button
            className="btn-primary w-full"
            disabled={pending || !f.employeeId || !f.name.trim()}
            onClick={() =>
              exec(() => saveCredentialAction(f), {
                success: "Credential saved",
                onOk: () => {
                  setOpen(false);
                  setF({ employeeId: "", name: "", number: "", issuer: "", issuedAt: "", expiresAt: "", notes: "" });
                  router.refresh();
                },
              })
            }
          >
            Save credential
          </button>
        </div>
      </Modal>
    </>
  );
}
