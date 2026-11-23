"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { verifyLoginMfaAction } from "@/actions/mfa";
import { Brand, Field, ThemeToggle, useAction } from "@/components/ui";

export function MfaLogin() {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  return (
    <div className="flex min-h-screen flex-col p-4">
      <div className="flex items-center justify-between"><Link href="/" aria-label="OnboardOps home"><Brand /></Link><ThemeToggle /></div>
      <div className="flex flex-1 items-center justify-center">
        <form className="w-full max-w-sm space-y-4" onSubmit={(e) => { e.preventDefault(); exec(() => verifyLoginMfaAction({ code }), { onOk: (d) => { router.push(d.to); router.refresh(); } }); }}>
          <div>
            <h1 className="text-xl font-semibold">Two-factor sign-in</h1>
            <p className="mt-1 text-[13px] text-soft">{backup ? "Enter one of your backup codes. Each works once." : "Enter the 6-digit code from your authenticator app."}</p>
          </div>
          <Field label={backup ? "Backup code" : "Authentication code"}>
            <input className="input mono text-center text-lg tracking-widest" value={code} onChange={(e) => setCode(e.target.value)} autoFocus autoComplete="one-time-code" inputMode={backup ? "text" : "numeric"} maxLength={backup ? 14 : 7} placeholder={backup ? "XXXXX-XXXXX" : "123456"} aria-label={backup ? "Backup code" : "Authentication code"} />
          </Field>
          <button className="btn-primary !h-10 w-full !text-sm" disabled={pending || code.trim().length < 6}>{pending ? "Checking…" : "Verify and sign in"}</button>
          <div className="flex justify-between text-xs">
            <button type="button" className="text-accent" onClick={() => { setBackup(!backup); setCode(""); }}>{backup ? "Use my authenticator app" : "Use a backup code instead"}</button>
            <Link className="text-soft hover:text-ink" href="/login">Start over</Link>
          </div>
          <p className="text-xs text-soft">Lost your phone and your backup codes? Ask a workspace owner to reset your two-factor authentication.</p>
        </form>
      </div>
    </div>
  );
}
