"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { addCmkAction, removeCmkAction, revokeCmkAction, rotateCmkAction } from "@/actions/cmk";
import { Badge, Field, useAction, useToast } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

export type EncryptionState = { state: "MANAGED" | "ACTIVE"; version: number; fingerprint: string; addedAt: string | null; rotatedAt: string | null; needs: { password: boolean; code: boolean } };

type Mode = null | "add" | "rotate" | "revoke" | "remove";

/** Customer-supplied encryption key. Owner only. The key is never shown again after it is entered or generated. */
export function EncryptionPanel({ s, isOwner }: { s: EncryptionState; isOwner: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();
  const [mode, setMode] = useState<Mode>(null);
  const [gen, setGen] = useState(true);
  const [key, setKey] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [shown, setShown] = useState<{ key: string; fingerprint: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const reset = () => { setMode(null); setKey(""); setPassword(""); setCode(""); setGen(true); };
  const auth = { password: s.needs.password ? password : undefined, code: s.needs.code ? code : undefined };
  const authOk = (!s.needs.password || password) && (!s.needs.code || code);
  const keyOk = gen || key.trim().length >= 40;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const done = () => { reset(); router.refresh(); };
    if (mode === "add" || mode === "rotate") {
      const fn = mode === "add" ? addCmkAction : rotateCmkAction;
      exec(() => fn({ ...auth, generate: gen, key: gen ? undefined : key }), { success: mode === "add" ? "Customer key added" : "Key rotated", onOk: (r) => { if (r.generatedKey) { setShown({ key: r.generatedKey, fingerprint: r.fingerprint }); setSaved(false); } done(); } });
    } else if (mode === "revoke") exec(() => revokeCmkAction(auth), { success: "Key revoked. The workspace is now locked.", onOk: done });
    else if (mode === "remove") exec(() => removeCmkAction(auth), { success: "Back to the OnboardOps-managed key", onOk: done });
  };
  const reauth = (<>
    {s.needs.password && <Field label="Your password"><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>}
    {s.needs.code && <Field label="Code from your authenticator app"><input className="input mono w-44" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" maxLength={14} /></Field>}
  </>);
  return (
    <div className="card p-4 text-[13px]" id="encryption">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4" />Encryption key{s.state === "ACTIVE" ? <Badge value="PASSED" label="Your key" /> : <Badge value="PENDING" label="Managed by OnboardOps" />}</h2>
      <p className="mt-1 text-soft">Sensitive records (confidential notes, case and incident text, coaching and review notes, phone numbers, uploaded files) are always encrypted. By default OnboardOps manages the key. You can instead use a key that you hold, and revoke it at any time to lock those records.</p>
      {shown && (
        <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <div className="font-medium">Save this key now. It is shown only once.</div>
          <div className="mono mt-1 break-all">{shown.key}</div>
          <p className="mt-1 text-xs">Fingerprint {shown.fingerprint}. If you lose it after revoking, the workspace's encrypted records cannot be recovered, by you or by us.</p>
          <div className="mt-2 flex flex-wrap items-center gap-3"><button type="button" className="btn" onClick={() => { navigator.clipboard?.writeText(shown.key); toast("ok", "Copied"); }}>Copy</button><label className="flex items-center gap-2"><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />I have saved it somewhere safe.</label><button type="button" className="btn-primary" disabled={!saved} onClick={() => setShown(null)}>Done</button></div>
        </div>
      )}
      {s.state === "ACTIVE" && <p className="mt-3 text-xs text-soft">Version {s.version} · fingerprint <span className="mono">{s.fingerprint}</span> · added {s.addedAt ? fmtDateTime(s.addedAt) : "—"}{s.rotatedAt ? ` · rotated ${fmtDateTime(s.rotatedAt)}` : ""}</p>}
      {!isOwner ? <p className="mt-3 text-xs text-soft">Only the workspace owner can change this.</p> : mode === null ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {s.state === "MANAGED" ? <button className="btn-primary" onClick={() => setMode("add")}>Use my own key</button> : (<><button className="btn" onClick={() => setMode("rotate")}>Rotate key</button><button className="btn" onClick={() => setMode("remove")}>Go back to the managed key</button><button className="btn-danger" onClick={() => setMode("revoke")}>Revoke key and lock workspace</button></>)}
        </div>
      ) : (
        <form className="mt-3 max-w-md space-y-3" onSubmit={submit}>
          {(mode === "add" || mode === "rotate") && (
            <div className="space-y-2">
              <div role="radiogroup" className="flex gap-4"><label className="flex items-center gap-1.5"><input type="radio" checked={gen} onChange={() => setGen(true)} />Generate one for me</label><label className="flex items-center gap-1.5"><input type="radio" checked={!gen} onChange={() => setGen(false)} />I have my own</label></div>
              {!gen && <Field label="Your key (64 hex characters or 44 base64)"><textarea className="textarea mono" rows={2} value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} /></Field>}
              <p className="text-xs text-soft">Records are not re-encrypted: your key protects the workspace's data key. While it is active, an encrypted copy is kept on our servers so the app can work. Revoking deletes that copy.</p>
            </div>
          )}
          {mode === "revoke" && <p className="rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">Everyone in the workspace, including the API, loses access to encrypted records at once. Nothing is deleted, and you can unlock it by providing the same key. Without the key, the records cannot be recovered.</p>}
          {mode === "remove" && <p className="text-xs text-soft">The workspace returns to the key OnboardOps manages. Your key stops being used.</p>}
          {reauth}
          <div className="flex gap-2"><button className={mode === "revoke" ? "btn-danger" : "btn-primary"} disabled={pending || !authOk || ((mode === "add" || mode === "rotate") && !keyOk)}>{mode === "add" ? "Add key" : mode === "rotate" ? "Rotate key" : mode === "revoke" ? "Revoke and lock" : "Go back to managed"}</button><button type="button" className="btn" onClick={reset}>Cancel</button></div>
        </form>
      )}
    </div>
  );
}
