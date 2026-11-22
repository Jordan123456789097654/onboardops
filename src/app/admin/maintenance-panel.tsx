"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Wrench } from "lucide-react";
import { setMaintenanceModeAction } from "@/actions/admin";
import { Badge, Field, Modal, useAction } from "@/components/ui";
import type { MaintenanceState } from "@/lib/maintenance";
import { fmtDateTime } from "@/lib/utils";

const PRESETS: { label: string; message: string; eta: string }[] = [
  {
    label: "Scheduled Upgrade",
    message: "OnboardOps is currently undergoing scheduled system upgrades and performance improvements. All workspace data is safe and we will be back online shortly.",
    eta: "~30 minutes",
  },
  {
    label: "Database Maintenance",
    message: "We are performing scheduled database maintenance and indexing to keep OnboardOps fast and reliable. Your employee records and audit logs remain completely intact.",
    eta: "~45 minutes",
  },
  {
    label: "Security Patch",
    message: "We are deploying routine security patches and infrastructure hardening updates. Services will resume shortly.",
    eta: "~20 minutes",
  },
  {
    label: "New Feature Rollout",
    message: "We are rolling out a new OnboardOps release with updated workspace tools and features. Hang tight while we finish the deployment!",
    eta: "~15 minutes",
  },
  {
    label: "Emergency Hotfix",
    message: "Our team is applying an urgent hotfix to resolve a service issue. Thank you for your patience while we restore full operations.",
    eta: "Shortly",
  },
  {
    label: "Infrastructure Migration",
    message: "We are upgrading server infrastructure to expand capacity. Workspaces are temporarily locked during the transition to keep records consistent.",
    eta: "~1 hour",
  },
];

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MaintenancePanel({ initial, canManage }: { initial: MaintenanceState; canManage: boolean }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(initial.message);
  const [eta, setEta] = useState(initial.eta ?? "");
  const [startsAt, setStartsAt] = useState(toLocalInput(initial.startsAt));
  const [endsAt, setEndsAt] = useState(toLocalInput(initial.endsAt));

  const save = (lockNow: boolean) => {
    const startIso = startsAt ? new Date(startsAt).toISOString() : null;
    const endIso = endsAt ? new Date(endsAt).toISOString() : null;
    exec(() => setMaintenanceModeAction({ enabled: lockNow, message, eta, startsAt: startIso, endsAt: endIso }), {
      success: lockNow ? "Website is now in maintenance mode" : startIso ? "Maintenance window scheduled" : "Maintenance mode disabled",
      onOk: () => {
        setOpen(false);
        router.refresh();
      },
    });
  };

  const hasFutureSchedule = !initial.enabled && !!initial.startsAt && Date.parse(initial.startsAt) > Date.now();

  return (
    <>
      <section className={`card mb-4 p-4 ${initial.enabled ? "border-amber-400 bg-amber-500/5" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${initial.enabled ? "border-amber-400/50 bg-amber-500/15 text-amber-600 dark:text-amber-400" : "border-line bg-muted text-soft"}`}>
              <Wrench className="h-4 w-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold">Website Maintenance Mode</h2>
                {initial.enabled ? (
                  <Badge value="SUSPENDED" label="LOCKED (IN MAINTENANCE)" />
                ) : hasFutureSchedule ? (
                  <Badge value="PENDING" label="SCHEDULED" />
                ) : (
                  <Badge value="ACTIVE" label="LIVE" />
                )}
              </div>
              <p className="mt-0.5 text-xs text-soft">
                {initial.enabled
                  ? `Entire website is locked.${initial.endsAt ? ` Auto-unlocks ${fmtDateTime(initial.endsAt)}.` : initial.eta ? ` ETA: ${initial.eta}.` : ""}${initial.updatedAt ? ` Updated ${fmtDateTime(initial.updatedAt)} by ${initial.updatedBy ?? "Owner"}.` : ""}`
                  : hasFutureSchedule
                    ? `Scheduled to auto-lock ${fmtDateTime(initial.startsAt!)}${initial.endsAt ? ` until ${fmtDateTime(initial.endsAt)}` : ""}.`
                    : "Lock the entire website immediately or schedule an auto-start / auto-end maintenance window."}
              </p>
            </div>
          </div>

          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              {initial.enabled || hasFutureSchedule ? (
                <>
                  <button className="btn" onClick={() => setOpen(true)}>Edit reason / timer</button>
                  <button
                    className="btn-primary"
                    disabled={pending}
                    onClick={() =>
                      exec(() => setMaintenanceModeAction({ enabled: false, message, eta, startsAt: null, endsAt: null }), {
                        success: "Maintenance cleared — website is live",
                        onOk: () => router.refresh(),
                      })
                    }
                  >
                    {initial.enabled ? "Turn off maintenance (Unlock site)" : "Cancel schedule"}
                  </button>
                </>
              ) : (
                <button className="btn-danger" onClick={() => setOpen(true)}>
                  Put website in maintenance…
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <Modal open={open} onClose={() => setOpen(false)} title={initial.enabled ? "Update maintenance details" : "Website maintenance & schedule"}>
        <div className="space-y-3 text-[13px]">
          <p className="text-soft">
            Pick a premade reason or enter a custom message. You can lock the site immediately or set optional Auto-Start / Auto-End timestamps.
          </p>
          <div>
            <div className="mb-1.5 text-xs font-medium text-soft">Premade reasons (click to fill)</div>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="btn !h-7 !px-2.5 !text-xs"
                  onClick={() => {
                    setMessage(p.message);
                    setEta(p.eta);
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <Field label="Message shown on maintenance screen">
            <textarea
              className="textarea"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="OnboardOps is currently undergoing scheduled maintenance and upgrades..."
            />
          </Field>
          <Field label="Estimated return label / ETA (optional)">
            <input
              className="input mono"
              value={eta}
              onChange={(e) => setEta(e.target.value)}
              placeholder="e.g. ~30 minutes or Today at 8:00 PM EST"
            />
          </Field>
          <div className="rounded-md border border-line bg-muted/50 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
              <CalendarClock className="h-3.5 w-3.5 text-accent" />
              Auto-Start / Auto-End Timer (optional)
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Auto-start at">
                <input className="input mono text-xs" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </Field>
              <Field label="Auto-end (unlock) at">
                <input className="input mono text-xs" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              </Field>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-danger flex-1" disabled={pending} onClick={() => save(true)}>
              {initial.enabled ? "Save & keep locked" : "Lock site now"}
            </button>
            {startsAt && !initial.enabled && (
              <button className="btn-primary flex-1" disabled={pending} onClick={() => save(false)}>
                Schedule for timer
              </button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
