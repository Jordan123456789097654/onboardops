"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginEnrollConfirmAction, loginEnrollStartAction } from "@/actions/mfa";
import { BackupCodes } from "@/components/backup-codes";
import { Brand, Field, ThemeToggle, useAction } from "@/components/ui";

export function MfaEnroll() {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<{ to: string; backupCodes: string[] } | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { exec(() => loginEnrollStartAction(), { onOk: setSetup }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  return (
    <div className="flex min-h-screen flex-col p-4">
      <div className="flex items-center justify-between"><Link href="/" aria-label="OnboardOps home"><Brand /></Link><ThemeToggle /></div>
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-md space-y-4">
          {!result ? (<>
            <div>
              <h1 className="text-xl font-semibold">Set up two-factor sign-in</h1>
              <p className="mt-1 text-[13px] text-soft">Your workspace requires it. Scan the code with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password), then enter the 6-digit code it shows.</p>
            </div>
            {setup ? (
              <div className="card space-y-3 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={setup.qr} alt="QR code to scan with your authenticator app" width={224} height={224} className="mx-auto rounded-md border border-line bg-white" />
                <p className="text-center text-xs text-soft">Cannot scan? Enter this key by hand:</p>
                <p className="mono break-all rounded-md border border-line bg-muted p-2 text-center text-[13px] tracking-wider">{setup.secret.match(/.{1,4}/g)?.join(" ")}</p>
              </div>
            ) : <p className="text-[13px] text-soft">{pending ? "Getting your setup code…" : "Could not start the setup. Go back and sign in again."}</p>}
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); exec(() => loginEnrollConfirmAction({ code }), { onOk: setResult }); }}>
              <Field label="6-digit code"><input className="input mono text-center text-lg tracking-widest" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="123456" disabled={!setup} aria-label="6-digit code" /></Field>
              <button className="btn-primary !h-10 w-full !text-sm" disabled={pending || !setup || code.trim().length < 6}>{pending ? "Checking…" : "Turn on and sign in"}</button>
            </form>
            <p className="text-xs text-soft"><Link className="text-accent" href="/login">Cancel and sign in again</Link></p>
          </>) : (<>
            <div><h1 className="text-xl font-semibold">Save your backup codes</h1><p className="mt-1 text-[13px] text-soft">Two-factor sign-in is on. These codes are shown only once.</p></div>
            <BackupCodes codes={result.backupCodes} />
            <label className="flex items-start gap-2 text-[13px]"><input type="checkbox" className="mt-0.5" checked={saved} onChange={(e) => setSaved(e.target.checked)} />I have saved my backup codes somewhere safe.</label>
            <button className="btn-primary !h-10 w-full !text-sm" disabled={!saved} onClick={() => { router.push(result.to); router.refresh(); }}>Continue</button>
          </>)}
        </div>
      </div>
    </div>
  );
}
