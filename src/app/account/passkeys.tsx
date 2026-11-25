"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint } from "lucide-react";
import { startRegistration } from "@simplewebauthn/browser";
import { passkeyRegisterOptionsAction, passkeyRegisterVerifyAction, removePasskeyAction } from "@/actions/passkeys";
import { Field, useAction } from "@/components/ui";

export type PasskeyRow = { id: string; name: string; createdAt: string; lastUsedAt: string | null };

/** Passkeys card for Account settings. */
export function Passkeys({ passkeys, hasPassword }: { passkeys: PasskeyRow[]; hasPassword: boolean }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [step, setStep] = useState<"idle" | "add" | { remove: string }>("idle");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const reset = () => { setStep("idle"); setPassword(""); setName(""); setErr(""); };
  const supported = typeof window !== "undefined" && !!window.PublicKeyCredential;

  async function add() {
    setErr(""); setBusy(true);
    try {
      const o = await passkeyRegisterOptionsAction({ password });
      if (!o.ok) { setErr(o.error); return; }
      let response;
      try { response = await startRegistration(o.data as Parameters<typeof startRegistration>[0]); }
      catch (e) { setErr((e as Error).name === "NotAllowedError" ? "Cancelled. Nothing was added." : "This device could not create a passkey."); return; }
      const v = await passkeyRegisterVerifyAction({ response, name });
      if (!v.ok) { setErr(v.error); return; }
      reset(); router.refresh();
    } finally { setBusy(false); }
  }

  const passwordField = hasPassword && <Field label="Your password"><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>;

  return (
    <section className="card mt-5 p-5" id="passkeys">
      <h2 className="text-sm font-semibold">Passkeys</h2>
      <p className="mt-0.5 text-[13px] text-soft">Sign in with your fingerprint, face or device PIN instead of a password. A passkey cannot be phished and also counts as two-factor sign-in.</p>
      <div className="mt-4 space-y-3 text-[13px]">
        {passkeys.length === 0 && <p className="text-soft">No passkeys yet.</p>}
        {passkeys.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line p-3">
            <div><div className="font-medium">{p.name}</div><div className="text-xs text-soft">Added {p.createdAt}{p.lastUsedAt ? `, last used ${p.lastUsedAt}` : ", not used yet"}</div></div>
            {typeof step === "object" && step.remove === p.id ? (
              <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); exec(() => removePasskeyAction({ id: p.id, password }), { success: "Passkey removed", onOk: () => { reset(); router.refresh(); } }); }}>
                {passwordField}
                <button className="btn-danger" disabled={pending || (hasPassword && !password)}>Remove</button>
                <button type="button" className="btn" onClick={reset}>Cancel</button>
              </form>
            ) : <button className="btn" onClick={() => { reset(); setStep({ remove: p.id }); }}>Remove</button>}
          </div>
        ))}
        {step === "add" ? (
          <form className="max-w-sm space-y-3" onSubmit={(e) => { e.preventDefault(); add(); }}>
            {passwordField}
            <Field label="Name (optional)"><input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Work laptop" /></Field>
            {err && <p className="text-xs text-red-600">{err}</p>}
            <div className="flex gap-2"><button className="btn-primary" disabled={busy || (hasPassword && !password)}>{busy ? "Waiting for your device…" : "Continue"}</button><button type="button" className="btn" onClick={reset}>Cancel</button></div>
          </form>
        ) : (
          <>
            {err && <p className="text-xs text-red-600">{err}</p>}
            <button className="btn-primary" disabled={!supported} onClick={() => { reset(); setStep("add"); }}><Fingerprint className="h-3.5 w-3.5" />Add a passkey</button>
            {!supported && <p className="text-xs text-soft">This browser does not support passkeys.</p>}
          </>
        )}
      </div>
    </section>
  );
}
