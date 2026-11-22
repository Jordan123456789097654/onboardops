"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveDepartmentAction, saveJobRoleAction, saveSettingsAction, saveWorkspaceMetaAction, testWebhookAction } from "@/actions/settings";
import { setMemberRoleAction } from "@/actions/features";
import { FeaturesPanel } from "./features-panel";
import { FieldsPanel } from "./fields-panel";
import { IntegrationsPanel } from "./integrations-panel";
import { RolesPanel } from "./roles-panel";
import { closeWorkspaceAction, runRemindersNowAction } from "@/actions/workspace";
import { DomainPanel } from "./domain-panel";
import type { DomainDetails } from "@/lib/vercel-domains";
import { Badge, Field, Modal, PageHeader, Tabs, useAction, useToast } from "@/components/ui";

type Dept = { id?: string; name: string; colorCode: string };
type JobRole = { id?: string; title: string; description: string; requiredCourseIds: string[] };

export function Settings({ integrations, customFields, features, rolePerms, customRoles, customRolesOn, domain, isOwner, ws, departments, roles, courses, members }: {
  customFields: { id: string; label: string; type: "text" | "date" | "select" | "yesno"; options: string[]; showToEmployee: boolean }[];
  integrations: { keys: { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null }[]; webhookUrl: string; locations: { id: string; name: string; address: string; timezone: string }[]; sms: { configured: boolean; sid: string; from: string }; bamboo: { configured: boolean; subdomain: string } };
  features: Record<string, boolean>; rolePerms: Record<string, string[]>; customRoles: { id: string; name: string; description: string; baseRole: string; members: number }[]; customRolesOn: boolean;
  domain: { address: { enabled: boolean; slug: string; status: string; zone: string; isOwner: boolean }; slug: string; baseUrl: string; name: string | null; status: string; details: DomainDetails | null; vercel: boolean };
  isOwner: boolean;
  ws: { publicCerts: boolean; decayDays: number; accent: string; tagline: string; name: string; ops: string; conf: string; threshold: number; retrain: boolean; reminders: boolean };
  departments: Required<Dept>[]; roles: Required<JobRole>[]; courses: { id: string; title: string }[]; members: { id: string; name: string; email: string; role: string; customRoleId: string | null }[];
}) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const toast = useToast();
  const [tab, setTab] = useState("workspace");
  const [s, setS] = useState({ name: ws.name, operationsWebhookUrl: ws.ops, confidentialWebhookUrl: ws.conf, autoSuspendStrikeThreshold: ws.threshold, autoRetrainOnWrittenInfraction: ws.retrain, remindersEnabled: ws.reminders });
  const [meta, setMeta] = useState({ publicCerts: ws.publicCerts, strikeDecayDays: ws.decayDays, accentColor: ws.accent, tagline: ws.tagline });
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeName, setCloseName] = useState("");
  const [closePw, setClosePw] = useState("");
  const [dept, setDept] = useState<Dept | null>(null);
  const [role, setRole] = useState<JobRole | null>(null);
  const done = () => router.refresh();

  return (
    <>
      <PageHeader title="Workspace Settings" sub="Webhooks, automation thresholds, departments, job roles and access." />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "workspace", label: "Automation & Webhooks" }, { id: "structure", label: "Departments & Job Roles" }, { id: "access", label: "Access" }, { id: "roles", label: "Roles & permissions" }, { id: "features", label: "Features" }, { id: "fields", label: "Custom fields" }, { id: "integrations", label: "Integrations" }, { id: "domain", label: "Sign-in & domain" }, { id: "data", label: "Data & privacy" }]} />
      <div className={`mt-4 ${tab === "roles" ? "" : "max-w-3xl"}`}>
        {tab === "workspace" && (
          <div className="card space-y-4 p-4">
            <Field label="Workspace name"><input className="input" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Auto-suspend at strike points"><input className="input mono" type="number" min={1} max={50} value={s.autoSuspendStrikeThreshold} onChange={(e) => setS({ ...s, autoSuspendStrikeThreshold: Number(e.target.value) })} /></Field>
              <label className="flex items-start gap-2 pt-5 text-[13px]"><input type="checkbox" className="mt-0.5" checked={s.autoRetrainOnWrittenInfraction} onChange={(e) => setS({ ...s, autoRetrainOnWrittenInfraction: e.target.checked })} />Auto-assign the remedial course on a written infraction or 2+ points</label>
            </div>
            <label className="flex items-start gap-2 text-[13px]"><input type="checkbox" className="mt-0.5" checked={s.remindersEnabled} onChange={(e) => setS({ ...s, remindersEnabled: e.target.checked })} />Send training reminders and expire certifications automatically (runs daily)</label>
            {([["operationsWebhookUrl", "Operations webhook", "operations", "Hires, certifications. Safe for a team channel."], ["confidentialWebhookUrl", "Confidential HR webhook", "confidential", "Infractions, status changes. Point this at a private channel."]] as const).map(([k, label, kind, hint]) => (
              <div key={k}>
                <Field label={`${label} (Discord, Slack or Teams)`}><input className="input mono" placeholder="https://discord.com/api/webhooks/…" value={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.value })} /></Field>
                <div className="mt-1 flex items-center justify-between"><span className="text-xs text-soft">{hint}</span><button className="btn" disabled={pending} onClick={() => exec(() => testWebhookAction(kind, s[k]), { success: "Test embed sent" })}>Send Test Embed</button></div>
              </div>
            ))}
            <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-3">
              <Field label="Strike decay window (days, 0 = off)"><input className="input mono" type="number" min={0} max={730} value={meta.strikeDecayDays} onChange={(e) => setMeta({ ...meta, strikeDecayDays: Number(e.target.value) })} /></Field>
              <Field label="Brand color (#RRGGBB)"><input className="input mono" placeholder="#1D4ED8" value={meta.accentColor} onChange={(e) => setMeta({ ...meta, accentColor: e.target.value })} /></Field>
              <Field label="Tagline"><input className="input" maxLength={140} value={meta.tagline} onChange={(e) => setMeta({ ...meta, tagline: e.target.value })} /></Field>
            </div>
            <label className="flex items-start gap-2 text-[13px] sm:col-span-3"><input type="checkbox" className="mt-0.5" checked={meta.publicCerts} onChange={(e) => setMeta({ ...meta, publicCerts: e.target.checked })} />Let anyone confirm a training certificate by its code on onboardops.org/verify. When on, the page shows the employee&apos;s name, the course, your company name and the dates. Turn it off to confirm only that the certificate is real.</label>
            <button className="btn" disabled={pending} onClick={() => exec(() => saveWorkspaceMetaAction(meta), { success: "Decay and branding saved", onOk: done })}>Save decay and branding</button>
            <button className="btn-primary" disabled={pending} onClick={() => exec(() => saveSettingsAction(s), { success: "Settings saved", onOk: done })}>Save settings</button>
          </div>
        )}
        {tab === "structure" && (
          <div className="space-y-6">
            <section>
              <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">Departments</h2><button className="btn" onClick={() => setDept({ name: "", colorCode: "#52525B" })}>Add department</button></div>
              <div className="card divide-y divide-line">{departments.map((d) => <div key={d.id} className="flex items-center gap-3 px-3 py-2 text-[13px]"><span className="h-3 w-3 rounded-sm" style={{ background: d.colorCode }} /><span className="flex-1">{d.name}</span><span className="mono text-xs text-soft">{d.colorCode}</span><button className="btn" onClick={() => setDept(d)}>Edit</button></div>)}</div>
            </section>
            <section>
              <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">Job roles and required courses</h2><button className="btn" onClick={() => setRole({ title: "", description: "", requiredCourseIds: [] })}>Add job role</button></div>
              <div className="card divide-y divide-line">{roles.map((r) => <div key={r.id} className="flex items-center gap-3 px-3 py-2 text-[13px]"><div className="flex-1"><div className="font-medium">{r.title}</div><div className="text-xs text-soft">{r.requiredCourseIds.map((id) => courses.find((c) => c.id === id)?.title).filter(Boolean).join(" · ") || "No required courses"}</div></div><button className="btn" onClick={() => setRole(r)}>Edit</button></div>)}</div>
              <p className="mt-2 text-xs text-soft">Assigning a job role to an employee enrolls them in every required course and sets readiness to Pending.</p>
            </section>
          </div>
        )}
        {tab === "domain" && <DomainPanel address={domain.address} slug={domain.slug} baseUrl={domain.baseUrl} domain={domain.name} status={domain.status} details={domain.details} vercel={domain.vercel} />}
        {tab === "data" && (
          <div className="space-y-4">
            <div className="card p-4 text-[13px]"><h2 className="text-sm font-semibold">Export everything</h2><p className="mt-1 text-soft">A JSON file with employees, courses, enrollments, cases (including confidential notes), checklists, policies, incident reports, reviews and the audit log. Uploaded files are listed but not included. Each export is recorded in the audit log.</p><a className="btn-primary mt-3" href="/api/export/workspace">Download workspace export</a></div>
            <div className="card p-4 text-[13px]"><h2 className="text-sm font-semibold">Run reminders now</h2><p className="mt-1 text-soft">The daily job expires lapsed certifications, warns before they lapse, and nudges people with due or overdue training. Run it now to see what it would send.</p><button className="btn mt-3" disabled={pending} onClick={() => exec(() => runRemindersNowAction(), { onOk: (r) => toast("ok", `${r.expired} expired, ${r.expiringNotices} expiry notices, ${r.dueReminders} due soon, ${r.overdueReminders} overdue reminders`) })}>Run reminders</button></div>
            {isOwner && <div className="card border-rose-300 p-4 text-[13px]"><h2 className="text-sm font-semibold">Close workspace</h2><p className="mt-1 text-soft">Permanently delete this workspace and all of its data. Only the owner can do this.</p><button className="btn-danger mt-3" onClick={() => setCloseOpen(true)}>Close workspace…</button></div>}
          </div>
        )}
        {tab === "roles" && <RolesPanel initial={rolePerms} customRoles={customRoles} customEnabled={customRolesOn} />}
        {tab === "integrations" && <IntegrationsPanel keys={integrations.keys} webhookUrl={integrations.webhookUrl} locations={integrations.locations} sms={integrations.sms} bamboo={integrations.bamboo} />}
        {tab === "fields" && <FieldsPanel initial={customFields} />}
        {tab === "features" && <FeaturesPanel initial={features} />}
        {tab === "access" && (
          <div className="card divide-y divide-line">{members.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-[13px]">
              <div className="min-w-0 flex-1"><div className="font-medium">{m.name}</div><div className="mono text-xs text-soft">{m.email}</div></div>
              {m.role === "OWNER" ? <Badge value="ACTIVE" label="OWNER" /> : (
                <select className="input !w-48" value={m.customRoleId ? `custom:${m.customRoleId}` : m.role} onChange={(e) => { const v = e.target.value; exec(() => setMemberRoleAction(m.id, v.startsWith("custom:") ? { customRoleId: v.slice(7) } : { role: v }), { success: "Role updated", onOk: done }); }}>
                  {["ADMIN", "MANAGER", "SUPERVISOR", "EMPLOYEE"].filter((r) => r !== "ADMIN" || isOwner || m.role === "ADMIN").map((r) => <option key={r} value={r}>{r}</option>)}
                  {customRolesOn && customRoles.map((r) => <option key={r.id} value={`custom:${r.id}`}>{r.name} (custom)</option>)}
                </select>)}
            </div>))}</div>
        )}
      </div>
      <Modal open={closeOpen} onClose={() => setCloseOpen(false)} title="Close this workspace">
        <div className="space-y-3 text-[13px]">
          <p className="rounded-md border border-rose-300 bg-rose-50 p-3 text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">This permanently deletes the workspace, every employee record, case, document, policy and audit entry. It cannot be undone. Download the export first.</p>
          <Field label="Type the workspace name to confirm"><input className="input" value={closeName} onChange={(e) => setCloseName(e.target.value)} placeholder={ws.name} /></Field>
          <Field label="Your password"><input className="input" type="password" value={closePw} onChange={(e) => setClosePw(e.target.value)} autoComplete="current-password" /></Field>
          <button className="btn-danger w-full" disabled={pending || closeName !== ws.name || !closePw} onClick={() => exec(() => closeWorkspaceAction({ confirmName: closeName, password: closePw }))}>Delete workspace permanently</button>
        </div>
      </Modal>
      <Modal open={!!dept} onClose={() => setDept(null)} title={dept?.id ? "Edit department" : "Add department"}>
        {dept && <div className="space-y-3"><Field label="Name"><input className="input" value={dept.name} onChange={(e) => setDept({ ...dept, name: e.target.value })} /></Field><Field label="Color"><input className="input mono" value={dept.colorCode} onChange={(e) => setDept({ ...dept, colorCode: e.target.value })} /></Field>
          <button className="btn-primary w-full" disabled={pending} onClick={() => exec(() => saveDepartmentAction(dept), { success: "Department saved", onOk: () => { setDept(null); done(); } })}>Save</button></div>}
      </Modal>
      <Modal open={!!role} onClose={() => setRole(null)} title={role?.id ? "Edit job role" : "Add job role"}>
        {role && <div className="space-y-3"><Field label="Title"><input className="input" value={role.title} onChange={(e) => setRole({ ...role, title: e.target.value })} /></Field><Field label="Description"><input className="input" value={role.description} onChange={(e) => setRole({ ...role, description: e.target.value })} /></Field>
          <div><span className="label">Required courses</span><div className="space-y-1">{courses.map((c) => <label key={c.id} className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={role.requiredCourseIds.includes(c.id)} onChange={() => setRole({ ...role, requiredCourseIds: role.requiredCourseIds.includes(c.id) ? role.requiredCourseIds.filter((x) => x !== c.id) : [...role.requiredCourseIds, c.id] })} />{c.title}</label>)}</div></div>
          <button className="btn-primary w-full" disabled={pending} onClick={() => exec(() => saveJobRoleAction(role), { success: "Job role saved", onOk: () => { setRole(null); done(); } })}>Save</button></div>}
      </Modal>
    </>
  );
}
