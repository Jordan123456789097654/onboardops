"use client";
import { useState } from "react";
import { subscribeStatusAction } from "./subscribe-action";

export function StatusUpdatesForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await subscribeStatusAction(email);
    setBusy(false);
    if (!r.ok) setError(r.error ?? "Something went wrong. Try again.");
    else setDone(true);
  }

  if (done) {
    return <p className="mt-8 rounded-lg border border-line bg-muted px-4 py-3 text-sm">Check your inbox for a confirmation link. If it doesn't arrive in a few minutes, check your spam folder.</p>;
  }
  return (
    <form onSubmit={submit} className="mt-8 flex flex-col gap-3 sm:flex-row">
      <input className="input flex-1" type="email" required maxLength={254} placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email address" />
      <button className="btn-primary justify-center" disabled={busy}>{busy ? "Sending…" : "Subscribe"}</button>
      {error && <p className="text-sm text-rose-600 sm:basis-full">{error}</p>}
    </form>
  );
}
