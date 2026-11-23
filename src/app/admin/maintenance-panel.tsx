"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Wrench } from "lucide-react";
import { setMaintenanceModeAction } from "@/actions/admin";
import { Badge, Field, Modal, useAction } from "@/components/ui";
import type { MaintenanceState } from "@/lib/maintenance";
import { ALL_AREAS, AREA_LABEL, type MaintArea } from "@/lib/maintenance-areas";
import { MAINTENANCE_PRESETS } from "@/lib/status-presets";
import { fmtDateTime } from "@/lib/utils";

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
  const [areas, setAreas] = useState<MaintArea[]>(initial.areas);
  const [notice, setNotice] = useState(initial.noticeMinutes);
  const toggleArea = (a: MaintArea) => setAreas((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));
  const allAreas = areas.length === ALL_AREAS.length;
  const areaText = initial.areas.length === ALL_AREAS.length ? "The whole of OnboardOps" : initial.areas.map((a) => AREA_LABEL[a]).join(", ");
  /** Sets the end time a set number of minutes after the start. With no start yet, the start is placed one notice period from now. */
  const duration = (mins: number) => {
    const base = startsAt ? new Date(startsAt) : new Date(Date.now() + Math.max(notice, 5) * 60000);
    if (!startsAt) setStartsAt(toLocalInput(base.toISOString()));
    setEndsAt(toLocalInput(new Date(base.getTime() + mins * 60000).toISOString()));
  };

  const save = (lockNow: boolean) => {
    const startIso = startsAt ? new Date(startsAt).toISOString() : null;
    const endIso = endsAt ? new Date(endsAt).toISOString() : null;
    if (!areas.length) return exec(async () => ({ ok: false as const, error: "Pick at least one area" }), {});
    exec(() => setMaintenanceModeAction({ enabled: lockNow, message, eta, startsAt: startIso, endsAt: endIso, areas, noticeMinutes: notice }), {
      success: lockNow ? "Maintenance is on" : startIso ? "Maintenance window scheduled" : "Maintenance mode disabled",
      onOk: () => {
        setOpen(false);
        router.refresh();
      },
    });
  };

  const hasFutureSchedule = !initial.enabled && !!initial.startsAt && Date.parse(initial.startsAt) > Date.now();

  return (
    <>
      <section className={`card p-4 ${initial.enabled ? "border-amber-400 bg-amber-500/5" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${initial.enabled ? "border-amber-400/50 bg-amber-500/15 text-amber-600 dark:text-amber-400" : "border-line bg-muted text-soft"}`}>
              <Wrench className="h-4 w-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold">Maintenance mode</h2>
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
                  ? `${areaText} is locked.${initial.endsAt ? ` Auto-unlocks ${fmtDateTime(initial.endsAt)}.` : initial.eta ? ` ETA: ${initial.eta}.` : ""}${initial.updatedAt ? ` Updated ${fmtDateTime(initial.updatedAt)} by ${initial.updatedBy ?? "Owner"}.` : ""}`
                  : hasFutureSchedule
                    ? `${areaText} is scheduled to lock ${fmtDateTime(initial.startsAt!)}${initial.endsAt ? ` until ${fmtDateTime(initial.endsAt)}` : ""}. Visitors see a countdown banner first.`
                    : "Lock everything or just one area now, or schedule a window. People see a countdown banner before it starts."}
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
                      exec(() => setMaintenanceModeAction({ enabled: false, message, eta, startsAt: null, endsAt: null, areas: initial.areas, noticeMinutes: initial.noticeMinutes }), {
                        success: "Maintenance cleared, everything is live",
                        onOk: () => router.refresh(),
                      })
                    }
                  >
                    {initial.enabled ? "End now" : "Cancel schedule"}
                  </button>
                </>
              ) : (
                <button className="btn-danger" onClick={() => setOpen(true)}>
                  Start maintenance…
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <Modal open={open} onClose={() => setOpen(false)} title={initial.enabled ? "Update maintenance details" : "Maintenance and schedule"}>
        <div className="space-y-3 text-[13px]">
          <p className="text-soft">
            Pick a premade reason or enter a custom message. You can lock the site immediately or set optional Auto-Start / Auto-End timestamps.
          </p>
          <div className="rounded-md border border-line bg-muted/50 p-3">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold"><span>What to take down</span><button type="button" className="font-normal text-accent underline" onClick={() => setAreas(allAreas ? [] : [...ALL_AREAS])}>{allAreas ? "Clear all" : "Select all"}</button></div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {ALL_AREAS.map((a) => (
                <label key={a} className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={areas.includes(a)} onChange={() => toggleArea(a)} />{AREA_LABEL[a]}</label>
              ))}
            </div>
            <p className="mt-2 text-xs text-soft">The staff console and sign-in always stay open. Anything not ticked keeps working.</p>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-soft">
              <span>Premade reasons ({MAINTENANCE_PRESETS.length} templates — click to fill)</span>
            </div>
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-line bg-muted/30 p-2">
              {MAINTENANCE_PRESETS.map((p) => (
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
              rows={5}
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
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-soft">Length:</span>
              {[[30, "30 min"], [60, "1 hour"], [120, "2 hours"]].map(([m, l]) => <button key={m} type="button" className="btn !h-7 !px-2.5 !text-xs" onClick={() => duration(m as number)}>{l}</button>)}
              <span className="ml-auto text-soft">Notice banner:</span>
              <select className="select !h-7 !text-xs" value={notice} onChange={(e) => setNotice(Number(e.target.value))} aria-label="Notice banner lead time">
                {[[15, "15 min before"], [30, "30 min before"], [60, "1 hour before"], [180, "3 hours before"], [1440, "1 day before"]].map(([m, l]) => <option key={m} value={m}>{l}</option>)}
              </select>
            </div>
            <p className="mt-2 text-xs text-soft">Times use your computer&apos;s time zone. From when a window is scheduled, visitors see a banner with a live countdown. It is shown most prominently in the notice period.</p>
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
