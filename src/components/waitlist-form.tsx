"use client";
import { useState } from "react";
import { joinWaitlistAction } from "@/actions/waitlist";
import { useAction } from "@/components/ui";

export function WaitlistForm() {
  const { exec, pending } = useAction();
  const [email, setEmail] = useState("");
  const [hp, setHp] = useState("");
  const [done, setDone] = useState(false);
  if (done) return <p className="text-[13px] text-emerald-700 dark:text-emerald-300">Thanks. We will email you when there is news. We only use this address for that.</p>;
  return (
    <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); exec(() => joinWaitlistAction({ email, website: hp }), { onOk: () => setDone(true) }); }}>
      <label className="sr-only" htmlFor="waitlist-email">Email address</label>
      <input id="waitlist-email" className="input !w-64" type="email" required placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" name="website" value={hp} onChange={(e) => setHp(e.target.value)} />
      <button className="btn-primary" disabled={pending}>{pending ? "Adding…" : "Keep me posted"}</button>
    </form>
  );
}
