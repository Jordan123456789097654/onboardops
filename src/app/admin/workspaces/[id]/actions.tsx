"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminConnectDomainAction, adminRemoveDomainAction, sendRecoveryLinkAction, startSupportAccessAction, suspendWorkspaceAction, transferOwnershipAction, unlockUserAction, unsuspendWorkspaceAction } from "@/actions/admin";
import { Badge, Field, Modal, useAction } from "@/components/ui";

type Member = { id: string; userId: string; name: string; email: string; role: string; locked: boolean };
type Dlg = null | "access" | "lock" | "transfer" | "domain";

export function WorkspaceActions({
  workspaceId,
  workspaceName,
  workspaceSlug,
  customDomain,
  domainStatus,
  locked,
  role,
  members,
}: {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  customDomain: string | null;
  domainStatus: string;
  locked: boolean;
  role: string;
  members: Member[];
}) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [dlg, setDlg] = useState<Dlg>(null);
  const [reason, setReason] = useState("");
  const [hours, setHours] = useState(1);
  const [to, setTo] = useState("");
  const [domainInput, setDomainInput] = useState(customDomain || `${workspaceSlug}.onboardops.org`);
  const [forceVerified, setForceVerified] = useState(true);
  const isOwner = role === "OWNER";
  const canSupport = role !== "VIEWER";
  const close = () => { setDlg(null); setReason(""); setTo(""); };

  return (
    <>
      {canSupport && (
        <div className="mt-6 flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => setDlg("access")}>Start support access…</button>
          {isOwner && (locked ? <button className="btn" disabled={pending} onClick={() => exec(() => unsuspendWorkspaceAction(workspaceId), { success: "Workspace unlocked", onOk: () => router.refresh() })}>Unlock workspace</button> : <button className="btn-danger" onClick={() => setDlg("lock")}>Lock workspace…</button>)}
          {isOwner && <button className="btn" onClick={() => setDlg("transfer")}>Transfer ownership…</button>}
          {isOwner && <button className="btn" onClick={() => { setDomainInput(customDomain || `${workspaceSlug}.onboardops.org`); setDlg("domain"); }}>Connect custom domain…</button>}
        </div>
      )}

      <section className="card mt-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Custom domain</h2>
            <p className="text-xs text-soft">
              {customDomain ? (
                <>Connected: <span className="mono font-medium text-ink">{customDomain}</span></>
              ) : (
                <>No custom domain connected. Default portal: <span className="mono">/w/{workspaceSlug}</span> (or <span className="mono">{workspaceSlug}.onboardops.org</span>)</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {customDomain && <Badge value={domainStatus === "VERIFIED" ? "PASSED" : "PENDING"} label={domainStatus} />}
            {isOwner && (
              <>
                <button className="btn" onClick={() => { setDomainInput(customDomain || `${workspaceSlug}.onboardops.org`); setDlg("domain"); }}>
                  {customDomain ? "Change domain" : "Connect domain manually"}
                </button>
                {customDomain && (
                  <button
                    className="btn-danger"
                    disabled={pending}
                    onClick={() => {
                      if (confirm(`Remove custom domain ${customDomain} from ${workspaceName}?`)) {
                        exec(() => adminRemoveDomainAction(workspaceId), { success: "Custom domain removed", onOk: () => router.refresh() });
                      }
                    }}
                  >
                    Remove
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      <section className="card mt-4 p-4">
        <h2 className="mb-2 text-sm font-semibold">Members</h2>
        <div className="divide-y divide-line">
          {members.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 py-2 text-[13px]">
              <div className="min-w-0 flex-1"><div className="font-medium">{m.name}</div><div className="mono text-xs text-soft">{m.email}</div></div>
              <Badge value={m.role === "OWNER" ? "ACTIVE" : "LOA"} label={m.role} />{m.locked && <Badge value="SUSPENDED" label="Locked out" />}
              {canSupport && <><button className="btn" disabled={pending} onClick={() => exec(() => sendRecoveryLinkAction(m.userId), { success: `Set-password link emailed to ${m.email}` })}>Email recovery link</button>
                {m.locked && <button className="btn" disabled={pending} onClick={() => exec(() => unlockUserAction(m.userId), { success: "Unlocked", onOk: () => router.refresh() })}>Unlock sign-in</button>}</>}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-soft">Recovery links go only to the person&apos;s own email. Staff never see the link.</p>
      </section>

      <Modal open={dlg === "access"} onClose={close} title="Start support access">
        <div className="space-y-3 text-[13px]">
          <p className="text-soft">Read-only view of {workspaceName} at Supervisor level: no confidential notes, documents or reviews. The owner is emailed and notified, and it shows in their audit log.</p>
          <Field label="Reason (shown to the customer)"><textarea className="textarea" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <Field label="Duration"><select className="input" value={hours} onChange={(e) => setHours(Number(e.target.value))}>{[1, 2, 4].map((h) => <option key={h} value={h}>{h} hour{h > 1 ? "s" : ""}</option>)}</select></Field>
          <button className="btn-primary w-full" disabled={pending} onClick={() => exec(() => startSupportAccessAction({ workspaceId, reason, hours }), { onOk: () => { window.location.href = "/app/overview"; } })}>Start access and open workspace</button>
        </div>
      </Modal>
      <Modal open={dlg === "lock"} onClose={close} title="Lock workspace">
        <div className="space-y-3 text-[13px]">
          <p className="text-soft">Everyone in the workspace is blocked, and the owner is emailed. The owner can still sign in to read the reason and download an export.</p>
          <Field label="Reason (shown to the owner)"><textarea className="textarea" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <button className="btn-danger w-full" disabled={pending} onClick={() => exec(() => suspendWorkspaceAction({ workspaceId, reason }), { success: "Workspace locked", onOk: () => { close(); router.refresh(); } })}>Lock workspace</button>
        </div>
      </Modal>
      <Modal open={dlg === "transfer"} onClose={close} title="Transfer ownership">
        <div className="space-y-3 text-[13px]">
          <p className="text-soft">Only after you have verified the request with the current owner or proof of authority. The current owner becomes an Admin.</p>
          <Field label="New owner"><select className="input" value={to} onChange={(e) => setTo(e.target.value)}><option value="">Select…</option>{members.filter((m) => m.role !== "OWNER").map((m) => <option key={m.id} value={m.id}>{m.name} ({m.email})</option>)}</select></Field>
          <Field label="How did you verify this? (recorded)"><textarea className="textarea" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <button className="btn-primary w-full" disabled={pending || !to} onClick={() => exec(() => transferOwnershipAction({ workspaceId, toMemberId: to, reason }), { success: "Ownership transferred", onOk: () => { close(); router.refresh(); } })}>Transfer ownership</button>
        </div>
      </Modal>
      <Modal open={dlg === "domain"} onClose={close} title="Connect custom domain manually">
        <div className="space-y-3 text-[13px]">
          <p className="text-soft">Assign a custom domain or an OnboardOps subdomain (e.g. <span className="mono">{workspaceSlug}.onboardops.org</span> or <span className="mono">retailnetwork.onboardops.org</span>) directly to {workspaceName}.</p>
          <Field label="Domain">
            <input className="input mono" value={domainInput} onChange={(e) => setDomainInput(e.target.value)} placeholder={`${workspaceSlug}.onboardops.org`} />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className="btn !h-7 !text-xs" onClick={() => setDomainInput(`${workspaceSlug}.onboardops.org`)}>Use {workspaceSlug}.onboardops.org</button>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={forceVerified} onChange={(e) => setForceVerified(e.target.checked)} />
            Mark as VERIFIED immediately (skip DNS waiting)
          </label>
          <button
            className="btn-primary w-full"
            disabled={pending || !domainInput.trim()}
            onClick={() => exec(() => adminConnectDomainAction({ workspaceId, domain: domainInput, forceVerified }), { success: `Connected ${domainInput}`, onOk: () => { close(); router.refresh(); } })}
          >
            Save & connect domain
          </button>
        </div>
      </Modal>
    </>
  );
}
