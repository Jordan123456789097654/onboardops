"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { restoreCmkAction } from "@/actions/cmk";
import { logoutAction } from "@/actions/auth";
import { Brand, Field, useAction } from "@/components/ui";

/** Shown instead of the app while a workspace's customer-supplied encryption key is revoked. */
export function KeyLockedScreen({ workspace, isOwner }: { workspace: string; isOwner: boolean }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [key, setKey] = useState("");
  return (
    <div className="flex min-h-screen flex-col p-4">
      <div><Brand /></div>
      <div className="flex flex-1 items-center justify-center">
        <div className="card anim-pop w-full max-w-md space-y-3 p-6 text-[13px]">
          <KeyRound className="h-6 w-6 text-amber-600" />
          <h1 className="text-xl font-semibold">{workspace} is locked</h1>
          <p className="text-soft">The encryption key for this workspace was revoked, so its records cannot be read or changed. Nothing was deleted.</p>
          {isOwner ? (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); exec(() => restoreCmkAction({ key }), { success: "Key accepted. The workspace is unlocked.", onOk: () => { setKey(""); router.refresh(); } }); }}>
              <Field label="Provide your encryption key to unlock it"><textarea className="textarea mono" rows={3} value={key} onChange={(e) => setKey(e.target.value)} placeholder="64 hex characters, or 44 characters of base64" autoComplete="off" spellCheck={false} /></Field>
              <button className="btn-primary w-full" disabled={pending || key.trim().length < 40}>{pending ? "Checking…" : "Unlock workspace"}</button>
              <p className="text-xs text-soft">Only the exact key that was in use works. OnboardOps cannot recover it for you.</p>
            </form>
          ) : <p className="rounded-md border border-line bg-muted p-3">Ask the workspace owner to provide the encryption key.</p>}
          <form action={logoutAction}><button className="text-xs text-soft underline">Sign out</button></form>
        </div>
      </div>
    </div>
  );
}
