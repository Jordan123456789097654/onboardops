"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { staffLoginAction } from "@/actions/auth";
import { Field, ThemeToggle, useAction } from "./ui";
import { MagicLinkBox } from "./magic-link-box";

/** Workspace-branded sign-in for staff. Shown at /w/<slug> and at a workspace's custom domain. */
export function StaffLogin({ workspaceId, name, onCustomDomain }: { workspaceId: string; name: string; onCustomDomain: boolean }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [magic, setMagic] = useState(false);
  const initials = name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <aside className="hidden flex-col justify-between border-r border-line bg-surface p-10 lg:flex">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-accent-fg">{initials}</span><span className="font-display text-lg font-semibold tracking-[-0.03em]">{name}</span></div>
        <div><h2 className="max-w-sm text-2xl font-semibold">Your training, notices and checklists in one place.</h2><p className="mt-3 max-w-sm text-[13px] text-soft">Take your courses, read policies, complete shift checklists, and send requests to your manager.</p></div>
        <p className="text-xs text-soft">{onCustomDomain ? "Powered by OnboardOps" : <>Powered by <Link className="underline" href="/">OnboardOps</Link></>}</p>
      </aside>
      <div className="flex flex-col p-4">
        <div className="flex justify-between lg:justify-end"><span className="flex items-center gap-2 text-sm font-semibold lg:hidden"><span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-xs text-accent-fg">{initials}</span>{name}</span><ThemeToggle /></div>
        <div className="flex flex-1 items-center justify-center">
          {magic ? <div className="w-full max-w-sm"><p className="text-xs font-semibold text-accent">Staff sign in</p><h1 className="mb-3 mt-1 text-xl font-semibold">{name}</h1><MagicLinkBox workspaceId={workspaceId} initialEmail={email} onBack={() => setMagic(false)} /></div> : (
          <form className="w-full max-w-sm space-y-4" onSubmit={(e) => { e.preventDefault(); exec(() => staffLoginAction({ workspaceId, email, password }), { onOk: (d) => { router.push(d.to); router.refresh(); } }); }}>
            <div><p className="text-xs font-semibold text-accent">Staff sign in</p><h1 className="mt-1 text-xl font-semibold">{name}</h1><p className="mt-1 text-[13px] text-soft">Use the email your employer has on file.</p></div>
            <Field label="Email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></Field>
            <Field label="Password"><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></Field>
            <p className="-mt-2 text-right text-xs"><Link className="text-accent" href="/forgot-password">Forgot password?</Link></p>
            <button className="btn-primary !h-10 w-full !text-sm" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
            <button type="button" className="btn w-full" onClick={() => setMagic(true)}>Email me a sign-in link</button>
            <p className="text-xs text-soft">First time? Your manager can send you an invite link so you can choose a password.{!onCustomDomain && <> Managers and owners can also use the <Link className="text-accent" href="/login">main sign in</Link>.</>}</p>
          </form>)}
        </div>
      </div>
    </div>
  );
}
