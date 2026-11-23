"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { disableSsoAction, enableSsoAction, removeSsoAction, saveSsoAction } from "@/actions/sso";
import { Badge, Field, useAction, useToast } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

export type SsoConfig = { provider: "google" | "entra"; clientId: string; tenantId: string; domains: string[]; enabled: boolean; enforce: boolean; testedAt: string | null };
export type SsoPanelState = { config: SsoConfig | null; redirectUri: string; workspaceId: string; needs: { password: boolean; code: boolean }; notice?: string; error?: string };

/** Single sign-on setup (owner only). The client secret is write-only: once saved it is never shown again. */
export function SsoPanel({ s, isOwner }: { s: SsoPanelState; isOwner: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();
  const c = s.config;
  const [provider, setProvider] = useState<"google" | "entra">(c?.provider ?? "google");
  const [clientId, setClientId] = useState(c?.clientId ?? "");
  const [secret, setSecret] = useState("");
  const [tenant, setTenant] = useState(c?.tenantId ?? "");
  const [domains, setDomains] = useState((c?.domains ?? []).join(", "));
  const [enforce, setEnforce] = useState(c?.enforce ?? false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  useEffect(() => { if (s.notice === "tested") toast("ok", "Test sign-in succeeded. You can turn single sign-on on."); if (s.error) toast("error", s.error); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const auth = { password: s.needs.password ? password : undefined, code: s.needs.code ? code : undefined };
  const authOk = (!s.needs.password || !!password) && (!s.needs.code || !!code);
  const refresh = () => { setSecret(""); setPassword(""); setCode(""); router.refresh(); };
  return (
    <div className="card p-4 text-[13px]" id="sso">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><LogIn className="h-4 w-4" />Single sign-on{c?.enabled ? <Badge value="ACTIVE" label="On" /> : c ? <Badge value="PENDING" label="Set up, not on" /> : <Badge value="PENDING" label="Off" />}</h2>
      <p className="mt-1 text-soft">Let people sign in with your company&apos;s Google Workspace or Microsoft Entra ID account. Only people who already have an account and membership in this workspace can get in; a company domain alone never grants access. Workspace two-factor rules still apply after SSO.</p>
      {!isOwner ? <p className="mt-3 text-xs text-soft">Only the workspace owner can change this.</p> : (
        <div className="mt-3 space-y-4">
          <div className="rounded-md border border-line bg-muted p-3"><div className="text-xs text-soft">Add this redirect URI at your identity provider</div><div className="mono mt-1 break-all">{s.redirectUri}</div></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Provider"><select className="input" value={provider} onChange={(e) => setProvider(e.target.value as "google" | "entra")}><option value="google">Google Workspace</option><option value="entra">Microsoft Entra ID</option></select></Field>
            <Field label="Client ID"><input className="input mono" value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" /></Field>
            <Field label={c ? "Client secret (leave empty to keep the saved one)" : "Client secret"}><input className="input mono" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="new-password" placeholder={c ? "Saved. Never shown again." : ""} /></Field>
            {provider === "entra" && <Field label="Tenant (directory) ID"><input className="input mono" value={tenant} onChange={(e) => setTenant(e.target.value)} placeholder="11111111-2222-3333-4444-555555555555" /></Field>}
            <div className="sm:col-span-2"><Field label="Allowed email domains (comma separated)"><input className="input mono" value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="acme.com" /></Field></div>
          </div>
          <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5" checked={enforce} onChange={(e) => setEnforce(e.target.checked)} /><span>Require SSO for everyone on these domains except owners. Owners can always use a password, so a broken identity provider cannot lock you out.</span></label>
          {(s.needs.password || s.needs.code) && <div className="grid gap-3 sm:grid-cols-2">{s.needs.password && <Field label="Your password"><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>}{s.needs.code && <Field label="Authenticator code"><input className="input mono" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" maxLength={14} /></Field>}</div>}
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" disabled={pending || !authOk || clientId.trim().length < 5 || (!c && !secret) || !domains.trim()} onClick={() => exec(() => saveSsoAction({ provider, clientId, clientSecret: secret || undefined, tenantId: tenant || undefined, domains, enforce, ...auth }), { success: "Saved", onOk: refresh })}>Save</button>
            {c && <a className="btn" href={`/api/auth/sso/start?test=1&ws=${s.workspaceId}`}>Test sign-in</a>}
            {c && !c.enabled && <button className="btn" disabled={pending || !authOk || !c.testedAt} title={c.testedAt ? undefined : "Run a successful test first"} onClick={() => exec(() => enableSsoAction(auth), { success: "Single sign-on is on", onOk: refresh })}>Turn on</button>}
            {c?.enabled && <button className="btn" disabled={pending || !authOk} onClick={() => exec(() => disableSsoAction(auth), { success: "Single sign-on is off", onOk: refresh })}>Turn off</button>}
            {c && <button className="btn-danger" disabled={pending || !authOk} onClick={() => { if (confirm("Remove single sign-on and delete the stored client secret?")) exec(() => removeSsoAction(auth), { success: "Removed", onOk: refresh }); }}>Remove</button>}
          </div>
          {c && <p className="text-xs text-soft">{c.testedAt ? `Last successful test ${fmtDateTime(c.testedAt)}.` : "Not tested yet. A successful test sign-in is required before it can be turned on."} Changing the provider, client ID, secret or domains turns SSO off until it is tested again.</p>}
        </div>
      )}
    </div>
  );
}
