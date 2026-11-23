"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { unlinkOAuthAction } from "@/actions/oauth";
import { Badge, useAction, useToast } from "@/components/ui";
import { GitHubIcon, GoogleIcon } from "@/components/social-icons";
import { fmtDate } from "@/lib/utils";

export type ConnectedProvider = { provider: "google" | "github"; label: string; configured: boolean; connected: { email: string | null; since: string } | null };

/** Which Google or GitHub accounts can sign in to this OnboardOps account. */
export function ConnectedAccounts({ providers, canUnlink, notice, error }: { providers: ConnectedProvider[]; canUnlink: boolean; notice?: string; error?: string }) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();
  useEffect(() => { if (notice === "linked") toast("ok", "Account connected"); if (error) toast("error", error); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  return (
    <section className="card mt-5 p-5" id="connected-accounts">
      <h2 className="text-sm font-semibold">Connected accounts</h2>
      <p className="mt-0.5 text-[13px] text-soft">Sign in with Google or GitHub instead of a password. Two-factor authentication, if you turned it on, is still asked for.</p>
      <ul className="mt-4 divide-y divide-line rounded-lg border border-line text-[13px]">
        {providers.map((p) => (
          <li key={p.provider} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
            {p.provider === "google" ? <GoogleIcon className="h-5 w-5" /> : <GitHubIcon className="h-5 w-5" />}
            <div className="min-w-0 flex-1"><div className="font-medium">{p.label}</div><div className="mono truncate text-xs text-soft">{p.connected ? `${p.connected.email ?? "Connected"} · since ${fmtDate(p.connected.since)}` : p.configured ? "Not connected" : "Not available on this server"}</div></div>
            {p.connected ? (<><Badge value="PASSED" label="Connected" /><button className="btn" disabled={pending || !canUnlink} title={canUnlink ? undefined : "Set a password or connect another account first"} onClick={() => { if (confirm(`Disconnect ${p.label}? You will no longer be able to sign in with it.`)) exec(() => unlinkOAuthAction({ provider: p.provider }), { success: `${p.label} disconnected`, onOk: () => router.refresh() }); }}>Disconnect</button></>)
              : p.configured ? <a className="btn" href={`/api/auth/oauth/${p.provider}/start?mode=link`}>Connect</a> : null}
          </li>
        ))}
      </ul>
      {!canUnlink && providers.some((p) => p.connected) && <p className="mt-3 text-xs text-soft">You cannot disconnect your only way to sign in. Set a password above, or connect another account, to enable Disconnect.</p>}
    </section>
  );
}
