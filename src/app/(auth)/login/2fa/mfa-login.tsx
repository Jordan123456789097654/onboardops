"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { verifyLoginMfaAction } from "@/actions/mfa";
import { Brand, Field, ThemeToggle, useAction } from "@/components/ui";

export function MfaLogin({
  duoEnabled = false,
  hasTotp = true,
  duoError,
}: {
  duoEnabled?: boolean;
  hasTotp?: boolean;
  duoError?: string;
}) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);

  const duoOnly = duoEnabled && !hasTotp;

  return (
    <div className="flex min-h-screen flex-col p-4">
      <div className="flex items-center justify-between">
        <Link href="/" aria-label="OnboardOps home"><Brand /></Link>
        <ThemeToggle />
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-sm space-y-4">
          <div>
            <h1 className="text-xl font-semibold">Two-factor sign-in</h1>
            <p className="mt-1 text-[13px] text-soft">
              {duoOnly
                ? "Your workspace requires Duo Security verification to finish signing in."
                : backup
                  ? "Enter one of your backup codes. Each works once."
                  : "Enter the 6-digit code from your authenticator app" + (duoEnabled ? ", or verify with Duo Security." : ".")}
            </p>
          </div>

          {duoError && (
            <p
              role="alert"
              className="rounded-md border border-rose-300 bg-rose-50 p-3 text-[13px] text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200"
            >
              {duoError}
            </p>
          )}

          {duoOnly ? (
            <div className="space-y-4">
              <a
                href="/api/auth/duo/start"
                className="btn-primary inline-flex !h-10 w-full items-center justify-center gap-2 !text-sm"
              >
                <ShieldCheck className="h-4 w-4" />
                Verify with Duo Security
              </a>
              <div className="flex justify-end text-xs">
                <Link className="text-soft hover:text-ink" href="/login">Start over</Link>
              </div>
              <p className="text-xs text-soft">
                Having trouble with Duo Push or your enrolled device? Contact your workspace administrator.
              </p>
            </div>
          ) : (
            <>
              {duoEnabled && (
                <>
                  <a
                    href="/api/auth/duo/start"
                    className="btn inline-flex !h-10 w-full items-center justify-center gap-2 !text-sm"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Verify with Duo Security
                  </a>
                  <div className="relative flex items-center py-1">
                    <div className="flex-1 border-t border-line" />
                    <span className="px-2.5 text-[11px] uppercase tracking-wider text-soft">or</span>
                    <div className="flex-1 border-t border-line" />
                  </div>
                </>
              )}

              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  exec(() => verifyLoginMfaAction({ code }), {
                    onOk: (d) => {
                      router.push(d.to);
                      router.refresh();
                    },
                  });
                }}
              >
                <Field label={backup ? "Backup code" : "Authentication code"}>
                  <input
                    className="input mono text-center text-lg tracking-widest"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    autoFocus={!duoEnabled}
                    autoComplete="one-time-code"
                    inputMode={backup ? "text" : "numeric"}
                    maxLength={backup ? 14 : 7}
                    placeholder={backup ? "XXXXX-XXXXX" : "123456"}
                    aria-label={backup ? "Backup code" : "Authentication code"}
                  />
                </Field>
                <button className="btn-primary !h-10 w-full !text-sm" disabled={pending || code.trim().length < 6}>
                  {pending ? "Checking…" : "Verify and sign in"}
                </button>
                <div className="flex justify-between text-xs">
                  <button
                    type="button"
                    className="text-accent"
                    onClick={() => {
                      setBackup(!backup);
                      setCode("");
                    }}
                  >
                    {backup ? "Use my authenticator app" : "Use a backup code instead"}
                  </button>
                  <Link className="text-soft hover:text-ink" href="/login">Start over</Link>
                </div>
                <p className="text-xs text-soft">
                  Lost your phone and your backup codes? Ask a workspace owner to reset your two-factor authentication.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
