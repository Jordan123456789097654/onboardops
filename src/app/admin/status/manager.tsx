"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { createIncidentAction, deleteStatusReportAction, endMaintenanceAction, scheduleMaintenanceAction, testStatusConnectionAction, updateIncidentAction } from "@/actions/statuspage";
import { Badge, Empty, Field, Modal, useAction, useToast } from "@/components/ui";
import type { BsMonitor, BsReport, BsResource } from "@/lib/betterstack";
import { fmtDateTime } from "@/lib/utils";

const tone: Record<string, string> = { operational: "ACTIVE", up: "ACTIVE", resolved: "ACTIVE", degraded: "PENDING", maintenance: "PENDING", pending: "PENDING", downtime: "SUSPENDED", down: "SUSPENDED" };
const label: Record<string, string> = { operational: "Operational", up: "Up", resolved: "Resolved", degraded: "Degraded", maintenance: "Maintenance", pending: "Checking", downtime: "Downtime", down: "Down" };
const S = (v: string) => <Badge value={tone[v] ?? "PENDING"} label={label[v] ?? v} />;

type Dlg = null | "incident" | "maintenance" | { update: BsReport };

export function StatusManager({ configured, error, canEdit, publicUrl, resources, reports, monitors }: { configured: boolean; error: string; canEdit: boolean; publicUrl: string; resources: BsResource[]; reports: BsReport[]; monitors: BsMonitor[] }) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();
  const [dlg, setDlg] = useState<Dlg>(null);
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [kind, setKind] = useState<"degraded" | "downtime">("degraded");
  const [notify, setNotify] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [upStatus, setUpStatus] = useState<"degraded" | "downtime" | "resolved">("resolved");

  const now = Date.now();
  const isActive = (r: BsReport) => (r.type === "maintenance" ? !!r.endsAt && Date.parse(r.endsAt) > now : r.state !== "resolved");
  const active = reports.filter(isActive);
  const past = reports.filter((r) => !isActive(r));
  const open = (d: Dlg) => { setTitle(""); setMsg(""); setPicked([]); setKind("degraded"); setNotify(false); setStartsAt(""); setEndsAt(""); setUpStatus("resolved"); setDlg(d); };
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const done = (m: string) => ({ success: m, onOk: () => { setDlg(null); router.refresh(); } });

  if (!configured) {
    return (
      <div className="card max-w-2xl p-5 text-[13px]">
        <h2 className="text-sm font-semibold">Connect Better Stack to use this page</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-soft">
          <li>In Better Stack, open API tokens and create an Uptime API token for your team.</li>
          <li>In Vercel, add it to the project as the environment variable <span className="mono text-ink">BETTERSTACK_API_TOKEN</span>.</li>
          <li>If your status page is not the one this site was set up with, also set <span className="mono text-ink">BETTERSTACK_STATUS_PAGE_ID</span>.</li>
          <li>Redeploy once, then reload this page.</li>
        </ol>
        <p className="mt-3 text-soft">Until then the public status page still works from its monitors. Only the automatic maintenance and degraded notices, and this manager, are off.</p>
        <a className="btn mt-4 inline-flex" href={publicUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" />Open the status page</a>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && <div className="card border-red-400/50 bg-red-500/5 p-4 text-[13px]"><b>Could not load the status page.</b> {error}</div>}

      <div className="flex flex-wrap items-center gap-2">
        {canEdit && <button className="btn-primary" onClick={() => open("incident")}>Report an incident</button>}
        {canEdit && <button className="btn" onClick={() => open("maintenance")}>Schedule maintenance</button>}
        {canEdit && <button className="btn" disabled={pending} onClick={() => exec(() => testStatusConnectionAction(), { onOk: (r) => toast("ok", `Connected. ${r.services} services on the page.`) })}>Test connection</button>}
        <a className="btn" href={publicUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" />Open status page</a>
        {!canEdit && <span className="text-xs text-soft">Only the site owner can post changes.</span>}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Services as visitors see them</h2>
        {resources.length === 0 ? <Empty title="No services on the page yet" /> : (
          <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full text-[13px]"><tbody className="divide-y divide-line">
              {resources.map((r) => <tr key={r.id}><td className="px-4 py-2">{r.name}</td><td className="px-4 py-2 text-right">{S(r.status)}</td></tr>)}
            </tbody></table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Active reports</h2>
        {active.length === 0 ? <Empty title="Nothing active" hint="No open incidents or maintenance right now." /> : (
          <div className="space-y-3">
            {active.map((r) => (
              <div key={r.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">{r.title}</span>{S(r.type === "maintenance" ? "maintenance" : r.state)}</div>
                    <p className="mono mt-1 text-[11px] text-soft">{fmtDateTime(r.startsAt)}{r.endsAt ? ` to ${fmtDateTime(r.endsAt)}` : ""} · {r.affected.map((a) => a.name).join(", ") || "No services"}</p>
                  </div>
                  {canEdit && (
                    <div className="flex flex-wrap gap-2">
                      {r.type !== "maintenance" && <button className="btn" onClick={() => { open({ update: r }); }}>Post update</button>}
                      {r.type === "maintenance" ? <button className="btn" disabled={pending} onClick={() => exec(() => endMaintenanceAction(r.id), { success: "Maintenance ended", onOk: () => router.refresh() })}>End now</button> : <button className="btn" disabled={pending} onClick={() => exec(() => updateIncidentAction({ id: r.id, message: "This has been resolved.", status: "resolved", notify: false }), { success: "Marked resolved", onOk: () => router.refresh() })}>Resolve</button>}
                      <button className="btn-danger" disabled={pending} onClick={() => { if (confirm("Delete this report from the public page?")) exec(() => deleteStatusReportAction(r.id), { success: "Deleted", onOk: () => router.refresh() }); }}>Delete</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold">Recent history</h2>
          <div className="overflow-hidden rounded-lg border border-line"><table className="w-full text-[13px]"><tbody className="divide-y divide-line">
            {past.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2"><div className="font-medium">{r.title}</div><div className="mono text-[11px] text-soft">{fmtDateTime(r.startsAt)} · {r.affected.map((a) => a.name).join(", ")}</div></td>
                <td className="px-4 py-2 text-right">{S(r.type === "maintenance" ? "resolved" : r.state)}</td>
                {canEdit && <td className="px-4 py-2 text-right"><button className="text-xs text-soft underline" disabled={pending} onClick={() => { if (confirm("Delete this report from the public page?")) exec(() => deleteStatusReportAction(r.id), { success: "Deleted", onOk: () => router.refresh() }); }}>Delete</button></td>}
              </tr>
            ))}
          </tbody></table></div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold">Monitors behind the page</h2>
        <div className="overflow-hidden rounded-lg border border-line"><table className="w-full text-[13px]"><tbody className="divide-y divide-line">
          {monitors.map((m) => <tr key={m.id}><td className="px-4 py-2"><div>{m.name}</div><div className="mono text-[11px] text-soft">{m.url}</div></td><td className="px-4 py-2 text-right">{S(m.status)}</td></tr>)}
        </tbody></table></div>
        <p className="mt-2 text-xs text-soft">Add or remove monitors in Better Stack. Their results set Operational and Down on the page by themselves.</p>
      </section>

      <Modal open={dlg === "incident" || dlg === "maintenance"} onClose={() => setDlg(null)} title={dlg === "maintenance" ? "Schedule maintenance" : "Report an incident"}>
        <div className="space-y-3 text-[13px]">
          <Field label="Title"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={dlg === "maintenance" ? "Database upgrade" : "Sign-in is slow"} /></Field>
          <Field label="Message shown to visitors"><textarea className="textarea" rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} /></Field>
          <div>
            <div className="mb-1.5 text-xs font-medium text-soft">Affected services</div>
            <div className="grid gap-1.5 sm:grid-cols-2">{resources.map((r) => <label key={r.id} className="flex items-center gap-2"><input type="checkbox" checked={picked.includes(r.id)} onChange={() => toggle(r.id)} />{r.name}</label>)}</div>
          </div>
          {dlg === "incident" && (
            <Field label="How bad is it?"><select className="input" value={kind} onChange={(e) => setKind(e.target.value as "degraded" | "downtime")}><option value="degraded">Degraded (slow or partly working)</option><option value="downtime">Downtime (not working)</option></select></Field>
          )}
          {dlg === "maintenance" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Starts"><input className="input mono text-xs" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></Field>
              <Field label="Ends"><input className="input mono text-xs" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></Field>
            </div>
          )}
          <label className="flex items-center gap-2"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />Email subscribers about this</label>
          <p className="text-xs text-soft">This is public on the status page as soon as you post it. Times use your computer&apos;s time zone.</p>
          <button className="btn-primary w-full" disabled={pending} onClick={() => {
            if (dlg === "maintenance") exec(() => scheduleMaintenanceAction({ title, message: msg, resourceIds: picked, startsAt: startsAt ? new Date(startsAt).toISOString() : "", endsAt: endsAt ? new Date(endsAt).toISOString() : "", notify }), done("Maintenance scheduled"));
            else exec(() => createIncidentAction({ title, message: msg, resourceIds: picked, status: kind, notify }), done("Incident posted"));
          }}>{dlg === "maintenance" ? "Schedule maintenance" : "Post incident"}</button>
        </div>
      </Modal>

      <Modal open={!!dlg && typeof dlg === "object"} onClose={() => setDlg(null)} title="Post an update">
        {dlg && typeof dlg === "object" && (
          <div className="space-y-3 text-[13px]">
            <p className="text-soft">{dlg.update.title}</p>
            <Field label="Update"><textarea className="textarea" rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} /></Field>
            <Field label="Status after this update"><select className="input" value={upStatus} onChange={(e) => setUpStatus(e.target.value as "degraded" | "downtime" | "resolved")}><option value="resolved">Resolved</option><option value="degraded">Still degraded</option><option value="downtime">Downtime</option></select></Field>
            <label className="flex items-center gap-2"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />Email subscribers</label>
            <button className="btn-primary w-full" disabled={pending} onClick={() => exec(() => updateIncidentAction({ id: dlg.update.id, message: msg, status: upStatus, notify }), done("Update posted"))}>Post update</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
