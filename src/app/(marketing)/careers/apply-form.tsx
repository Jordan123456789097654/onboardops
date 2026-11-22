"use client";
import { useState } from "react";
import { applyAction } from "@/actions/careers";
import { Field, useAction } from "@/components/ui";

export function ApplyForm({ postingId, label }: { postingId?: string; label: string }) {
  const { exec, pending } = useAction();
  const [f, setF] = useState({ name: "", email: "", link: "", message: "", website: "" });
  const [done, setDone] = useState(false);
  if (done) return <p className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-[13px] text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">Thank you. We got your message and will reply if there is a fit.</p>;
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); exec(() => applyAction({ ...f, postingId: postingId ?? "" }), { onOk: () => setDone(true) }); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Your name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" required /></Field>
        <Field label="Email"><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" required /></Field>
      </div>
      <Field label="Link to your work, site or profile (optional)"><input className="input mono" placeholder="https://" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} /></Field>
      <Field label={label}><textarea className="textarea" rows={5} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} required /></Field>
      <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
      <p className="text-xs text-soft">We use what you send only to consider your application and reply to you. You can ask us to delete it at any time through the contact form. Please do not include government ID numbers or health information.</p>
      <button className="btn-primary" disabled={pending}>{pending ? "Sending…" : "Send"}</button>
    </form>
  );
}
