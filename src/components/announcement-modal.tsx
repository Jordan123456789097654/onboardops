"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

/**
 * Centered announcement pop-up. Shown until its expiry time (checked in the browser and again on the server),
 * and dismissed per browser when the person closes it. Personal greeting uses the signed-in person's first name.
 */
export function AnnouncementModal({
  message,
  tone,
  linkUrl,
  linkLabel,
  dismissible,
  expiresAt,
  personalize,
  firstName,
  stamp,
}: {
  message: string;
  tone: "info" | "warning" | "success";
  linkUrl: string | null;
  linkLabel: string | null;
  dismissible: boolean;
  expiresAt: string | null;
  personalize: boolean;
  firstName: string | null;
  stamp: string;
}) {
  const [open, setOpen] = useState(false);
  const key = `oo_modal_seen_${stamp}`;

  useEffect(() => {
    try {
      if (localStorage.getItem(key)) return;
    } catch {}
    setOpen(true);
  }, [key]);

  // Close on its own at the expiry time.
  useEffect(() => {
    if (!expiresAt) return;
    const ms = Date.parse(expiresAt) - Date.now();
    if (ms <= 0) { setOpen(false); return; }
    const id = window.setTimeout(() => setOpen(false), Math.min(ms, 2147483647));
    return () => window.clearTimeout(id);
  }, [expiresAt]);

  if (!open) return null;

  const accent = tone === "warning" ? "text-amber-400" : tone === "success" ? "text-emerald-400" : "text-accent";
  const greeting = personalize && firstName ? `Hi ${firstName},` : null;
  const paragraphs = message.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  const close = () => {
    setOpen(false);
    try { localStorage.setItem(key, "1"); } catch {}
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="announcement-title">
      <div className="card relative max-h-[85vh] w-full max-w-xl overflow-y-auto p-6 sm:p-8">
        {dismissible && (
          <button type="button" aria-label="Close announcement" onClick={close} className="absolute right-3 top-3 rounded p-1 text-soft hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        )}
        <div className={`text-xs font-semibold uppercase tracking-wider ${accent}`}>Announcement</div>
        <h2 id="announcement-title" className="mt-2 text-2xl font-semibold leading-tight">
          {greeting ?? "A message from OnboardOps"}
        </h2>
        <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-soft">
          {paragraphs.map((p, i) => (
            <p key={i} className="whitespace-pre-line">{p}</p>
          ))}
        </div>
        {linkUrl && (
          <a
            href={linkUrl}
            target={linkUrl.startsWith("http") ? "_blank" : undefined}
            rel={linkUrl.startsWith("http") ? "noreferrer" : undefined}
            className="btn-primary mt-6 inline-flex"
            onClick={close}
          >
            {linkLabel || "Learn more"} →
          </a>
        )}
        {dismissible && (
          <div className="mt-6 flex justify-end">
            <button type="button" className="btn" onClick={close}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
