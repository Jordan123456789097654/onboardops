"use client";
import { useState } from "react";

type Res = { ok: boolean; total?: number; brokenAt?: number; at?: string; head?: string };

export function VerifyButton() {
  const [res, setRes] = useState<Res | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { setRes(await (await fetch("/api/admin/audit-verify")).json()); } catch { setRes({ ok: false }); }
    setBusy(false);
  };
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px]">
      <button className="btn" disabled={busy} onClick={run}>{busy ? "Verifying…" : "Verify chain"}</button>
      {res && (res.ok ? <span className="text-emerald-700 dark:text-emerald-300">Chain intact: {res.total} entries. Head <span className="mono">{res.head?.slice(0, 12)}</span></span> : <span className="text-rose-600">{res.brokenAt ? `Chain broken at entry ${res.brokenAt} of ${res.total} (${res.at}).` : "Could not verify."}</span>)}
    </div>
  );
}
