"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone } from "lucide-react";
import { setAnnouncementAction } from "@/actions/admin";
import { Badge, Field, Modal, useAction } from "@/components/ui";
import type { AnnouncementState } from "@/lib/maintenance";
import { ANNOUNCEMENT_PRESETS } from "@/lib/status-presets";

export function AnnouncementPanel({ initial, canManage }: { initial: AnnouncementState; canManage: boolean }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(initial.message);
  const [tone, setTone] = useState<"info" | "warning" | "success">(initial.tone);
  const [linkUrl, setLinkUrl] = useState(initial.linkUrl ?? "");
  const [linkLabel, setLinkLabel] = useState(initial.linkLabel ?? "");
  const [dismissible, setDismissible] = useState(initial.dismissible);
  const [style, setStyle] = useState<"banner" | "modal">(initial.style);
  // Entered as Eastern Standard Time. Stored with a fixed -05:00 offset.
  const [expiresLocal, setExpiresLocal] = useState(initial.expiresAt ? "" : "");
  const [personalize, setPersonalize] = useState(initial.personalize);
  const expiresAt = expiresLocal ? `${expiresLocal.length === 16 ? expiresLocal + ":00" : expiresLocal}-05:00` : null;

  return (
    <>
      <section className={`card p-4 ${initial.enabled ? "border-accent/50 bg-accent/5" : ""}`}>
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
                    exec(() => setAnnouncementAction({ enabled: false, message, tone, linkUrl, linkLabel, dismissible, style, expiresAt, personalize }), {
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
              {ANNOUNCEMENT_PRESETS.map((b) => (
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
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Display">
              <select className="input" value={style} onChange={(e) => setStyle(e.target.value as "banner" | "modal")}>
                <option value="banner">Top banner (every page)</option>
                <option value="modal">Pop-up in the middle of the screen</option>
              </select>
            </Field>
            <Field label="Expires (Eastern Standard Time)">
              <input className="input" type="datetime-local" value={expiresLocal} onChange={(e) => setExpiresLocal(e.target.value)} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={personalize} onChange={(e) => setPersonalize(e.target.checked)} />
            Greet each signed-in person by first name (pop-up only)
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={dismissible} onChange={(e) => setDismissible(e.target.checked)} />
            Allow users to dismiss this announcement
          </label>
          <button
            className="btn-primary w-full"
            disabled={pending || message.trim().length < 3}
            onClick={() =>
              exec(() => setAnnouncementAction({ enabled: true, message, tone, linkUrl, linkLabel, dismissible, style, expiresAt, personalize }), {
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
