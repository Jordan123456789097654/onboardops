"use client";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { submitAppealAction } from "@/actions/moderation";
import { Field, useAction } from "@/components/ui";

export function AppealForm() {
  const { exec, pending } = useAction();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [hp, setHp] = useState("");
  const [done, setDone] = useState(false);
  if (done) {
    return <div role="status" className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /><p className="text-[15px] text-soft">Thank you. If there is a suspension on this address, a person will review your appeal and reply by email.</p></div>;
  }
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); exec(() => submitAppealAction({ email, message, website: hp }), { onOk: () => setDone(true) }); }}>
      <Field label="Your email address"><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} autoComplete="email" /></Field>
      <Field label="Why should we review this decision?"><textarea className="textarea" rows={6} required minLength={20} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Explain what happened and anything that shows the decision was wrong." /></Field>
      <input className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" name="website" value={hp} onChange={(e) => setHp(e.target.value)} />
      <button className="btn-primary" disabled={pending}>{pending ? "Sending…" : "Send appeal"}</button>
      <p className="text-[12px] text-soft">We reply by email. Each address can appeal once per decision.</p>
    </form>
  );
}
