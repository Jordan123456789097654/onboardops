"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Trash2 } from "lucide-react";
import { cancelAccountDeletionAction, createPersonalKeyAction, requestAccountDeletionAction, revokePersonalKeyAction, updatePreferencesAction } from "@/actions/account-extras";
import { Field, useAction } from "@/components/ui";
import { SCOPES, SCOPE_INFO, type Scope } from "@/lib/api-scopes";
import { fmtDate } from "@/lib/utils";

function Card({ title, sub, children, danger }: { title: string; sub?: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <section className={`card mt-5 p-5 ${danger ? "border-rose-300 dark:border-rose-900" : ""}`}>
      <h2 className={`text-sm font-semibold ${danger ? "text-rose-700 dark:text-rose-300" : ""}`}>{title}</h2>
      {sub && <p className="mt-0.5 text-[13px] text-soft">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export type PersonalKeyRow = { id: string; name: string; prefix: string; workspace: string; scopes: string[]; createdAt: string; lastUsedAt: string | null; expiresAt: string | null };
export type WorkspaceChoice = { id: string; name: string };

/* ---------------- Date and clock format ---------------- */

const DATE_OPTIONS = [
  { value: "", label: "Default (YYYY-MM-DD)" },
  { value: "YYYY-MM-DD", label: "2026-11-26" },
  { value: "MM/DD/YYYY", label: "11/26/2026" },
  { value: "DD/MM/YYYY", label: "26/11/2026" },
];

export function PreferencesCard({ dateFormat, clock24 }: { dateFormat: string | null; clock24: boolean | null }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [df, setDf] = useState(dateFormat ?? "");
  const [h24, setH24] = useState(clock24 === null ? "default" : clock24 ? "24" : "12");
  const changed = df !== (dateFormat ?? "") || h24 !== (clock24 === null ? "default" : clock24 ? "24" : "12");
  return (
    <Card title="Date and time format" sub="How dates and times are shown to you. Other people see their own formats.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date format">
          <select className="input" value={df} onChange={(e) => setDf(e.target.value)}>
            {DATE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Clock">
          <select className="input" value={h24} onChange={(e) => setH24(e.target.value)}>
            <option value="default">Default (12-hour)</option>
            <option value="12">12-hour (2:30 PM)</option>
            <option value="24">24-hour (14:30)</option>
          </select>
        </Field>
      </div>
      <button
        className="btn-primary mt-4"
        disabled={pending || !changed}
        onClick={() => exec(() => updatePreferencesAction({ dateFormat: (df || null) as "YYYY-MM-DD" | "MM/DD/YYYY" | "DD/MM/YYYY" | null, clock24: h24 === "default" ? null : h24 === "24" }), { success: "Format saved", onOk: () => router.refresh() })}
      >
        Save format
      </button>
    </Card>
  );
}

/* ---------------- Personal API keys ---------------- */

export function PersonalKeysCard({ keys, workspaces }: { keys: PersonalKeyRow[]; workspaces: WorkspaceChoice[] }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [name, setName] = useState("");
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [scopes, setScopes] = useState<Scope[]>(["employees:read", "shifts:read"]);
  const [expires, setExpires] = useState("");
  const [shown, setShown] = useState<string | null>(null);
  const toggle = (s: Scope) => setScopes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  if (workspaces.length === 0) {
    return <Card title="Personal API keys" sub="Keys that act as you, in one workspace you belong to."><p className="text-[13px] text-soft">Join a workplace first. You can create personal keys once you belong to one.</p></Card>;
  }

  return (
    <Card title="Personal API keys" sub="A key that acts as you in one workspace. It can do only what your role there allows, and it stops working if you leave or your role changes. Up to 5.">
      {shown && (
        <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-[13px] dark:border-emerald-900 dark:bg-emerald-950">
          <p className="font-medium">Copy your new key now. It is shown only once.</p>
          <code className="mono mt-2 block break-all text-[12px]">{shown}</code>
          <button className="btn mt-2" onClick={() => setShown(null)}>I&apos;ve copied it</button>
        </div>
      )}
      {keys.length > 0 && (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {keys.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-[13px]">
              <KeyRound className="h-4 w-4 text-soft" />
              <span className="font-medium">{k.name}</span>
              <span className="text-soft">· {k.workspace}</span>
              <span className="mono text-[12px] text-soft">{k.prefix}…</span>
              <span className="text-soft">· {k.scopes.join(", ")}</span>
              <span className="text-soft">· created {fmtDate(k.createdAt)}{k.lastUsedAt ? `, last used ${fmtDate(k.lastUsedAt)}` : ", never used"}{k.expiresAt ? `, expires ${fmtDate(k.expiresAt)}` : ""}</span>
              <button className="btn-danger ml-auto !h-7 !px-2 !text-[12px]" disabled={pending} onClick={() => { if (confirm(`Revoke "${k.name}"? It stops working immediately.`)) exec(() => revokePersonalKeyAction(k.id), { success: "Key revoked", onOk: () => router.refresh() }); }}>Revoke</button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Name"><input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Payroll sync" /></Field>
        <Field label="Workspace">
          <select className="input" value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)}>
            {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </Field>
      </div>
      <div className="mt-4">
        <div className="text-xs font-medium text-soft">Permissions (tick only what the system needs)</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {SCOPES.map((s) => (
            <label key={s} className="flex items-start gap-2 text-[13px]">
              <input type="checkbox" className="mt-1" checked={scopes.includes(s)} onChange={() => toggle(s)} />
              <span><span className="font-medium">{SCOPE_INFO[s].label}</span><span className="block text-xs text-soft">{SCOPE_INFO[s].hint}</span></span>
            </label>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Expires after (days, optional)"><input className="input" type="number" min={1} max={3650} value={expires} onChange={(e) => setExpires(e.target.value)} placeholder="Never" /></Field>
      </div>
      <button
        className="btn-primary mt-4"
        disabled={pending || name.trim().length < 2 || scopes.length === 0 || !workspaceId}
        onClick={() => exec(() => createPersonalKeyAction({ name, workspaceId, scopes, expiresInDays: expires ? Number(expires) : null }), { success: "Key created", onOk: (r) => { setShown((r as { key: string }).key); setName(""); router.refresh(); } })}
      >
        Create personal key
      </button>
    </Card>
  );
}

/* ---------------- Delete my account ---------------- */

export function DeleteAccountCard({ email, scheduledFor }: { email: string; scheduledFor: string | null }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");

  if (scheduledFor) {
    return (
      <Card title="Account deletion scheduled" danger sub={`Your account will be permanently deleted on ${scheduledFor}. Until then nothing has changed, and you can cancel below.`}>
        <button className="btn" disabled={pending} onClick={() => exec(() => cancelAccountDeletionAction(), { success: "Deletion cancelled. Your account is kept.", onOk: () => router.refresh() })}>Cancel deletion</button>
      </Card>
    );
  }

  return (
    <Card title="Delete my account" danger sub="This is permanent after a 14-day grace period. You can cancel during those 14 days.">
      {!open ? (
        <button className="btn-danger" onClick={() => setOpen(true)}><Trash2 className="h-4 w-4" />Delete my account…</button>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-[13px] text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
            <p className="font-semibold">Before you continue, know that:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Your sign-in details, sessions, passkeys, connected accounts and personal API keys are removed.</li>
              <li>You are removed from every workspace. Records your employer keeps (training, audit history) stay with them.</li>
              <li>If you are the only owner of a workspace, you must make someone else an owner first.</li>
              <li>After 14 days this cannot be undone. You will get an email on the day it happens.</li>
            </ul>
          </div>
          <Field label="Your password"><input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <Field label={`Type ${email} to confirm`}><input className="input" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} autoComplete="off" /></Field>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-danger"
              disabled={pending || !password || confirmEmail.trim().toLowerCase() !== email.toLowerCase()}
              onClick={() => exec(() => requestAccountDeletionAction({ password, confirmEmail }), { success: "Deletion scheduled. We emailed you the date.", onOk: () => router.refresh() })}
            >
              {pending ? "Scheduling…" : "Schedule deletion"}
            </button>
            <button className="btn" onClick={() => setOpen(false)}>Keep my account</button>
          </div>
        </div>
      )}
    </Card>
  );
}
