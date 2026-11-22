"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginAction, registerAction } from "@/actions/auth";
import { Brand, Field, ThemeToggle, useAction } from "@/components/ui";
import { MagicLinkBox } from "@/components/magic-link-box";

const points = ["One record per employee, from hire to audit trail", "Server-graded quizzes and printable certificates", "Confidential notes that employees never receive", "Free for beta testers"];

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [f, setF] = useState({ name: "", email: "", password: "", workspaceName: "" });
  const [accept, setAccept] = useState(false);
  const [magic, setMagic] = useState(false);
  const [kind, setKind] = useState<"OWNER" | "EMPLOYEE">("OWNER");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    exec(() => (mode === "login" ? loginAction({ email: f.email, password: f.password }) : registerAction({ ...f, accountType: kind, acceptTerms: accept, ref: (() => { try { return localStorage.getItem("oo-ref") ?? undefined; } catch { return undefined; } })(), address: new URLSearchParams(window.location.search).get("address") ?? undefined })), { onOk: (d) => { router.push(d.to); router.refresh(); } });
  };
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <aside className="hidden flex-col justify-between border-r border-line bg-surface p-10 lg:flex">
        <Link href="/" aria-label="OnboardOps home"><Brand intro /></Link>
        <div>
          <h2 className="max-w-sm text-2xl font-semibold">Stop running HR out of spreadsheets and training out of group chats.</h2>
          <ul className="mt-6 space-y-2 text-[13px] text-soft">{points.map((p) => <li key={p} className="flex gap-2"><span className="mono">+</span>{p}</li>)}</ul>
        </div>
        <p className="mono text-xs text-soft">Based in Georgia, USA · Beta</p>
      </aside>
      <div className="flex flex-col p-4">
        <div className="flex justify-between lg:justify-end"><Link href="/" aria-label="OnboardOps home" className="lg:hidden"><Brand /></Link><ThemeToggle /></div>
        <div className="flex flex-1 items-center justify-center">
          {mode === "login" && magic ? <div className="w-full max-w-sm"><h1 className="mb-3 text-xl font-semibold">Sign in with a link</h1><MagicLinkBox initialEmail={f.email} onBack={() => setMagic(false)} /></div> : (
          <form onSubmit={submit} className="w-full max-w-sm space-y-4">
            <div><h1 className="text-xl font-semibold">{mode === "login" ? "Sign in" : kind === "OWNER" ? "Create a workspace" : "Create your account"}</h1><p className="mt-1 text-[13px] text-soft">{mode === "login" ? "Welcome back." : kind === "OWNER" ? "Free during the beta. No card needed." : "For employees. After you verify your email, the workplaces that added you appear for you to join."}</p></div>
            {mode === "register" && (
              <div role="radiogroup" aria-label="Account type" className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-muted p-1 text-[13px]">
                {([["OWNER", "I run a company"], ["EMPLOYEE", "I work for a company"]] as const).map(([k, l]) => <button type="button" key={k} role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`rounded-md px-2 py-1.5 font-medium transition-all ${kind === k ? "bg-surface shadow-sm" : "text-soft hover:text-ink"}`}>{l}</button>)}
              </div>
            )}
            {mode === "register" && (<>
              <Field label="Your name"><input className="input" value={f.name} onChange={set("name")} autoComplete="name" required /></Field>
              {kind === "OWNER" && <Field label="Company name"><input className="input" value={f.workspaceName} onChange={set("workspaceName")} required /></Field>}
            </>)}
            <Field label={mode === "register" && kind === "EMPLOYEE" ? "Email (use the one your employer has for you)" : "Work email"}><input className="input" type="email" value={f.email} onChange={set("email")} autoComplete="email" required /></Field>
            <Field label="Password"><input className="input" type="password" value={f.password} onChange={set("password")} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "register" ? 8 : 1} /></Field>
            {mode === "login" && <p className="-mt-2 text-right text-xs"><Link className="text-accent" href="/forgot-password">Forgot password?</Link></p>}
            {mode === "register" && (
              <label className="flex items-start gap-2 text-xs text-soft">
                <input type="checkbox" className="mt-0.5" checked={accept} onChange={(e) => setAccept(e.target.checked)} required />
                <span>I am at least 13 years old (with a parent or guardian's permission if under 18) and agree to the <Link className="text-accent underline" href="/legal/terms-of-service" target="_blank">Terms of Service</Link>, <Link className="text-accent underline" href="/legal/privacy" target="_blank">Privacy Policy</Link> and <Link className="text-accent underline" href="/legal/beta-terms" target="_blank">Beta Program Terms</Link>.</span>
              </label>
            )}
            <button className="btn-primary !h-10 w-full !text-sm" disabled={pending || (mode === "register" && !accept)}>{pending ? "Working…" : mode === "login" ? "Sign in" : kind === "OWNER" ? "Create workspace" : "Create account"}</button>
            {mode === "login" && <button type="button" className="btn w-full" onClick={() => setMagic(true)}>Email me a sign-in link instead</button>}
            <p className="text-xs text-soft">{mode === "login" ? <>New here? <Link className="text-accent" href="/register">Create an account</Link>. Employee? <Link className="text-accent" href="/staff">Find your workplace sign in</Link></> : <>Already have an account? <Link className="text-accent" href="/login">Sign in</Link></>}</p>
          </form>)}
        </div>
      </div>
    </div>
  );
}
