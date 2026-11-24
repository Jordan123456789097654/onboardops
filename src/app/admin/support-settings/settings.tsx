"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Plus, Trash2 } from "lucide-react";
import {
  blockEmailAction, clearWebhookAction, createApiKeyAction, createCannedAction, deleteCannedAction, revokeApiKeyAction, saveSupportSettingsAction, saveWebhookAction, testWebhookAction, unblockEmailAction,
} from "@/actions/support-admin";
import { Field, useAction, useToast } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

type Role = "OWNER" | "SUPPORT" | "VIEWER";
type InboxRule = { id: string; name: string; match: { source?: string; topic?: string; pagePrefix?: string; tag?: string }; reps: string[] };
type Cfg = {
  hours: { tz: string; days: boolean[]; from: string; to: string };
  awayMessage: string; responseTarget: string; sla: { warnMin: number; breachMin: number }; statuses: string[];
  autoAssign: { enabled: boolean; reps: string[] }; inboxes: InboxRule[]; idle: { enabled: boolean; nudgeDays: number; closeDays: number };
  retentionMonths: number; perms: Record<"close" | "delete" | "export" | "block" | "settings", Role[]>;
  brand: { name: string; subtitle: string; color: string; greeting: string; avatar: string };
  webhook: { host: string | null; configured: boolean; events: string[] };
  apiKeys: { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null }[];
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PERM_LABEL: Record<string, string> = { close: "Close tickets and mark spam", delete: "Delete tickets", export: "Export tickets to CSV", block: "Block senders", settings: "Change these settings" };
const EVENT_LABEL: Record<string, string> = { "ticket.created": "A ticket is opened", "ticket.visitor_message": "The customer writes again", "ticket.replied": "Staff reply", "ticket.solved": "A ticket is solved" };

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card mb-4 p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint && <p className="mb-3 mt-0.5 max-w-2xl text-[12.5px] text-soft">{hint}</p>}
      <div className={hint ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

export function Settings({ cfg, staff, blocks, canned, canEdit, canBlock, inboundReady, replyToSet }: { cfg: Cfg; staff: string[]; blocks: { email: string; reason: string; by: string; at: string }[]; canned: { id: string; title: string; body: string; grp: string }[]; canEdit: boolean; canBlock: boolean; inboundReady: boolean; replyToSet: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();
  const [hours, setHours] = useState(cfg.hours);
  const [away, setAway] = useState({ awayMessage: cfg.awayMessage, responseTarget: cfg.responseTarget });
  const [sla, setSla] = useState(cfg.sla);
  const [statuses, setStatuses] = useState(cfg.statuses.join(", "));
  const [auto, setAuto] = useState(cfg.autoAssign);
  const [inboxes, setInboxes] = useState<InboxRule[]>(cfg.inboxes);
  const [idle, setIdle] = useState(cfg.idle);
  const [retention, setRetention] = useState(cfg.retentionMonths);
  const [brand, setBrand] = useState(cfg.brand);
  const [perms, setPerms] = useState(cfg.perms);
  const [hook, setHook] = useState({ url: "", events: cfg.webhook.events });
  const [secret, setSecret] = useState<string | null>(null);
  const [keyName, setKeyName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [block, setBlock] = useState({ email: "", reason: "" });
  const [tpl, setTpl] = useState({ title: "", body: "", grp: "Custom" });

  const save = (patch: Record<string, unknown>, label: string) => exec(() => saveSupportSettingsAction(patch), { success: `${label} saved`, onOk: () => router.refresh() });
  const dis = !canEdit || pending;
  const copy = (t: string) => { void navigator.clipboard.writeText(t); toast("ok", "Copied"); };

  return (
    <div>
      <Section title="Business hours" hint="Outside these hours the chat bubble shows an away banner and an expected reply time. Tickets are still accepted. Maya also knows whether the team is online.">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Time zone"><input className="input" value={hours.tz} onChange={(e) => setHours({ ...hours, tz: e.target.value })} placeholder="America/New_York" /></Field>
          <Field label="Opens"><input className="input" type="time" value={hours.from} onChange={(e) => setHours({ ...hours, from: e.target.value })} /></Field>
          <Field label="Closes"><input className="input" type="time" value={hours.to} onChange={(e) => setHours({ ...hours, to: e.target.value })} /></Field>
          <Field label="Reply target shown to visitors"><input className="input" value={away.responseTarget} onChange={(e) => setAway({ ...away, responseTarget: e.target.value })} /></Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {DAYS.map((d, i) => (
            <label key={d} className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-[13px]"><input type="checkbox" checked={hours.days[i]} onChange={(e) => setHours({ ...hours, days: hours.days.map((v, j) => (j === i ? e.target.checked : v)) })} />{d}</label>
          ))}
        </div>
        <Field label="Away message"><textarea className="textarea mt-3" rows={2} value={away.awayMessage} onChange={(e) => setAway({ ...away, awayMessage: e.target.value })} /></Field>
        <button className="btn-primary mt-3" disabled={dis} onClick={() => save({ hours, ...away }, "Business hours")}>Save hours</button>
      </Section>

      <Section title="SLA timers" hint="The inbox colors how long a customer has waited for a reply: green until the first limit, amber until the second, then red.">
        <div className="grid max-w-md grid-cols-2 gap-3">
          <Field label="Amber after (minutes)"><input className="input" type="number" min={5} value={sla.warnMin} onChange={(e) => setSla({ ...sla, warnMin: Number(e.target.value) })} /></Field>
          <Field label="Red after (minutes)"><input className="input" type="number" min={10} value={sla.breachMin} onChange={(e) => setSla({ ...sla, breachMin: Number(e.target.value) })} /></Field>
        </div>
        <button className="btn-primary mt-3" disabled={dis} onClick={() => save({ sla }, "SLA timers")}>Save SLA</button>
      </Section>

      <Section title="Ticket statuses" hint="Open, Waiting and Solved always exist. Add your own, like WAITING_ON_USER or ESCALATED, separated by commas. Custom statuses count as active, not solved.">
        <input className="input max-w-lg" value={statuses} onChange={(e) => setStatuses(e.target.value)} placeholder="WAITING_ON_USER, ESCALATED" />
        <div><button className="btn-primary mt-3" disabled={dis} onClick={() => save({ statuses: statuses.split(",").map((s) => s.trim()).filter(Boolean) }, "Statuses")}>Save statuses</button></div>
      </Section>

      <Section title="Auto-assignment" hint="New tickets go to whoever on the list has the fewest open tickets.">
        <label className="mb-2 flex items-center gap-2 text-[13px]"><input type="checkbox" checked={auto.enabled} onChange={(e) => setAuto({ ...auto, enabled: e.target.checked })} />Assign new tickets automatically</label>
        <div className="flex flex-wrap gap-2">
          {staff.map((s) => (
            <label key={s} className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-[13px]"><input type="checkbox" checked={auto.reps.includes(s)} onChange={(e) => setAuto({ ...auto, reps: e.target.checked ? [...auto.reps, s] : auto.reps.filter((x) => x !== s) })} />{s}</label>
          ))}
        </div>
        <button className="btn-primary mt-3" disabled={dis} onClick={() => save({ autoAssign: auto }, "Auto-assignment")}>Save assignment</button>
      </Section>

      <Section title="Inboxes and routing" hint="Send tickets to a named inbox based on where they came from. The first matching rule wins, and its own team (if set) replaces the general list above.">
        <div className="space-y-2">
          {inboxes.map((r, i) => (
            <div key={r.id || i} className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-6">
              <input className="input sm:col-span-1" placeholder="Name" value={r.name} onChange={(e) => setInboxes(inboxes.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <select className="input" value={r.match.source ?? ""} onChange={(e) => setInboxes(inboxes.map((x, j) => (j === i ? { ...x, match: { ...x.match, source: e.target.value || undefined } } : x)))}>
                <option value="">Any source</option>{["CHAT", "CONTACT", "EMAIL", "IN_APP"].map((s) => <option key={s}>{s}</option>)}
              </select>
              <select className="input" value={r.match.topic ?? ""} onChange={(e) => setInboxes(inboxes.map((x, j) => (j === i ? { ...x, match: { ...x.match, topic: e.target.value || undefined } } : x)))}>
                <option value="">Any topic</option>{["Question", "Bug", "Billing or plan", "Security report", "Feedback"].map((s) => <option key={s}>{s}</option>)}
              </select>
              <input className="input" placeholder="Page starts with /pricing" value={r.match.pagePrefix ?? ""} onChange={(e) => setInboxes(inboxes.map((x, j) => (j === i ? { ...x, match: { ...x.match, pagePrefix: e.target.value || undefined } } : x)))} />
              <input className="input" placeholder="Has tag" value={r.match.tag ?? ""} onChange={(e) => setInboxes(inboxes.map((x, j) => (j === i ? { ...x, match: { ...x.match, tag: e.target.value || undefined } } : x)))} />
              <div className="flex gap-1">
                <select className="input" value={r.reps[0] ?? ""} onChange={(e) => setInboxes(inboxes.map((x, j) => (j === i ? { ...x, reps: e.target.value ? [e.target.value] : [] } : x)))}>
                  <option value="">Anyone</option>{staff.map((s) => <option key={s}>{s}</option>)}
                </select>
                <button type="button" className="btn !px-2" aria-label="Remove inbox" onClick={() => setInboxes(inboxes.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button className="btn" disabled={dis || inboxes.length >= 12} onClick={() => setInboxes([...inboxes, { id: "", name: "", match: {}, reps: [] }])}><Plus className="h-3.5 w-3.5" />Add inbox</button>
          <button className="btn-primary" disabled={dis} onClick={() => save({ inboxes: inboxes.filter((i) => i.name.trim()) }, "Inboxes")}>Save inboxes</button>
        </div>
      </Section>

      <Section title="Idle tickets and data retention" hint="When you've replied and the customer goes quiet, Maya checks in; if there's still no answer, the ticket closes. This runs when the inbox or chat is opened, not on a timer.">
        <label className="mb-3 flex items-center gap-2 text-[13px]"><input type="checkbox" checked={idle.enabled} onChange={(e) => setIdle({ ...idle, enabled: e.target.checked })} />Check in on quiet tickets, then close them</label>
        <div className="grid max-w-xl grid-cols-3 gap-3">
          <Field label="Check in after (days)"><input className="input" type="number" min={1} value={idle.nudgeDays} onChange={(e) => setIdle({ ...idle, nudgeDays: Number(e.target.value) })} /></Field>
          <Field label="Close after check-in (days)"><input className="input" type="number" min={1} value={idle.closeDays} onChange={(e) => setIdle({ ...idle, closeDays: Number(e.target.value) })} /></Field>
          <Field label="Delete solved after (months, 0 = never)"><input className="input" type="number" min={0} value={retention} onChange={(e) => setRetention(Number(e.target.value))} /></Field>
        </div>
        <p className="mt-2 max-w-xl text-[12px] text-soft">Deleting is permanent and covers solved tickets only. Privacy requests are always kept.</p>
        <button className="btn-primary mt-3" disabled={dis} onClick={() => { if (retention > 0 && !confirm(`Permanently delete solved tickets older than ${retention} month(s)? This runs automatically from now on.`)) return; save({ idle, retentionMonths: retention }, "Idle and retention"); }}>Save</button>
      </Section>

      <Section title="Chat bubble branding" hint="What visitors see on the website chat. Leave the color empty to use the site's accent color.">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Assistant name"><input className="input" maxLength={30} value={brand.name} onChange={(e) => setBrand({ ...brand, name: e.target.value })} /></Field>
          <Field label="Subtitle"><input className="input" maxLength={60} value={brand.subtitle} onChange={(e) => setBrand({ ...brand, subtitle: e.target.value })} /></Field>
          <Field label="Color (hex)"><input className="input" placeholder="#2563eb" value={brand.color} onChange={(e) => setBrand({ ...brand, color: e.target.value })} /></Field>
          <Field label="Avatar (a letter or emoji)"><input className="input" maxLength={4} value={brand.avatar} onChange={(e) => setBrand({ ...brand, avatar: e.target.value })} /></Field>
        </div>
        <Field label="Greeting"><textarea className="textarea mt-3" rows={2} maxLength={300} value={brand.greeting} onChange={(e) => setBrand({ ...brand, greeting: e.target.value })} /></Field>
        <button className="btn-primary mt-3" disabled={dis} onClick={() => save({ brand }, "Branding")}>Save branding</button>
      </Section>

      <Section title="Who can do what" hint="Owners can always do everything. Choose which other staff roles get each permission.">
        <div className="space-y-2">
          {(Object.keys(PERM_LABEL) as (keyof typeof perms)[]).map((k) => (
            <div key={k} className="flex flex-wrap items-center gap-3 text-[13px]">
              <span className="w-56">{PERM_LABEL[k]}</span>
              {(["SUPPORT", "VIEWER"] as Role[]).map((role) => (
                <label key={role} className="flex items-center gap-1.5"><input type="checkbox" disabled={k === "settings" && role === "VIEWER"} checked={perms[k].includes(role)} onChange={(e) => setPerms({ ...perms, [k]: e.target.checked ? [...perms[k], role] : perms[k].filter((x) => x !== role) })} />{role === "SUPPORT" ? "Support" : "Viewer"}</label>
              ))}
            </div>
          ))}
        </div>
        <button className="btn-primary mt-3" disabled={dis} onClick={() => save({ perms: { ...perms, settings: Array.from(new Set<Role>([...perms.settings, "OWNER"])) } }, "Permissions")}>Save permissions</button>
      </Section>

      <Section title="Outgoing webhook" hint="We POST a signed JSON message to your URL when something happens. The URL and signing secret are stored encrypted. Each request carries an x-onboardops-signature header: sha256= plus the HMAC-SHA256 of the body using your secret. Messages include the customer's name, email and the first 240 characters of the message, so point this at a system you trust.">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[280px] flex-1"><Field label={cfg.webhook.configured ? `Current: ${cfg.webhook.host}. Enter a new URL to replace it` : "Webhook URL (https)"}><input className="input" placeholder="https://example.com/hooks/support" value={hook.url} onChange={(e) => setHook({ ...hook, url: e.target.value })} /></Field></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.keys(EVENT_LABEL).map((ev) => (
            <label key={ev} className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-[13px]"><input type="checkbox" checked={hook.events.includes(ev)} onChange={(e) => setHook({ ...hook, events: e.target.checked ? [...hook.events, ev] : hook.events.filter((x) => x !== ev) })} />{EVENT_LABEL[ev]}</label>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-primary" disabled={dis || (!hook.url && !cfg.webhook.configured)} onClick={() => exec(() => saveWebhookAction({ url: hook.url || undefined, events: hook.events }), { success: "Webhook saved", onOk: (d) => { setSecret(d.secret); setHook({ ...hook, url: "" }); router.refresh(); } })}>Save webhook</button>
          {cfg.webhook.configured && <>
            <button className="btn" disabled={dis} onClick={() => exec(() => testWebhookAction(), { success: "Test sent. Check your endpoint." })}>Send test</button>
            <button className="btn" disabled={dis} onClick={() => exec(() => saveWebhookAction({ events: hook.events, rotateSecret: true }), { success: "New secret created", onOk: (d) => { setSecret(d.secret); router.refresh(); } })}>New signing secret</button>
            <button className="btn text-rose-600" disabled={dis} onClick={() => { if (confirm("Remove the webhook?")) exec(() => clearWebhookAction(), { success: "Webhook removed", onOk: () => router.refresh() }); }}>Remove</button>
          </>}
        </div>
        {secret && (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <p className="mb-1 font-medium">Your signing secret. It is shown once, so copy it now.</p>
            <div className="flex items-center gap-2"><code className="mono break-all text-[12px]">{secret}</code><button className="btn !h-7" onClick={() => copy(secret)}><Copy className="h-3 w-3" /></button></div>
          </div>
        )}
      </Section>

      <Section title="API keys" hint="Read and update tickets from your own tools. Send the key as a Bearer token to /api/support/v1/tickets (GET list), /api/support/v1/tickets/{id} (GET, PATCH) and /api/support/v1/tickets/{id}/reply (POST). Keys are stored as hashes, so we can only show a key once.">
        <div className="flex gap-2">
          <input className="input max-w-xs" placeholder="Key name, e.g. Zapier" value={keyName} onChange={(e) => setKeyName(e.target.value)} />
          <button className="btn-primary" disabled={dis || keyName.trim().length < 2} onClick={() => exec(() => createApiKeyAction(keyName), { success: "Key created", onOk: (d) => { setNewKey(d.key); setKeyName(""); router.refresh(); } })}>Create key</button>
        </div>
        {newKey && (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <p className="mb-1 font-medium">Copy this key now. You won&apos;t be able to see it again.</p>
            <div className="flex items-center gap-2"><code className="mono break-all text-[12px]">{newKey}</code><button className="btn !h-7" onClick={() => copy(newKey)}><Copy className="h-3 w-3" /></button></div>
          </div>
        )}
        <ul className="mt-3 divide-y divide-line text-[13px]">
          {cfg.apiKeys.length === 0 && <li className="py-2 text-soft">No keys yet.</li>}
          {cfg.apiKeys.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-3 py-2">
              <div><strong>{k.name}</strong> <span className="mono text-[12px] text-soft">{k.prefix}…</span><div className="text-[11.5px] text-soft">Created {fmtDateTime(k.createdAt)} · {k.lastUsedAt ? `last used ${fmtDateTime(k.lastUsedAt)}` : "never used"}</div></div>
              <button className="btn !h-8 text-rose-600" disabled={dis} onClick={() => { if (confirm(`Revoke "${k.name}"? Anything using it stops working.`)) exec(() => revokeApiKeyAction(k.id), { success: "Key revoked", onOk: () => router.refresh() }); }}>Revoke</button>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Email in and out" hint="Replies from customers are matched to their ticket by the reference in the subject line. Anything else becomes a new ticket.">
        <ul className="space-y-1.5 text-[13px]">
          <li><span className={inboundReady ? "text-emerald-600" : "text-amber-600"}>{inboundReady ? "Ready" : "Not set up"}</span>: inbound email endpoint. {inboundReady ? "Point your inbound-email service at /api/support/inbound/<your SUPPORT_INBOUND_SECRET> (JSON or form posts)." : "Add SUPPORT_INBOUND_SECRET in Vercel, then point an inbound-email service (Postmark, Mailgun, SendGrid or similar) at /api/support/inbound/<that secret>."}</li>
          <li><span className={replyToSet ? "text-emerald-600" : "text-amber-600"}>{replyToSet ? "Ready" : "Not set up"}</span>: reply-to address on staff replies. {replyToSet ? "Customers reply to your support inbox." : "Add SUPPORT_REPLY_TO in Vercel (an address your inbound service receives) so customer replies reach the endpoint above."}</li>
        </ul>
      </Section>

      <Section title="Blocked senders" hint="A blocked email address can't open new tickets from the chat, contact form or email. Privacy, legal and security requests are never blocked.">
        <div className="flex flex-wrap gap-2">
          <input className="input max-w-xs" type="email" placeholder="email@example.com" value={block.email} onChange={(e) => setBlock({ ...block, email: e.target.value })} />
          <input className="input max-w-xs" placeholder="Reason (optional)" value={block.reason} onChange={(e) => setBlock({ ...block, reason: e.target.value })} />
          <button className="btn-primary" disabled={!canBlock || pending || !block.email} onClick={() => exec(() => blockEmailAction(block), { success: "Blocked", onOk: () => { setBlock({ email: "", reason: "" }); router.refresh(); } })}>Block</button>
        </div>
        <ul className="mt-3 divide-y divide-line text-[13px]">
          {blocks.length === 0 && <li className="py-2 text-soft">Nobody is blocked.</li>}
          {blocks.map((b) => (
            <li key={b.email} className="flex items-center justify-between gap-3 py-2"><div><span className="mono">{b.email}</span><div className="text-[11.5px] text-soft">{b.reason || "No reason"} · by {b.by} · {fmtDateTime(b.at)}</div></div><button className="btn !h-8" disabled={!canBlock || pending} onClick={() => exec(() => unblockEmailAction(b.email), { success: "Unblocked", onOk: () => router.refresh() })}>Unblock</button></li>
          ))}
        </ul>
      </Section>

      <Section title="Your reply templates" hint="50 ready-made templates are built in. Add your own here, or save any reply from the inbox. Use {{name}}, {{ref}} and {{agent}} as placeholders.">
        <div className="grid gap-2 sm:grid-cols-4">
          <input className="input" placeholder="Title" value={tpl.title} onChange={(e) => setTpl({ ...tpl, title: e.target.value })} />
          <input className="input" placeholder="Group" value={tpl.grp} onChange={(e) => setTpl({ ...tpl, grp: e.target.value })} />
          <textarea className="textarea sm:col-span-4" rows={3} placeholder={"Hi {{name}},\n\n…\n\nBest,\n{{agent}}"} value={tpl.body} onChange={(e) => setTpl({ ...tpl, body: e.target.value })} />
        </div>
        <button className="btn-primary mt-2" disabled={pending || tpl.title.trim().length < 2 || tpl.body.trim().length < 2} onClick={() => exec(() => createCannedAction(tpl), { success: "Template added", onOk: () => { setTpl({ title: "", body: "", grp: "Custom" }); router.refresh(); } })}>Add template</button>
        <ul className="mt-3 divide-y divide-line text-[13px]">
          {canned.length === 0 && <li className="py-2 text-soft">No custom templates yet.</li>}
          {canned.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-3 py-2"><div><strong>{c.title}</strong> <span className="text-[11.5px] text-soft">{c.grp}</span><p className="line-clamp-2 whitespace-pre-wrap text-soft">{c.body}</p></div><button className="btn !h-8" aria-label="Delete template" disabled={pending} onClick={() => exec(() => deleteCannedAction(c.id), { onOk: () => router.refresh() })}><Trash2 className="h-3.5 w-3.5" /></button></li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
