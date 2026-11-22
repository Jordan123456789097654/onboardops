"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone } from "lucide-react";
import { setAnnouncementAction } from "@/actions/admin";
import { Badge, Field, Modal, useAction } from "@/components/ui";
import type { AnnouncementState } from "@/lib/maintenance";

const QUICK_BANNERS: { label: string; message: string; tone: "info" | "warning" | "success"; linkUrl?: string; linkLabel?: string }[] = [
  { label: "New Release", message: "New update v0.9 is live! Check out Shift Handoff Notes, 1-click role assignment, and more.", tone: "success", linkUrl: "/changelog", linkLabel: "See changelog" },
  { label: "Maintenance Notice", message: "Scheduled maintenance tonight at 11:00 PM EST (~20 min expected downtime).", tone: "warning", linkUrl: "/status", linkLabel: "System status" },
  { label: "Beta Feedback", message: "We're actively building OnboardOps with our beta teams—click Feedback in the top bar anytime!", tone: "info" },
];

export function AnnouncementPanel({ initial, canManage }: { initial: AnnouncementState; canManage: boolean }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(initial.message);
  const [tone, setTone] = useState<"info" | "warning" | "success">(initial.tone);
  const [linkUrl, setLinkUrl] = useState(initial.linkUrl ?? "");
  const [linkLabel, setLinkLabel] = useState(initial.linkLabel ?? "");
  const [dismissible, setDismissible] = useState(initial.dismissible);

  return (
    <>
      <section className={`card mb-6 p-4 ${initial.enabled ? "border-accent/50 bg-accent/5" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${initial.enabled ? "border-accent/50 bg-accent/15 text-accent" : "border-line bg-muted text-soft"}`}>
              <Megaphone className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">Global Announcement Banner</h2>
                {initial.enabled ? <Badge value="ACTIVE" label="BROADCASTING" /> : <Badge value="LOA" label="OFF" />}
              </div>
              <p className="mt-0.5 text-xs text-soft">
                {initial.enabled
                  ? `Active banner: "${initial.message}"`
                  : "Broadcast a non-blocking update, release note, or maintenance warning across every page and workspace."}
              </p>
            </div>
          </div>
          {canManage && (
            <div className="flex items-center gap-2">
              <button className="btn" onClick={() => setOpen(true)}>
                {initial.enabled ? "Edit banner" : "Broadcast announcement…"}
              </button>
              {initial.enabled && (
                <button
                  className="btn-danger"
                  disabled={pending}
                  onClick={() =>
                    exec(() => setAnnouncementAction({ enabled: false, message, tone, linkUrl, linkLabel, dismissible }), {
                      success: "Announcement banner cleared",
                      onOk: () => router.refresh(),
                    })
                  }
                >
                  Clear banner
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <Modal open={open} onClose={() => setOpen(false)} title="Global announcement banner">
        <div className="space-y-3 text-[13px]">
          <div>
            <div className="mb-1.5 text-xs font-medium text-soft">Quick presets</div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_BANNERS.map((b) => (
                <button
                  key={b.label}
                  type="button"
                  className="btn !h-7 !px-2.5 !text-xs"
                  onClick={() => {
                    setMessage(b.message);
                    setTone(b.tone);
                    setLinkUrl(b.linkUrl ?? "");
                    setLinkLabel(b.linkLabel ?? "");
                  }}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
          <Field label="Banner message">
            <textarea className="textarea" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="New update v0.9 is live!" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Style / Tone">
              <select className="input" value={tone} onChange={(e) => setTone(e.target.value as any)}>
                <option value="info">Info (Blue / Accent)</option>
                <option value="warning">Warning (Amber)</option>
                <option value="success">Success / Release (Green)</option>
              </select>
            </Field>
            <Field label="Optional link label">
              <input className="input" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="See changelog" />
            </Field>
          </div>
          <Field label="Optional link URL">
            <input className="input mono" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="/changelog or https://..." />
          </Field>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={dismissible} onChange={(e) => setDismissible(e.target.checked)} />
            Allow users to dismiss this banner
          </label>
          <button
            className="btn-primary w-full"
            disabled={pending || message.trim().length < 3}
            onClick={() =>
              exec(() => setAnnouncementAction({ enabled: true, message, tone, linkUrl, linkLabel, dismissible }), {
                success: "Announcement banner is now live",
                onOk: () => {
                  setOpen(false);
                  router.refresh();
                },
              })
            }
          >
            Publish banner across all workspaces
          </button>
        </div>
      </Modal>
    </>
  );
}
