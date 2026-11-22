"use client";
import { useState } from "react";

type Res = { ok: boolean; total?: number; brokenAt?: number; at?: string; head?: string; error?: string };

export function AuditTools() {
  const [res, setRes] = useState<Res | null>(null);
  const [busy, setBusy] = useState(false);
  const verify = async () => {
    setBusy(true);
    try { setRes(await (await fetch("/api/audit/verify")).json()); } catch { setRes({ ok: false, error: "Could not reach the server." }); }
    setBusy(false);
  };
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px]">
      <button className="btn" disabled={busy} onClick={verify}>{busy ? "Verifying…" : "Verify chain"}</button>
      <a className="btn" href="/api/export/audit">Export CSV</a>
      {res && (res.error
        ? <span className="text-rose-600">{res.error}</span>
        : res.ok
          ? <span className="text-emerald-700 dark:text-emerald-300">Chain intact: {res.total} entries verified. Head <span className="mono">{res.head?.slice(0, 12)}</span></span>
          : <span className="text-rose-600">Chain broken at entry {res.brokenAt} of {res.total} ({res.at}). Records before it are intact.</span>)}
    </div>
  );
}
