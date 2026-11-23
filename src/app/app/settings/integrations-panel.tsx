"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createApiKeyAction, deleteLocationAction, removeBambooAction, removeSmsConfigAction, revokeApiKeyAction, saveGenericWebhookAction, saveLocationAction, saveBambooAction, saveSmsConfigAction, syncBambooAction, testGenericWebhookAction, testSmsConfigAction } from "@/actions/integrations";
import { Field, useAction } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";
import { DEFAULT_SCOPES, SCOPES, SCOPE_INFO, isWriteScope } from "@/lib/api-scopes";

type Key = { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null; scopes: string[]; expiresAt: string | null };
type Loc = { id: string; name: string; address: string; timezone: string };

export function IntegrationsPanel({ keys, webhookUrl, locations, sms, bamboo }: { keys: Key[]; webhookUrl: string; locations: Loc[]; sms: { configured: boolean; sid: string; from: string }; bamboo: { configured: boolean; subdomain: string } }) {
  const [bb, setBb] = useState({ subdomain: bamboo.subdomain, key: "" });
  const [bbResult, setBbResult] = useState("");
  const [smsForm, setSmsForm] = useState({ sid: sms.sid, token: "", from: sms.from });
  const [testTo, setTestTo] = useState("");
  const router = useRouter();
  const { exec, pending } = useAction();
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState("");
  const [scopes, setScopes] = useState<string[]>([...DEFAULT_SCOPES]);
  const [days, setDays] = useState<number | null>(null);
  const [url, setUrl] = useState(webhookUrl);
  const [secret, setSecret] = useState("");
  const [loc, setLoc] = useState({ name: "", address: "", timezone: "" });
  return (
    <div className="space-y-6 text-[13px]">
      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-semibold">API keys</h2>
        <p className="text-soft">Access to your own workspace data. Each key gets only the scopes you tick, can be revoked at any time, and every write it makes is recorded in the audit log under the key&apos;s name. Send <span className="mono">Authorization: Bearer &lt;key&gt;</span>. 120 requests a minute per key, 30 writes a minute. A key can never do more than the person who created it can do in the app. See the API reference in the help center.</p>
        {fresh && <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"><div className="font-medium">Copy this key now. It will not be shown again.</div><div className="mono mt-1 break-all">{fresh}</div></div>}
        {keys.length > 0 && <ul className="divide-y divide-line">{keys.map((k) => (
          <li key={k.id} className="flex items-center gap-3 py-2"><div className="min-w-0 flex-1"><div className="font-medium">{k.name}</div><div className="mono text-xs text-soft">{k.prefix}… · created {fmtDateTime(k.createdAt)} · {k.lastUsedAt ? `last used ${fmtDateTime(k.lastUsedAt)}` : "never used"}{k.expiresAt ? ` · expires ${fmtDateTime(k.expiresAt)}` : ""}</div><div className="mt-1 flex flex-wrap gap-1">{k.scopes.map((s) => <span key={s} className={`rounded border px-1.5 py-0.5 text-[11px] ${isWriteScope(s) ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200" : "border-line bg-muted text-soft"}`}>{s}</span>)}</div></div>
            <button className="btn-danger" disabled={pending} onClick={() => { if (confirm(`Revoke "${k.name}"? Anything using it stops working.`)) exec(() => revokeApiKeyAction(k.id), { success: "Key revoked", onOk: () => router.refresh() }); }}>Revoke</button></li>
        ))}</ul>}
        <div className="space-y-3 rounded-lg border border-line p-3">
          <input className="input" placeholder="Key name, e.g. Payroll sync" value={name} onChange={(e) => setName(e.target.value)} />
          <fieldset><legend className="label">Scopes</legend><div className="grid gap-1 sm:grid-cols-2">{SCOPES.map((s) => <label key={s} className="flex items-start gap-2"><input type="checkbox" className="mt-0.5" checked={scopes.includes(s)} onChange={() => setScopes(scopes.includes(s) ? scopes.filter((x) => x !== s) : [...scopes, s])} /><span><span className="mono text-xs">{s}</span>{isWriteScope(s) && <span className="ml-1 text-xs text-amber-700 dark:text-amber-300">write</span>}<span className="block text-xs text-soft">{SCOPE_INFO[s].hint}</span></span></label>)}</div></fieldset>
          <div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-2">Expires<select className="input !w-auto" value={days ?? ""} onChange={(e) => setDays(e.target.value ? Number(e.target.value) : null)}><option value="">Never</option><option value="30">in 30 days</option><option value="90">in 90 days</option><option value="365">in 1 year</option></select></label>
            <button className="btn-primary" disabled={pending || !scopes.length} onClick={() => exec(() => createApiKeyAction({ name, scopes, expiresInDays: days }), { onOk: (d) => { setFresh(d.key); setName(""); setScopes([...DEFAULT_SCOPES]); setDays(null); router.refresh(); } })}>Create key</button></div>
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-semibold">JSON webhook</h2>
        <p className="text-soft">Receives the same operations and confidential events as Discord and Slack, as signed JSON. Each request carries <span className="mono">X-OnboardOps-Signature: sha256=…</span>, an HMAC-SHA256 of the body using your secret. Must be a public https URL.</p>
        <Field label="Endpoint URL"><input className="input mono" placeholder="https://example.com/hooks/onboardops" value={url} onChange={(e) => setUrl(e.target.value)} /></Field>
        {secret && <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"><div className="font-medium">Signing secret (shown now; saved for signing)</div><div className="mono mt-1 break-all">{secret}</div></div>}
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={pending} onClick={() => exec(() => saveGenericWebhookAction({ url }), { success: "Webhook saved", onOk: (d) => { setSecret(d.secret); router.refresh(); } })}>Save</button>
          <button className="btn" disabled={pending || !webhookUrl} onClick={() => exec(() => saveGenericWebhookAction({ url, regenerateSecret: true }), { success: "New secret generated", onOk: (d) => { setSecret(d.secret); router.refresh(); } })}>New secret</button>
          <button className="btn" disabled={pending || !webhookUrl} onClick={() => exec(() => testGenericWebhookAction(), { success: "Test event delivered" })}>Send test event</button>
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-semibold">Text messages (your own Twilio account)</h2>
        <p className="text-soft">OnboardOps does not send texts for you. Connect your own Twilio account and you pay Twilio directly. Employees then opt in from My Portal and get texts for new shifts, swap answers and request decisions. Your auth token is stored encrypted and is never shown again. In the US, register your number for messaging with Twilio first.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="Account SID"><input className="input mono" placeholder="AC…" value={smsForm.sid} onChange={(e) => setSmsForm({ ...smsForm, sid: e.target.value })} /></Field>
          <Field label={sms.configured ? "Auth token (leave blank to keep)" : "Auth token"}><input className="input mono" type="password" autoComplete="off" value={smsForm.token} onChange={(e) => setSmsForm({ ...smsForm, token: e.target.value })} /></Field>
          <Field label="From number or Messaging Service SID"><input className="input mono" placeholder="+14045550142" value={smsForm.from} onChange={(e) => setSmsForm({ ...smsForm, from: e.target.value })} /></Field>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-primary" disabled={pending} onClick={() => exec(() => saveSmsConfigAction(smsForm), { success: "Text provider saved", onOk: () => { setSmsForm({ ...smsForm, token: "" }); router.refresh(); } })}>{sms.configured ? "Update" : "Connect"}</button>
          {sms.configured && (
            <>
              <input className="input mono !w-44" placeholder="Your mobile for a test" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
              <button className="btn" disabled={pending || !testTo} onClick={() => exec(() => testSmsConfigAction({ to: testTo }), { success: "Test text sent" })}>Send test</button>
              <button className="btn-danger" disabled={pending} onClick={() => { if (confirm("Remove the text provider? All employee opt-ins are cleared.")) exec(() => removeSmsConfigAction(), { success: "Removed", onOk: () => router.refresh() }); }}>Remove</button>
            </>
          )}
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-semibold">BambooHR employee sync (your own account)</h2>
        <p className="text-soft">Adds people who are in BambooHR but not here yet, using their work email, department and job title. It never changes or removes existing people. In BambooHR, create an API key under your profile menu → API Keys. The key is stored encrypted and never shown again.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="BambooHR subdomain"><input className="input mono" placeholder="yourcompany" value={bb.subdomain} onChange={(e) => setBb({ ...bb, subdomain: e.target.value })} /></Field>
          <Field label={bamboo.configured ? "API key (leave blank to keep)" : "API key"}><input className="input mono" type="password" autoComplete="off" value={bb.key} onChange={(e) => setBb({ ...bb, key: e.target.value })} /></Field>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-primary" disabled={pending} onClick={() => exec(() => saveBambooAction(bb), { success: "BambooHR connected", onOk: () => { setBb({ ...bb, key: "" }); router.refresh(); } })}>{bamboo.configured ? "Update" : "Connect"}</button>
          {bamboo.configured && (
            <>
              <button className="btn" disabled={pending} onClick={() => exec(() => syncBambooAction(), { onOk: (d) => { setBbResult(`${d.created} added, ${d.skipped} already here or skipped, ${d.fetched} found in BambooHR.`); router.refresh(); } })}>{pending ? "Syncing…" : "Sync now"}</button>
              <button className="btn-danger" disabled={pending} onClick={() => { if (confirm("Disconnect BambooHR?")) exec(() => removeBambooAction(), { success: "Disconnected", onOk: () => router.refresh() }); }}>Disconnect</button>
            </>
          )}
          {bbResult && <span className="text-xs text-soft">{bbResult}</span>}
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-semibold">Locations</h2>
        <p className="text-soft">Sites or stores. Assign each employee to one from their record.</p>
        {locations.length > 0 && <ul className="divide-y divide-line">{locations.map((l) => (
          <li key={l.id} className="flex items-center gap-3 py-2"><div className="min-w-0 flex-1"><div className="font-medium">{l.name}</div><div className="text-xs text-soft">{[l.address, l.timezone].filter(Boolean).join(" · ") || "No address"}</div></div>
            <button className="btn-danger" disabled={pending} onClick={() => { if (confirm(`Delete ${l.name}? Employees assigned to it become unassigned.`)) exec(() => deleteLocationAction(l.id), { success: "Location deleted", onOk: () => router.refresh() }); }}>Delete</button></li>
        ))}</ul>}
        <div className="grid gap-2 sm:grid-cols-3"><input className="input" placeholder="Name" value={loc.name} onChange={(e) => setLoc({ ...loc, name: e.target.value })} /><input className="input" placeholder="Address (optional)" value={loc.address} onChange={(e) => setLoc({ ...loc, address: e.target.value })} /><input className="input" placeholder="Time zone, e.g. America/New_York" value={loc.timezone} onChange={(e) => setLoc({ ...loc, timezone: e.target.value })} /></div>
        <button className="btn" disabled={pending} onClick={() => exec(() => saveLocationAction(loc), { success: "Location added", onOk: () => { setLoc({ name: "", address: "", timezone: "" }); router.refresh(); } })}>Add location</button>
      </section>
    </div>
  );
}
