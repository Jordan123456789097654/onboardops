"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { findWorkplaceAction } from "@/actions/auth";
import { Brand, Field, ThemeToggle, useAction } from "@/components/ui";

export function FindWorkplace() {
  const { exec, pending } = useAction();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ url: string; name: string }[] | null>(null);
  return (
    <div className="flex min-h-screen flex-col p-4">
      <div className="flex items-center justify-between"><Link href="/" aria-label="OnboardOps home"><Brand /></Link><ThemeToggle /></div>
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-sm space-y-4">
          <div><h1 className="text-xl font-semibold">Find your workplace</h1><p className="mt-1 text-[13px] text-soft">Type your company&apos;s name or its sign-in address to open its staff login.</p></div>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); exec(() => findWorkplaceAction(q), { onOk: setHits }); }}>
            <Field label="Company name or address"><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Northside Supply" required /></Field>
            <button className="btn-primary w-full" disabled={pending}>{pending ? "Searching…" : "Find"}</button>
          </form>
          {hits && (hits.length === 0 ? <p className="text-[13px] text-soft">No workplace found. Ask your manager for your staff sign-in link.</p> : <div className="space-y-2">{hits.map((h) => <Link key={h.url} href={h.url} className="card lift flex items-center justify-between p-3 text-[13px] font-medium">{h.name}<ArrowRight className="h-4 w-4 text-soft" /></Link>)}</div>)}
          <p className="text-xs text-soft">Have a personal account? <Link className="text-accent" href="/login">Sign in</Link> or <Link className="text-accent" href="/register">create an employee account</Link> to see every workplace you are employed in.</p>
        </div>
      </div>
    </div>
  );
}
