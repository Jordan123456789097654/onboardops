"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteAccountDataAction, updateRequestAction } from "@/actions/admin";
import { Badge, Empty, Modal, PageHeader, useAction } from "@/components/ui";
import { fmtDate } from "@/lib/utils";

type Row = { id: string; ref: string; name: string; email: string; message: string; status: string; at: string; due: string; replies: number };

export function Privacy({ rows, isOwner }: { rows: Row[]; isOwner: boolean }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [del, setDel] = useState<Row | null>(null);
  const [typed, setTyped] = useState("");
  const left = (due: string) => Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
  return (
    <>
      <PageHeader title="Privacy requests" sub="Access and deletion requests about account and website data. The response deadline is 45 days from receipt (extendable once). Employees asking about employer-held records should be pointed to their employer." />
      {rows.length === 0 ? <Empty title="No privacy requests" hint="They arrive from the contact form with the topic Privacy request." /> : (
        <div className="space-y-3">
          {rows.map((r) => {
            const d = left(r.due);
            return (
              <div key={r.id} className="card p-4 text-[13px]">
                <div className="flex flex-wrap items-center gap-2"><span className="mono font-medium">{r.ref}</span><span>{r.name}</span><span className="mono text-xs text-soft">{r.email}</span>
                  <span className="ml-auto flex items-center gap-2">{r.status === "SOLVED" ? <Badge value="PASSED" label="Done" /> : <Badge value={d < 0 ? "FAILED" : d <= 10 ? "PENDING" : "IN_PROGRESS"} label={d < 0 ? `${-d} days overdue` : `${d} days left`} />}<span className="mono text-xs text-soft">due {fmtDate(r.due)}</span></span></div>
                <p className="mt-2 whitespace-pre-wrap text-soft">{r.message}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a className="btn" href={`/api/admin/privacy-export?email=${encodeURIComponent(r.email)}`}>Export account data</a>
                  <Link className="btn" href={`/admin/inbox?open=${r.id}`}>Open thread ({r.replies} replies)</Link>
                  {r.status !== "SOLVED" && <button className="btn" disabled={pending} onClick={() => exec(() => updateRequestAction(r.id, { status: "SOLVED" }), { success: "Marked done", onOk: () => router.refresh() })}>Mark done</button>}
                  {isOwner && r.status !== "SOLVED" && <button className="btn-danger" onClick={() => { setDel(r); setTyped(""); }}>Delete account data…</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete account data">
        {del && (
          <div className="space-y-3 text-[13px]">
            <p className="rounded-md border border-rose-300 bg-rose-50 p-3 text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">Deletes the login, memberships, sign-in tokens, support messages and email log entries for <b>{del.email}</b>. Employee records held by employers are unlinked, not deleted. Sole workspace owners are blocked. This cannot be undone, and the person is emailed a confirmation.</p>
            <label className="block"><span className="label">Type the email to confirm</span><input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={del.email} /></label>
            <button className="btn-danger w-full" disabled={pending || typed.toLowerCase() !== del.email.toLowerCase()} onClick={() => exec(() => deleteAccountDataAction({ email: del.email, requestId: del.id, confirm: true }), { success: "Account data deleted", onOk: () => { setDel(null); router.refresh(); } })}>Delete permanently</button>
          </div>
        )}
      </Modal>
    </>
  );
}
