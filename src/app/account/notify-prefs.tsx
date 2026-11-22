"use client";
import { useState } from "react";
import { saveEmailPrefsAction, saveNotificationPrefsAction } from "@/actions/account";
import { OPTIONAL_EMAIL_KINDS } from "@/lib/notify-prefs";
import { Field, useAction } from "@/components/ui";

const hours = Array.from({ length: 24 }, (_, h) => h);
const label = (h: number) => `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? "AM" : "PM"}`;

export function NotifyPrefs({ quietStart, quietEnd, timezone, prefs }: { quietStart: number | null; quietEnd: number | null; timezone: string; prefs: Record<string, boolean> }) {
  const [p, setP] = useState<Record<string, boolean>>(prefs);
  const { exec, pending } = useAction();
  const [on, setOn] = useState(quietStart !== null && quietEnd !== null);
  const [s, setS] = useState(quietStart ?? 22);
  const [e, setE] = useState(quietEnd ?? 7);
  const [tz, setTz] = useState(timezone || (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : ""));
  return (
    <section className="card mt-6 space-y-3 p-4 text-[13px]">
      <h2 className="text-sm font-semibold">Email notifications</h2>
      <div className="divide-y divide-line">{OPTIONAL_EMAIL_KINDS.map((k) => (
        <label key={k.kind} className="flex items-start gap-3 py-2"><input type="checkbox" className="mt-0.5" checked={p[k.kind] !== false} onChange={(e) => setP({ ...p, [k.kind]: e.target.checked })} /><span><span className="font-medium">{k.label}</span><span className="block text-xs text-soft">{k.hint}</span></span></label>
      ))}</div>
      <button className="btn" disabled={pending} onClick={() => exec(() => saveEmailPrefsAction(p), { success: "Email preferences saved" })}>Save email preferences</button>
      <p className="text-xs text-soft">Sign-in, password and security emails are always sent.</p>
      <h2 className="border-t border-line pt-4 text-sm font-semibold">Notification quiet hours</h2>
      <label className="flex items-center gap-2"><input type="checkbox" checked={on} onChange={(ev) => setOn(ev.target.checked)} />Hold non-urgent notification emails during quiet hours</label>
      {on && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Quiet from"><select className="input" value={s} onChange={(ev) => setS(Number(ev.target.value))}>{hours.map((h) => <option key={h} value={h}>{label(h)}</option>)}</select></Field>
          <Field label="Until"><select className="input" value={e} onChange={(ev) => setE(Number(ev.target.value))}>{hours.map((h) => <option key={h} value={h}>{label(h)}</option>)}</select></Field>
          <Field label="Time zone"><input className="input mono" value={tz} onChange={(ev) => setTz(ev.target.value)} /></Field>
        </div>
      )}
      <button className="btn-primary" disabled={pending} onClick={() => exec(() => saveNotificationPrefsAction({ quietStart: on ? s : null, quietEnd: on ? e : null, timezone: tz }), { success: "Preferences saved" })}>Save preferences</button>
    </section>
  );
}
