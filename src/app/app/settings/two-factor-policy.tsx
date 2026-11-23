"use client";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { resetMemberMfaAction, setWorkspace2faPolicyAction } from "@/actions/mfa";
import { Badge, useAction } from "@/components/ui";

export type MfaPolicy = { required: boolean; ownerHasMfa: boolean; members: { id: string; name: string; email: string; role: string; enabled: boolean; isSelf: boolean }[] };

/** Workspace-wide two-factor policy. Only the owner can change it or reset someone's two-factor setup. */
export function TwoFactorPolicy({ policy, isOwner }: { policy: MfaPolicy; isOwner: boolean }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const without = policy.members.filter((m) => !m.enabled).length;
  return (
    <div className="card p-4 text-[13px]" id="two-factor-policy">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4" />Two-factor authentication{policy.required ? <Badge value="ACTIVE" label="Required" /> : <Badge value="PENDING" label="Optional" />}</h2>
      <p className="mt-1 text-soft">{policy.required ? "Every member must use an authenticator app code at sign-in. Members who have not set it up are asked to at their next sign-in, and cannot use the workspace until they do." : "Each person can turn on two-factor authentication in Account settings. Require it to make it mandatory for everyone in this workspace."}</p>
      <p className="mt-2 text-xs text-soft">{policy.members.length - without} of {policy.members.length} members have it on.</p>
      {isOwner ? (
        <div className="mt-3 space-y-3">
          {!policy.required && !policy.ownerHasMfa && <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">Turn on two-factor authentication for your own account first (Account settings). That keeps you from locking yourself out.</p>}
          <button className={policy.required ? "btn" : "btn-primary"} disabled={pending || (!policy.required && !policy.ownerHasMfa)} onClick={() => {
            if (!policy.required && !confirm(`Require two-factor authentication for everyone? ${without} member${without === 1 ? "" : "s"} will be asked to set it up at their next sign-in.`)) return;
            exec(() => setWorkspace2faPolicyAction({ enabled: !policy.required }), { success: policy.required ? "Two-factor authentication is now optional" : "Two-factor authentication is now required", onOk: () => router.refresh() });
          }}>{policy.required ? "Stop requiring it" : "Require for everyone"}</button>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {policy.members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1"><div className="font-medium">{m.name}{m.isSelf && <span className="ml-1 text-xs text-soft">(you)</span>}</div><div className="mono truncate text-xs text-soft">{m.email} · {m.role}</div></div>
                {m.enabled ? <Badge value="PASSED" label="On" /> : <Badge value="PENDING" label="Off" />}
                {m.enabled && !m.isSelf && m.role !== "OWNER" && <button className="btn !h-7" disabled={pending} onClick={() => { if (confirm(`Reset two-factor authentication for ${m.name}? Use this when they have lost their phone and backup codes. They will be emailed.`)) exec(() => resetMemberMfaAction({ memberId: m.id }), { success: `Reset for ${m.name}`, onOk: () => router.refresh() }); }}>Reset</button>}
              </li>
            ))}
          </ul>
        </div>
      ) : <p className="mt-2 text-xs text-soft">Only the workspace owner can change this.</p>}
    </div>
  );
}
