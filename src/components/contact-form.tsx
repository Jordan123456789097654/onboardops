"use client";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { submitSupportRequestAction } from "@/actions/support";
import { Field, useAction } from "@/components/ui";

const topics = ["Question", "Bug", "Billing or plan", "Privacy request", "Security report", "Legal notice", "Feedback"];

export function ContactForm() {
  const { exec, pending } = useAction();
  const [done, setDone] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", email: "", topic: "Question", message: "", website: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  if (done) return (
    <div className="card anim-pop flex items-start gap-3 p-5 text-[14px]"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /><div><div className="font-semibold">Message received</div><p className="mt-1 text-soft">Your reference is <span className="mono">{done}</span>. We aim to reply within 2 business days, Monday to Friday.</p></div></div>
  );
  return (
    <form className="card space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); exec(() => submitSupportRequestAction(f), { onOk: (d) => setDone(d.id) }); }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name"><input className="input" value={f.name} onChange={set("name")} autoComplete="name" required /></Field>
        <Field label="Email"><input className="input" type="email" value={f.email} onChange={set("email")} autoComplete="email" required /></Field>
      </div>
      <Field label="Topic"><select className="input" value={f.topic} onChange={set("topic")}>{topics.map((t) => <option key={t}>{t}</option>)}</select></Field>
      <Field label="Message"><textarea className="textarea" rows={6} value={f.message} onChange={set("message")} required minLength={15} placeholder="What were you trying to do, and what happened? Please do not include passwords or full employee records." /></Field>
      <input tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" name="website" value={f.website} onChange={set("website")} />
      <button className="btn-primary !h-10 !px-5 !text-sm" disabled={pending}>{pending ? "Sending…" : "Send message"}</button>
    </form>
  );
}
