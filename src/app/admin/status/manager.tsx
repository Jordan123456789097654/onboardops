"use client";
import { GraphicMenu } from "./graphic-menu";
import { incidentNumber } from "@/lib/incident-number";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCircle2, ExternalLink, ShieldAlert, Sparkles } from "lucide-react";
import {
  createIncidentAction,
  deleteStatusReportAction,
  draftIncidentUpdateAction,
  endMaintenanceAction,
  saveOpsAlertWebhookAction,
  scheduleMaintenanceAction,
  setIncidentOverrideAction,
  testOpsAlertWebhookAction,
  testStatusConnectionAction,
  updateIncidentAction,
} from "@/actions/statuspage";
import { Badge, Empty, Field, Modal, useAction, useToast } from "@/components/ui";
import type { BsMonitor, BsReport, BsResource } from "@/lib/betterstack";
import type { IncidentSettings, OutageOverrideMode } from "@/lib/incidents";
import type { OutageTest as OutageTestState } from "@/lib/maintenance";
import { INCIDENT_PRESETS, MAINTENANCE_PRESETS, UPDATE_PRESETS } from "@/lib/status-presets";
import { fmtDateTime } from "@/lib/utils";
import { OutageTest } from "./outage-test";

const tone: Record<string, string> = { operational: "ACTIVE", up: "ACTIVE", resolved: "ACTIVE", degraded: "PENDING", maintenance: "PENDING", pending: "PENDING", downtime: "SUSPENDED", down: "SUSPENDED" };
const label: Record<string, string> = { operational: "Operational", up: "Up", resolved: "Resolved", degraded: "Degraded", maintenance: "Maintenance", pending: "Checking", downtime: "Downtime", down: "Down" };
const S = (v: string) => <Badge value={tone[v] ?? "PENDING"} label={label[v] ?? v} />;

type Dlg = null | "incident" | "maintenance" | { update: BsReport };
type Tab = "incidents" | "controls" | "monitors";

const OVERRIDE_OPTIONS: { value: OutageOverrideMode; title: string; desc: string }[] = [
  {
    value: "auto",
    title: "Automatic (Smart Banner / Lock)",
    desc: "Core downtime (Database, Sign-in, Core API, Website) shows the full outage screen. Non-core or degraded issues show a sticky banner so users can keep working.",
  },
  {
    value: "banner",
    title: "Force Banner Only",
    desc: "Never full-lock visitors during status page incidents — always show the top warning banner with live timeline details instead.",
  },
  {
    value: "muted",
    title: "Mute In-App Outage Screen",
    desc: "Hide the outage screen and banner inside OnboardOps (useful for monitor false positives) without deleting reports on status.onboardops.org.",
  },
];

export function StatusManager({
  configured,
  error,
  canEdit,
  aiReady,
  publicUrl,
  resources,
  reports,
  monitors,
  outageTest,
  incidentSettings,
}: {
  configured: boolean;
  error: string;
  canEdit: boolean;
  aiReady: boolean;
  publicUrl: string;
  resources: BsResource[];
  reports: BsReport[];
  monitors: BsMonitor[];
  outageTest: OutageTestState;
  incidentSettings: IncidentSettings;
}) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();
  const [tab, setTab] = useState<Tab>("incidents");
  const [dlg, setDlg] = useState<Dlg>(null);

  // Modal fields
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [kind, setKind] = useState<"degraded" | "downtime">("downtime");
  const [notify, setNotify] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [upStatus, setUpStatus] = useState<"degraded" | "downtime" | "resolved">("downtime");

  // AI drafter state (inside update modal)
  const [aiStage, setAiStage] = useState<"investigating" | "identified" | "monitoring" | "resolved">("investigating");
  const [aiNotes, setAiNotes] = useState("");

  // Controls tab state
  const [webhookInput, setWebhookInput] = useState("");

  const now = Date.now();
  const isActive = (r: BsReport) => (r.type === "maintenance" ? !!r.endsAt && Date.parse(r.endsAt) > now : r.state !== "resolved");
  const active = reports.filter(isActive);
  const past = reports.filter((r) => !isActive(r));
  const downResources = resources.filter((r) => r.status === "downtime" || r.status === "down").length;
  const degradedResources = resources.filter((r) => r.status === "degraded").length;
  const downMonitors = monitors.filter((m) => m.status === "down").length;

  const open = (d: Dlg) => {
    setTitle("");
    setMsg("");
    setPicked([]);
    setKind("downtime");
    setNotify(false);
    setStartsAt("");
    setEndsAt("");
    setUpStatus("downtime");
    setAiStage("investigating");
    setAiNotes("");
    setDlg(d);
  };
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const done = (m: string) => ({ success: m, onOk: () => { setDlg(null); router.refresh(); } });

  const pickByNames = (names: string[]) => {
    const lower = new Set(names.map((n) => n.toLowerCase()));
    const matched = resources.filter((r) => lower.has(r.name.toLowerCase())).map((r) => r.id);
    if (matched.length) setPicked(matched);
  };

  const toLocal = (ms: number) => {
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const runAiDraft = (report: BsReport) => {
    exec(
      () =>
        draftIncidentUpdateAction({
          reportTitle: report.title,
          stage: aiStage,
          affected: report.affected.map((a) => a.name),
          notes: aiNotes,
        }),
      {
        onOk: (res) => {
          setMsg(res.message);
          setUpStatus(aiStage === "resolved" ? "resolved" : aiStage === "monitoring" ? "degraded" : "downtime");
          toast("ok", "Drafted update — review and edit before posting.");
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {error && <div className="card border-red-400/50 bg-red-500/5 p-4 text-[13px]"><b>Could not load status page (Kener).</b> {error}</div>}

      {/* Top Summary Strip */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className={`card p-4 ${active.length > 0 ? "border-rose-400/60 bg-rose-500/5" : ""}`}>
          <div className="text-xs text-soft">Active reports</div>
          <div className="mono mt-1 text-2xl font-semibold">{active.length}</div>
          <div className="mt-1 text-xs text-soft">{active.length === 0 ? "All clear on status page" : `${downResources} down · ${degradedResources} degraded`}</div>
        </div>
        <div className={`card p-4 ${downMonitors > 0 ? "border-rose-400/60 bg-rose-500/5" : ""}`}>
          <div className="text-xs text-soft">Monitors healthy</div>
          <div className="mono mt-1 text-2xl font-semibold">{monitors.length - downMonitors}/{monitors.length}</div>
          <div className="mt-1 text-xs text-soft">{downMonitors > 0 ? `${downMonitors} monitor${downMonitors === 1 ? "" : "s"} currently down` : "All status page monitors up"}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-soft">In-app outage screen</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm font-semibold capitalize">{incidentSettings.overrideMode}</span>
            <Badge value={incidentSettings.overrideMode === "muted" ? "PENDING" : "ACTIVE"} label={incidentSettings.overrideMode === "auto" ? "Smart" : incidentSettings.overrideMode === "banner" ? "Banner only" : "Muted"} />
          </div>
          <div className="mt-1 text-xs text-soft">{outageTest.active ? "Outage simulator running" : "Live Kener status sync"}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-soft">Staff ops alert webhook</div>
          <div className="mt-1 flex items-center gap-2">
            {incidentSettings.webhookConfigured ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Bell className="h-4 w-4 text-soft" />}
            <span className="text-sm font-semibold">{incidentSettings.webhookConfigured ? "Connected" : "Not configured"}</span>
          </div>
          <div className="mono mt-1 truncate text-xs text-soft">{incidentSettings.webhookLabel || "Discord / Slack / Teams"}</div>
        </div>
      </div>

      {/* Action bar & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex flex-wrap gap-1.5" role="tablist">
          {([
            ["incidents", `Active & Services${active.length ? ` (${active.length})` : ""}`],
            ["controls", `Outage Screen & Alerts${outageTest.active ? " · Test On" : ""}`],
            ["monitors", `Monitors & History (${monitors.length})`],
          ] as [Tab, string][]).map(([id, text]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                tab === id ? "bg-ink text-canvas" : "text-soft hover:bg-muted hover:text-ink"
              }`}
            >
              {text}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {configured && canEdit && <button className="btn-primary" onClick={() => open("incident")}>Report an incident</button>}
          {configured && canEdit && <button className="btn" onClick={() => open("maintenance")}>Schedule maintenance</button>}
          {configured && canEdit && (
            <button className="btn" disabled={pending} onClick={() => exec(() => testStatusConnectionAction(), { onOk: (r) => toast("ok", `Connected. ${r.services} services on the page.`) })}>
              Test status API
            </button>
          )}
          <a className="btn" href="/?preview-outage=1" target="_blank" rel="noopener noreferrer">Preview outage screen</a>
          <a className="btn" href={publicUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" />Status page</a>
        </div>
      </div>

      {!configured && (
        <div className="card max-w-2xl p-5 text-[13px]">
          <h2 className="text-sm font-semibold">Connect Kener to manage public incidents</h2>
          <p className="mt-2 text-soft">Create an API key in Kener (<span className="mono text-ink">status.onboardops.org/manage</span>), add <span className="mono text-ink">KENER_API_KEY</span> to Vercel, and redeploy. Outage simulator, screen override, and ops webhook controls still work in the Controls tab.</p>
        </div>
      )}

      {/* TAB 1: Active Reports & Services */}
      {tab === "incidents" && configured && (
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Active reports</h2>
            {active.length === 0 ? (
              <Empty title="All systems operational" hint="No open incidents or maintenance reports on status.onboardops.org right now." />
            ) : (
              <div className="space-y-3">
                {active.map((r) => (
                  <div key={r.id} className="card border-rose-400/40 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">{r.title}</span>
                          {S(r.type === "maintenance" ? "maintenance" : r.state)}
                          <span className="mono rounded border border-line px-1.5 py-0.5 text-[10px] text-soft">{r.type}</span>
                        </div>
                        <p className="mono mt-1 text-[11px] text-soft">
                          {incidentNumber(r)} · #{r.id} · {fmtDateTime(r.startsAt)}{r.endsAt ? ` to ${fmtDateTime(r.endsAt)}` : ""} · {r.affected.map((a) => a.name).join(", ") || "No services"}
                        </p>
                      </div>
                      <GraphicMenu report={r} />
                      {canEdit && (
                        <div className="flex flex-wrap gap-2">
                          {r.type !== "maintenance" && <button className="btn-primary" onClick={() => open({ update: r })}>Post update</button>}
                          {r.type === "maintenance" ? (
                            <button className="btn" disabled={pending} onClick={() => exec(() => endMaintenanceAction(r.id), { success: "Maintenance ended", onOk: () => router.refresh() })}>End now</button>
                          ) : (
                            <button
                              className="btn"
                              disabled={pending}
                              onClick={() => exec(() => updateIncidentAction({ id: r.id, message: UPDATE_PRESETS[7].message, status: "resolved", notify: false }), { success: "Marked resolved", onOk: () => router.refresh() })}
                            >
                              Quick resolve
                            </button>
                          )}
                          <button
                            className="btn-danger"
                            disabled={pending}
                            onClick={() => { if (confirm("Delete this report from the public status page?")) exec(() => deleteStatusReportAction(r.id), { success: "Deleted", onOk: () => router.refresh() }); }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Services as visitors see them</h2>
            {resources.length === 0 ? (
              <Empty title="No services on the page yet" />
            ) : (
              <div className="overflow-hidden rounded-lg border border-line bg-surface">
                <table className="w-full text-[13px]">
                  <tbody className="divide-y divide-line">
                    {resources.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-2.5 font-medium">{r.name}</td>
                        <td className="px-4 py-2.5 text-right">{S(r.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: Outage Screen Override, Ops Alerts & Outage Test */}
      {tab === "controls" && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* In-App Outage Screen Override */}
            <section className="card space-y-3 p-5 text-[13px]">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold">In-app outage screen behavior</h2>
              </div>
              <p className="text-soft">
                Control how <span className="mono text-ink">onboardops.org</span> reacts when the status page reports an active incident. Use <b>Mute</b> to silence monitor false positives without deleting public reports.
              </p>
              <div className="space-y-2">
                {OVERRIDE_OPTIONS.map((opt) => {
                  const selected = incidentSettings.overrideMode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={!canEdit || pending}
                      onClick={() => exec(() => setIncidentOverrideAction({ mode: opt.value }), { success: `Outage screen set to ${opt.title}`, onOk: () => router.refresh() })}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        selected ? "border-accent bg-accent/5" : "border-line hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-ink">{opt.title}</span>
                        {selected && <Badge value="ACTIVE" label="Active" />}
                      </div>
                      <p className="mt-1 text-xs text-soft">{opt.desc}</p>
                    </button>
                  );
                })}
              </div>
              {incidentSettings.updatedAt && (
                <p className="text-xs text-soft">Last changed {fmtDateTime(incidentSettings.updatedAt)} by {incidentSettings.updatedBy ?? "Owner"}.</p>
              )}
            </section>

            {/* Staff Ops Alert Webhook (Discord / Slack / Teams) */}
            <section className="card space-y-3 p-5 text-[13px]">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold">Staff incident alert webhook (Discord / Slack / Teams)</h2>
              </div>
              <p className="text-soft">
                Automatically post an embed to your private ops channel whenever the status page opens or resolves an outage, or when staff publish a manual status update. Stored encrypted.
              </p>
              <div className="rounded-md border border-line bg-muted/40 px-3 py-2 text-xs">
                Status: <b>{incidentSettings.webhookConfigured ? `Connected (${incidentSettings.webhookLabel})` : "Not configured"}</b>
              </div>
              {canEdit ? (
                <>
                  <Field label="Discord, Slack, or Teams webhook URL">
                    <input
                      className="input mono"
                      type="password"
                      autoComplete="off"
                      value={webhookInput}
                      onChange={(e) => setWebhookInput(e.target.value)}
                      placeholder={incidentSettings.webhookConfigured ? "Paste a new URL to replace…" : "https://discord.com/api/webhooks/…"}
                    />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn-primary"
                      disabled={pending || !webhookInput.trim()}
                      onClick={() =>
                        exec(() => saveOpsAlertWebhookAction({ url: webhookInput.trim() }), {
                          success: "Ops alert webhook saved",
                          onOk: () => { setWebhookInput(""); router.refresh(); },
                        })
                      }
                    >
                      Save webhook
                    </button>
                    {incidentSettings.webhookConfigured && (
                      <>
                        <button className="btn" disabled={pending} onClick={() => exec(() => testOpsAlertWebhookAction(), { success: "Test alert sent to your channel" })}>
                          Send test alert
                        </button>
                        <button
                          className="btn-danger"
                          disabled={pending}
                          onClick={() => {
                            if (confirm("Remove the staff incident alert webhook?")) {
                              exec(() => saveOpsAlertWebhookAction({ url: null }), { success: "Webhook removed", onOk: () => router.refresh() });
                            }
                          }}
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-xs text-soft">Only the site owner can manage the ops alert webhook.</p>
              )}
            </section>
          </div>

          <OutageTest canEdit={canEdit} active={outageTest.active} services={outageTest.services} until={outageTest.until} startedBy={outageTest.startedBy} />
        </div>
      )}

      {/* TAB 3: Monitors & Recent History */}
      {tab === "monitors" && configured && (
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-sm font-semibold">Monitors behind the page</h2>
            <div className="overflow-hidden rounded-lg border border-line bg-surface">
              <table className="w-full text-[13px]">
                <tbody className="divide-y divide-line">
                  {monitors.map((m) => (
                    <tr key={m.id}>
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{m.name}</div>
                        <div className="mono text-[11px] text-soft">{m.url}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right">{S(m.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-soft">Monitor results automatically control Operational / Downtime states on status.onboardops.org.</p>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold">Recent report history</h2>
            {past.length === 0 ? (
              <Empty title="No past reports yet" />
            ) : (
              <div className="overflow-hidden rounded-lg border border-line bg-surface">
                <table className="w-full text-[13px]">
                  <tbody className="divide-y divide-line">
                    {past.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-2.5">
                          <div className="font-medium">{r.title}</div>
                          <div className="mono text-[11px] text-soft">{incidentNumber(r)} · {fmtDateTime(r.startsAt)} · {r.affected.map((a) => a.name).join(", ")}</div>
                        </td>
                        <td className="px-4 py-2.5 text-right">{S(r.type === "maintenance" ? "resolved" : r.state)}</td>
                        <td className="px-4 py-2.5"><GraphicMenu report={r} /></td>
                        {canEdit && (
                          <td className="px-4 py-2.5 text-right">
                            <button
                              className="text-xs text-soft underline"
                              disabled={pending}
                              onClick={() => { if (confirm("Delete this report from the public status page?")) exec(() => deleteStatusReportAction(r.id), { success: "Deleted", onOk: () => router.refresh() }); }}
                            >
                              Delete
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* MODAL: New Incident or Schedule Maintenance (with rich long-form presets) */}
      <Modal open={dlg === "incident" || dlg === "maintenance"} onClose={() => setDlg(null)} title={dlg === "maintenance" ? "Schedule status page maintenance" : "Report a public incident"}>
        <div className="space-y-3 text-[13px]">
          {dlg === "incident" ? (
            <div>
              <div className="mb-1.5 text-xs font-medium text-soft">Long-form incident templates ({INCIDENT_PRESETS.length} presets — click to fill title, message & services)</div>
              <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-line bg-muted/30 p-2">
                {INCIDENT_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    className="btn !h-7 !px-2.5 !text-xs"
                    onClick={() => {
                      setTitle(p.title);
                      setMsg(p.message);
                      setKind(p.status);
                      pickByNames(p.resources);
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-1.5 text-xs font-medium text-soft">Maintenance templates ({MAINTENANCE_PRESETS.length} presets — click to fill)</div>
              <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-line bg-muted/30 p-2">
                {MAINTENANCE_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    className="btn !h-7 !px-2.5 !text-xs"
                    onClick={() => {
                      setTitle(p.title);
                      setMsg(p.message);
                      const startMs = Date.now() + 30 * 60_000;
                      setStartsAt(toLocal(startMs));
                      setEndsAt(toLocal(startMs + p.durationMinutes * 60_000));
                      setPicked(resources.map((r) => r.id));
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Field label="Title">
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={dlg === "maintenance" ? "Scheduled database upgrade" : "Service disruption across core APIs"} />
          </Field>

          <Field label={`Message shown to visitors (${msg.length}/4000)`}>
            <textarea className="textarea" rows={7} maxLength={4000} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Write a clear multi-paragraph update explaining impact, data safety, and next steps..." />
          </Field>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-soft">
              <span>Affected services</span>
              <button type="button" className="text-accent underline" onClick={() => setPicked(picked.length === resources.length ? [] : resources.map((r) => r.id))}>
                {picked.length === resources.length ? "Clear all" : "Select all"}
              </button>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {resources.map((r) => (
                <label key={r.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={picked.includes(r.id)} onChange={() => toggle(r.id)} />
                  {r.name}
                </label>
              ))}
            </div>
          </div>

          {dlg === "incident" && (
            <Field label="Severity">
              <select className="input" value={kind} onChange={(e) => setKind(e.target.value as "degraded" | "downtime")}>
                <option value="downtime">Downtime (service unavailable)</option>
                <option value="degraded">Degraded (slow or partly working)</option>
              </select>
            </Field>
          )}

          {dlg === "maintenance" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Starts"><input className="input mono text-xs" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></Field>
              <Field label="Ends"><input className="input mono text-xs" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></Field>
            </div>
          )}

          <label className="flex items-center gap-2"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />Email status page subscribers</label>
          <p className="text-xs text-soft">Published immediately on status.onboardops.org and synced to the in-app outage screen.</p>
          <button
            className="btn-primary w-full"
            disabled={pending}
            onClick={() => {
              if (dlg === "maintenance") {
                exec(() => scheduleMaintenanceAction({ title, message: msg, resourceIds: picked, startsAt: startsAt ? new Date(startsAt).toISOString() : "", endsAt: endsAt ? new Date(endsAt).toISOString() : "", notify }), done("Maintenance scheduled"));
              } else {
                exec(() => createIncidentAction({ title, message: msg, resourceIds: picked, status: kind, notify }), done("Incident posted"));
              }
            }}
          >
            {dlg === "maintenance" ? "Schedule maintenance" : "Post incident"}
          </button>
        </div>
      </Modal>

      {/* MODAL: Post Update on Active Incident (with presets + AI Drafter) */}
      <Modal open={!!dlg && typeof dlg === "object"} onClose={() => setDlg(null)} title="Post an incident update">
        {dlg && typeof dlg === "object" && (
          <div className="space-y-3 text-[13px]">
            <div className="rounded-md border border-line bg-muted/40 px-3 py-2 text-xs">
              <div className="font-semibold text-ink">{dlg.update.title}</div>
              <div className="mono mt-0.5 text-soft">Report #{dlg.update.id} · {dlg.update.affected.map((a) => a.name).join(", ") || "All affected services"}</div>
            </div>

            {/* Premade update presets */}
            <div>
              <div className="mb-1.5 text-xs font-medium text-soft">Detailed update templates ({UPDATE_PRESETS.length} presets — click to fill)</div>
              <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-line bg-muted/30 p-2">
                {UPDATE_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    className="btn !h-7 !px-2.5 !text-xs"
                    onClick={() => {
                      setMsg(p.message);
                      setUpStatus(p.status);
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* AI Update / Postmortem Drafter */}
            <div className="rounded-md border border-accent/30 bg-accent/5 p-3">
              <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold">
                <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-accent" />Draft with AI (Groq)</span>
                {!aiReady && <span className="font-normal text-soft">Set GROQ_API_KEYS to enable</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <select className="input !h-8 !w-auto text-xs" value={aiStage} onChange={(e) => setAiStage(e.target.value as typeof aiStage)}>
                  <option value="investigating">Investigating</option>
                  <option value="identified">Root cause identified</option>
                  <option value="monitoring">Monitoring recovery</option>
                  <option value="resolved">Resolved (Post-incident summary)</option>
                </select>
                <input
                  className="input !h-8 min-w-[160px] flex-1 text-xs"
                  value={aiNotes}
                  onChange={(e) => setAiNotes(e.target.value)}
                  placeholder="Optional internal notes (e.g. Vercel domain config, Neon pooler)..."
                />
                <button type="button" className="btn !h-8 text-xs" disabled={pending || !aiReady} onClick={() => runAiDraft(dlg.update)}>
                  <Sparkles className="h-3 w-3" />Draft
                </button>
              </div>
            </div>

            <Field label={`Update message (${msg.length}/4000)`}>
              <textarea className="textarea" rows={7} maxLength={4000} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Share what we found, current impact, and when the next update will be posted..." />
            </Field>

            <Field label="Status after this update">
              <select className="input" value={upStatus} onChange={(e) => setUpStatus(e.target.value as "degraded" | "downtime" | "resolved")}>
                <option value="downtime">Downtime (still down)</option>
                <option value="degraded">Degraded (partially working / monitoring)</option>
                <option value="resolved">Resolved (mark incident closed)</option>
              </select>
            </Field>

            <label className="flex items-center gap-2"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />Email status page subscribers</label>
            <button
              className="btn-primary w-full"
              disabled={pending || msg.trim().length < 3}
              onClick={() => exec(() => updateIncidentAction({ id: dlg.update.id, message: msg, status: upStatus, notify }), done("Update posted"))}
            >
              Post update
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
