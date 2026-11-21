"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { resetPasswordAction } from "@/actions/auth";
import { Brand, Field, ThemeToggle, useAction, useToast } from "@/components/ui";

export function ResetForm({ token, invite }: { token: string; invite: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  return (
    <div className="flex min-h-screen flex-col p-4">
      <div className="flex items-center justify-between"><Link href="/" aria-label="OnboardOps home"><Brand /></Link><ThemeToggle /></div>
      <div className="flex flex-1 items-center justify-center">
        <form className="w-full max-w-sm space-y-4" onSubmit={(e) => {
          e.preventDefault();
          if (pw !== pw2) return toast("error", "The two passwords do not match.");
          exec(() => resetPasswordAction({ token, password: pw }), { onOk: (d) => { router.push(d.to); router.refresh(); } });
        }}>
          <div><h1 className="text-xl font-semibold">{invite ? "Set your password" : "Choose a new password"}</h1><p className="mt-1 text-[13px] text-soft">Use at least 8 characters. Other devices will be signed out.</p></div>
          {!token && <p className="rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800">This link is missing its token. Open the link from your email again.</p>}
          <Field label="New password"><input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" minLength={8} required /></Field>
          <Field label="Confirm password"><input className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" minLength={8} required /></Field>
          <button className="btn-primary !h-10 w-full !text-sm" disabled={pending || !token}>{pending ? "Saving…" : "Save password"}</button>
        </form>
      </div>
    </div>
  );
}
