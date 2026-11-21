"use client";
import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { forgotPasswordAction } from "@/actions/auth";
import { Brand, Field, ThemeToggle, useAction } from "@/components/ui";

export function ForgotForm() {
  const { exec, pending } = useAction();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | undefined>();
  return (
    <div className="flex min-h-screen flex-col p-4">
      <div className="flex items-center justify-between"><Link href="/" aria-label="OnboardOps home"><Brand /></Link><ThemeToggle /></div>
      <div className="flex flex-1 items-center justify-center">
        {sent ? (
          <div className="anim-pop w-full max-w-sm space-y-3">
            <MailCheck className="h-7 w-7 text-accent" />
            <h1 className="text-xl font-semibold">Check your email</h1>
            <p className="text-[13px] text-soft">If an account exists for {email}, we sent a link that works for 1 hour. It may take a minute to arrive.</p>
            {devLink && <p className="break-all rounded-md border border-line bg-muted p-2 text-xs">Local development only: <a className="text-accent underline" href={devLink}>{devLink}</a></p>}
            <Link href="/login" className="btn">Back to sign in</Link>
          </div>
        ) : (
          <form className="w-full max-w-sm space-y-4" onSubmit={(e) => { e.preventDefault(); exec(() => forgotPasswordAction({ email }), { onOk: (d) => { setDevLink(d.devLink); setSent(true); } }); }}>
            <div><h1 className="text-xl font-semibold">Reset your password</h1><p className="mt-1 text-[13px] text-soft">Enter your work email and we will send a reset link.</p></div>
            <Field label="Work email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></Field>
            <button className="btn-primary !h-10 w-full !text-sm" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</button>
            <p className="text-xs text-soft"><Link className="text-accent" href="/login">Back to sign in</Link></p>
          </form>
        )}
      </div>
    </div>
  );
}
