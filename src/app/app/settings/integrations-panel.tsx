"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createApiKeyAction, deleteLocationAction, removeBambooAction, removeSmsConfigAction, revokeApiKeyAction, saveGenericWebhookAction, saveLocationAction, saveBambooAction, saveSmsConfigAction, syncBambooAction, testGenericWebhookAction, testSmsConfigAction } from "@/actions/integrations";
import { Field, useAction } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

type Key = { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null };
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
  const [url, setUrl] = useState(webhookUrl);
  const [secret, setSecret] = useState("");
  const [loc, setLoc] = useState({ name: "", address: "", timezone: "" });
  return (
    <div className="space-y-6 text-[13px]">
      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-semibold">API keys</h2>
        <p className="text-soft">Read-only access to your own employees and shifts. Send <span className="mono">Authorization: Bearer &lt;key&gt;</span> to <span className="mono">/api/v1/employees</span> or <span className="mono">/api/v1/shifts</span>. 120 requests a minute per key.</p>
        {fresh && <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"><div className="font-medium">Copy this key now. It will not be shown again.</div><div className="mono mt-1 break-all">{fresh}</div></div>}
        {keys.length > 0 && <ul className="divide-y divide-line">{keys.map((k) => (
          <li key={k.id} className="flex items-center gap-3 py-2"><div className="min-w-0 flex-1"><div className="font-medium">{k.name}</div><div className="mono text-xs text-soft">{k.prefix}… · created {fmtDateTime(k.createdAt)} · {k.lastUsedAt ? `last used ${fmtDateTime(k.lastUsedAt)}` : "never used"}</div></div>
            <button className="btn-danger" disabled={pending} onClick={() => { if (confirm(`Revoke "${k.name}"? Anything using it stops working.`)) exec(() => revokeApiKeyAction(k.id), { success: "Key revoked", onOk: () => router.refresh() }); }}>Revoke</button></li>
        ))}</ul>}
        <div className="flex gap-2"><input className="input" placeholder="Key name, e.g. Payroll sync" value={name} onChange={(e) => setName(e.target.value)} /><button className="btn-primary" disabled={pending} onClick={() => exec(() => createApiKeyAction({ name }), { onOk: (d) => { setFresh(d.key); setName(""); router.refresh(); } })}>Create key</button></div>
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
