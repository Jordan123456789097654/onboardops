"use client";
import { useState } from "react";
import Link from "next/link";
import { Brand, Field, ThemeToggle } from "@/components/ui";

/** Email first: the domain tells us which company identity provider to send you to. */
export function SsoEmail({ error }: { error?: string }) {
  const [email, setEmail] = useState("");
  return (
    <div className="flex min-h-screen flex-col p-4">
      <div className="flex items-center justify-between"><Link href="/" aria-label="OnboardOps home"><Brand /></Link><ThemeToggle /></div>
      <div className="flex flex-1 items-center justify-center">
        <form className="w-full max-w-sm space-y-4" onSubmit={(e) => { e.preventDefault(); window.location.href = `/api/auth/sso/start?email=${encodeURIComponent(email.trim())}`; }}>
          <div><h1 className="text-xl font-semibold">Sign in with single sign-on</h1><p className="mt-1 text-[13px] text-soft">Enter your work email. We send you to your company&apos;s sign-in page.</p></div>
          {error && <p role="alert" className="rounded-md border border-rose-300 bg-rose-50 p-3 text-[13px] text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">{error}</p>}
          <Field label="Work email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus required /></Field>
          <button className="btn-primary !h-10 w-full !text-sm" disabled={!email.includes("@")}>Continue</button>
          <p className="text-xs text-soft"><Link className="text-accent" href="/login">Use password instead</Link></p>
        </form>
      </div>
    </div>
  );
}
