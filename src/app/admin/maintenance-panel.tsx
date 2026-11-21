"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wrench } from "lucide-react";
import { setMaintenanceModeAction } from "@/actions/admin";
import { Badge, Field, Modal, useAction } from "@/components/ui";
import type { MaintenanceState } from "@/lib/maintenance";
import { fmtDateTime } from "@/lib/utils";

export function MaintenancePanel({ initial, canManage }: { initial: MaintenanceState; canManage: boolean }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(initial.message);
  const [eta, setEta] = useState(initial.eta ?? "");

  return (
    <>
      <section className={`card mb-6 p-4 ${initial.enabled ? "border-amber-400 bg-amber-500/5" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${initial.enabled ? "border-amber-400/50 bg-amber-500/15 text-amber-600 dark:text-amber-400" : "border-line bg-muted text-soft"}`}>
              <Wrench className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">Website Maintenance Mode</h2>
                {initial.enabled ? (
                  <Badge value="SUSPENDED" label="LOCKED (IN MAINTENANCE)" />
                ) : (
                  <Badge value="ACTIVE" label="LIVE" />
                )}
              </div>
              <p className="mt-0.5 text-xs text-soft">
                {initial.enabled
                  ? `Entire website is locked for visitors and customers.${initial.eta ? ` ETA: ${initial.eta}.` : ""}${initial.updatedAt ? ` Updated ${fmtDateTime(initial.updatedAt)} by ${initial.updatedBy ?? "Owner"}.` : ""}`
                  : "Put the entire website into maintenance mode. Locks all pages and workspaces for everyone except site owners."}
              </p>
            </div>
          </div>

          {canManage && (
            <div className="flex items-center gap-2">
              {initial.enabled ? (
                <>
                  <button className="btn" onClick={() => setOpen(true)}>Edit message / ETA</button>
                  <button
                    className="btn-primary"
                    disabled={pending}
                    onClick={() =>
                      exec(() => setMaintenanceModeAction({ enabled: false, message, eta }), {
                        success: "Maintenance mode disabled — website is live",
                        onOk: () => router.refresh(),
                      })
                    }
                  >
                    Turn off maintenance (Unlock site)
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

      <Modal open={open} onClose={() => setOpen(false)} title={initial.enabled ? "Update maintenance details" : "Put website in maintenance"}>
        <div className="space-y-3 text-[13px]">
          <p className="text-soft">
            When enabled, the entire website (homepage, marketing pages, sign-in, and all customer workspaces) is locked with a maintenance screen. Site owners still have full access.
          </p>
          <Field label="Message shown to visitors">
            <textarea
              className="textarea"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="OnboardOps is currently undergoing scheduled maintenance and upgrades..."
            />
          </Field>
          <Field label="Estimated return / ETA (optional)">
            <input
              className="input mono"
              value={eta}
              onChange={(e) => setEta(e.target.value)}
              placeholder="e.g. Today at 8:00 PM EST or ~30 minutes"
            />
          </Field>
          <div className="flex gap-2">
            <button
              className={initial.enabled ? "btn-primary w-full" : "btn-danger w-full"}
              disabled={pending}
              onClick={() =>
                exec(() => setMaintenanceModeAction({ enabled: true, message, eta }), {
                  success: "Website is now in maintenance mode",
                  onOk: () => {
                    setOpen(false);
                    router.refresh();
                  },
                })
              }
            >
              {initial.enabled ? "Save maintenance message" : "Enable maintenance mode & lock site"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
