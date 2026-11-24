"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { banUserAction, decideAppealAction, unbanUserAction, warnUserAction } from "@/actions/moderation";
import { Field, useAction, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";

export type AccountRow = { id: string; name: string; email: string; banned: boolean; banReason: string; createdAt: string };
export type WorkspaceRow = { id: string; name: string; slug: string; suspended: boolean; reason: string };
export type AppealRow = { id: string; email: string; message: string; createdAt: string; action: string; targetType: string; caseReason: string };
export type CaseRow = { id: string; action: string; targetType: string; reason: string; actorName: string; at: string };

const ACTION_LABEL: Record<string, string> = { BAN: "Banned", UNBAN: "Unbanned", WARN: "Warned", SUSPEND: "Suspended", UNSUSPEND: "Reinstated" };

/** Moderation controls. Bans and restores are owner-only on the server, so those buttons are hidden for other staff too. */
export function ModerationPanel({ canBan, accounts, workspaces, appeals, log }: { canBan: boolean; accounts: AccountRow[]; workspaces: WorkspaceRow[]; appeals: AppealRow[]; log: CaseRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();
  const [target, setTarget] = useState<{ kind: "ban" | "unban" | "warn"; id: string; name: string } | null>(null);
  const [reason, setReason] = useState("");
  const [decision, setDecision] = useState<{ id: string; overturn: boolean } | null>(null);
  const [note, setNote] = useState("");

  function submit() {
    if (!target) return;
    const input = { userId: target.id, reason };
    const fn = target.kind === "ban" ? banUserAction : target.kind === "unban" ? unbanUserAction : warnUserAction;
    exec(() => fn(input), {
      onOk: () => {
        toast("ok", target.kind === "ban" ? "Account banned. Their sessions have ended." : target.kind === "unban" ? "Account restored." : "Warning sent.");
        setTarget(null);
        setReason("");
        router.refresh();
      },
    });
  }

  function decide() {
    if (!decision) return;
    exec(() => decideAppealAction({ appealId: decision.id, overturn: decision.overturn, note }), {
      onOk: () => {
        toast("ok", decision.overturn ? "Appeal overturned and access restored." : "Appeal upheld.");
        setDecision(null);
        setNote("");
        router.refresh();
      },
    });
  }

  return (
    <div className="space-y-6">
      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold">Appeals waiting for a decision ({appeals.length})</h2>
        {appeals.length === 0 && <p className="text-[13px] text-soft">No appeals are waiting.</p>}
        <ul className="divide-y divide-line">
          {appeals.map((a) => (
            <li key={a.id} className="py-3 text-[13px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{a.email}</span>
                <span className="text-soft">{a.targetType === "USER" ? "Account" : "Workspace"} {a.action === "BAN" ? "ban" : "suspension"} · {new Date(a.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="mt-1 text-soft">Original reason: {a.caseReason}</p>
              <p className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-2.5">{a.message}</p>
              {canBan && (decision?.id === a.id ? (
                <div className="mt-2 space-y-2">
                  <Field label={decision.overturn ? "Why is the decision reversed?" : "Why is the decision upheld?"}>
                    <textarea className="textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
                  </Field>
                  <div className="flex gap-2">
                    <button className="btn-primary" disabled={pending || note.trim().length < 10} onClick={decide}>{pending ? "Saving…" : "Confirm decision"}</button>
                    <button className="btn" onClick={() => setDecision(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex gap-2">
                  <button className="btn" onClick={() => setDecision({ id: a.id, overturn: true })}>Overturn</button>
                  <button className="btn" onClick={() => setDecision({ id: a.id, overturn: false })}>Uphold</button>
                </div>
              ))}
            </li>
          ))}
        </ul>
      </section>

      {target && (
        <section className="card border-accent/50 p-4">
          <h2 className="text-sm font-semibold">{target.kind === "ban" ? "Ban" : target.kind === "unban" ? "Restore" : "Warn"} {target.name}</h2>
          <p className="mt-1 text-[12.5px] text-soft">
            The reason is emailed to them{target.kind === "ban" ? ", and every session they have ends immediately" : ""}. Write it so they can understand it and appeal.
          </p>
          <div className="mt-3 space-y-2">
            <Field label="Reason (10+ characters)">
              <textarea className="textarea" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
            </Field>
            <div className="flex gap-2">
              <button className={cn(target.kind === "ban" ? "btn text-rose-700" : "btn-primary")} disabled={pending || reason.trim().length < 10} onClick={submit}>
                {pending ? "Saving…" : target.kind === "ban" ? "Ban account" : target.kind === "unban" ? "Restore account" : "Send warning"}
              </button>
              <button className="btn" onClick={() => { setTarget(null); setReason(""); }}>Cancel</button>
            </div>
          </div>
        </section>
      )}

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold">Accounts</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="text-left text-soft">
              <tr><th className="py-2 font-medium">Name</th><th className="font-medium">Email</th><th className="font-medium">Status</th><th className="font-medium">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td className="py-2">{a.name}</td>
                  <td>{a.email}</td>
                  <td>{a.banned ? <span className="text-rose-700">Banned: {a.banReason}</span> : "Active"}</td>
                  <td className="space-x-2 whitespace-nowrap py-1">
                    <button className="text-accent underline" onClick={() => setTarget({ kind: "warn", id: a.id, name: a.name })}>Warn</button>
                    {canBan && (a.banned
                      ? <button className="text-accent underline" onClick={() => setTarget({ kind: "unban", id: a.id, name: a.name })}>Restore</button>
                      : <button className="text-rose-700 underline" onClick={() => setTarget({ kind: "ban", id: a.id, name: a.name })}>Ban</button>)}
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && <tr><td colSpan={4} className="py-3 text-soft">No accounts match.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold">Workspaces</h2>
        <ul className="divide-y divide-line text-[13px]">
          {workspaces.map((w) => (
            <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <span className="font-medium">{w.name}</span> <span className="text-soft">{w.slug}</span>
                {w.suspended && <span className="ml-2 text-rose-700">Suspended: {w.reason}</span>}
              </span>
              <Link className="text-accent underline" href={`/admin/workspaces/${w.id}`}>Open to suspend or reinstate</Link>
            </li>
          ))}
          {workspaces.length === 0 && <li className="py-2 text-soft">No workspaces match.</li>}
        </ul>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold">Recent moderation actions</h2>
        <ul className="divide-y divide-line text-[12.5px]">
          {log.map((c) => (
            <li key={c.id} className="py-2">
              <span className="font-medium">{ACTION_LABEL[c.action] ?? c.action}</span>{" "}
              <span className="text-soft">{c.targetType === "USER" ? "account" : "workspace"} · {c.actorName} · {c.at}</span>
              <p className="text-soft">{c.reason}</p>
            </li>
          ))}
          {log.length === 0 && <li className="py-2 text-soft">No actions yet.</li>}
        </ul>
      </section>
    </div>
  );
}
