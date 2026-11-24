"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ShieldCheck } from "lucide-react";
import { confirmTotpSetupAction, disableTotpAction, regenerateBackupCodesAction, startTotpSetupAction } from "@/actions/mfa";
import { BackupCodes } from "@/components/backup-codes";
import { Badge, Field, useAction } from "@/components/ui";

export type MfaState = { enabled: boolean; backupLeft: number; hasPassword: boolean; requiredBy: string | null };

/** Two-factor authentication card for Account settings. */
export function TwoFactor({ mfa, need2fa }: { mfa: MfaState; need2fa: boolean }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [step, setStep] = useState<"idle" | "password" | "scan" | "codes" | "disable" | "regen">("idle");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const reset = () => { setStep("idle"); setPassword(""); setCode(""); setSetup(null); };
  const passwordField = mfa.hasPassword && <Field label="Your password"><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>;

  return (
    <section className="card mt-5 p-5" id="2fa">
      <div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-semibold">Two-factor authentication</h2>{mfa.enabled ? <Badge value="PASSED" label="On" /> : <Badge value="PENDING" label="Off" />}</div>
      <p className="mt-0.5 text-[13px] text-soft">Adds a 6-digit code from an authenticator app to every sign-in, so a stolen password is not enough.</p>
      {need2fa && !mfa.enabled && <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">{mfa.requiredBy ?? "Your workspace"} requires two-factor authentication. Turn it on below, then go back.</p>}
      <div className="mt-4 space-y-4 text-[13px]">
        {codes ? (
          <div>
            <h3 className="font-medium">Save your backup codes</h3>
            <p className="mb-3 text-soft">Shown only once. Each works one time if you lose your phone.</p>
            <BackupCodes codes={codes} />
            <button className="btn-primary mt-4" onClick={() => { setCodes(null); reset(); router.refresh(); }}>I have saved them</button>
          </div>
        ) : !mfa.enabled ? (
          step === "idle" ? <button className="btn-primary" onClick={() => (mfa.hasPassword ? setStep("password") : exec(() => startTotpSetupAction({}), { onOk: (s) => { setSetup(s); setStep("scan"); } }))}><ShieldCheck className="h-3.5 w-3.5" />Turn on two-factor authentication</button>
          : step === "password" ? (
            <form className="max-w-sm space-y-3" onSubmit={(e) => { e.preventDefault(); exec(() => startTotpSetupAction({ password }), { onOk: (s) => { setSetup(s); setStep("scan"); setPassword(""); } }); }}>
              {passwordField}
              <div className="flex gap-2"><button className="btn-primary" disabled={pending || !password}>Continue</button><button type="button" className="btn" onClick={reset}>Cancel</button></div>
            </form>
          ) : setup ? (
            <form className="max-w-md space-y-3" onSubmit={(e) => { e.preventDefault(); exec(() => confirmTotpSetupAction({ code }), { onOk: (r) => { setCodes(r.backupCodes); setStep("idle"); setSetup(null); setCode(""); } }); }}>
              <p className="text-soft">1. Scan this with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password).</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={setup.qr} alt="QR code to scan with your authenticator app" width={196} height={196} className="rounded-md border border-line bg-white" />
              <p className="text-xs text-soft">Cannot scan? Enter this key by hand: <span className="mono break-all font-medium text-ink">{setup.secret.match(/.{1,4}/g)?.join(" ")}</span></p>
              <p className="text-soft">2. Enter the 6-digit code the app shows.</p>
              <Field label="6-digit code"><input className="input mono w-40 text-center tracking-widest" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="123456" /></Field>
              <div className="flex gap-2"><button className="btn-primary" disabled={pending || code.trim().length < 6}>Confirm and turn on</button><button type="button" className="btn" onClick={reset}>Cancel</button></div>
            </form>
          ) : null
        ) : (
          <>
            <p className="flex items-center gap-2 text-soft"><KeyRound className="h-3.5 w-3.5" />{mfa.backupLeft} backup code{mfa.backupLeft === 1 ? "" : "s"} left.{mfa.backupLeft <= 2 && <span className="text-amber-700 dark:text-amber-300"> Generate new ones soon.</span>}</p>
            {step === "idle" && (
              <div className="flex flex-wrap gap-2">
                <button className="btn" onClick={() => setStep("regen")}>Generate new backup codes</button>
                <button className="btn" disabled={!!mfa.requiredBy} onClick={() => setStep("disable")}>Turn off</button>
              </div>
            )}
            {mfa.requiredBy && step === "idle" && <p className="text-xs text-soft">{mfa.requiredBy} requires two-factor authentication for everyone, so it cannot be turned off.</p>}
            {(step === "disable" || step === "regen") && (
              <form className="max-w-sm space-y-3" onSubmit={(e) => {
                e.preventDefault();
                if (step === "disable") exec(() => disableTotpAction({ password, code }), { success: "Two-factor authentication is off", onOk: () => { reset(); router.refresh(); } });
                else exec(() => regenerateBackupCodesAction({ password, code }), { onOk: (r) => { setCodes(r.backupCodes); reset(); } });
              }}>
                <p className="text-soft">{step === "disable" ? "Confirm it is you to turn this off." : "Confirm it is you. The old backup codes stop working."}</p>
                {passwordField}
                <Field label="Code from your app, or a backup code"><input className="input mono" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" maxLength={14} /></Field>
                <div className="flex gap-2"><button className={step === "disable" ? "btn-danger" : "btn-primary"} disabled={pending || code.trim().length < 6 || (mfa.hasPassword && !password)}>{step === "disable" ? "Turn off" : "Generate new codes"}</button><button type="button" className="btn" onClick={reset}>Cancel</button></div>
              </form>
            )}
          </>
        )}
      </div>
    </section>
  );
}
