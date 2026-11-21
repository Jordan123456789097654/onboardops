"use client";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import { requestMagicLinkAction } from "@/actions/auth";
import { Field, useAction } from "./ui";

/** "Email me a sign-in link" form. Pass workspaceId on a workspace staff login so only its members get a link. */
export function MagicLinkBox({ workspaceId, onBack, initialEmail = "" }: { workspaceId?: string; onBack: () => void; initialEmail?: string }) {
  const { exec, pending } = useAction();
  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | undefined>();
  if (sent) return (
    <div className="anim-pop space-y-3">
      <MailCheck className="h-7 w-7 text-accent" />
      <h2 className="text-lg font-semibold">Check your email</h2>
      <p className="text-[13px] text-soft">If there is an account for {email}, we sent a sign-in link. It works once and expires in 15 minutes.</p>
      {devLink && <p className="break-all rounded-md border border-line bg-muted p-2 text-xs">Local development only: <a className="text-accent underline" href={devLink}>{devLink}</a></p>}
      <button className="text-xs text-accent" onClick={() => setSent(false)}>Use a different email</button>
    </div>
  );
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); exec(() => requestMagicLinkAction({ email, workspaceId }), { onOk: (d) => { setDevLink(d.devLink); setSent(true); } }); }}>
      <p className="text-[13px] text-soft">No password needed. We will email you a link that signs you in.</p>
      <Field label="Email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></Field>
      <button className="btn-primary !h-10 w-full !text-sm" disabled={pending}>{pending ? "Sending…" : "Email me a sign-in link"}</button>
      <button type="button" className="text-xs text-accent" onClick={onBack}>Use a password instead</button>
    </form>
  );
}
