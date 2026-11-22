"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { checkAddressPublicAction } from "@/actions/partners";

/** Homepage box: is yourcompany.onboardops.org free? Nothing is reserved until you create a workspace. */
export function ReserveAddress({ zone }: { zone: string }) {
  const [name, setName] = useState("");
  const [res, setRes] = useState<{ ok: boolean; text: string; slug?: string } | null>(null);
  useEffect(() => {
    const v = name.trim().toLowerCase();
    if (v.length < 3) { setRes(null); return; }
    const t = setTimeout(async () => {
      const r = await checkAddressPublicAction(v);
      if (!r.ok) setRes({ ok: false, text: r.error });
      else setRes(r.data.available ? { ok: true, text: `${r.data.slug}.${zone} is available`, slug: r.data.slug } : { ok: false, text: r.data.error });
    }, 400);
    return () => clearTimeout(t);
  }, [name, zone]);
  return (
    <div className="mt-6 max-w-xl rounded-lg border border-line bg-surface p-4" aria-label="Check your address">
      <label htmlFor="addr" className="text-[13px] font-medium">Claim your team&apos;s address</label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input id="addr" className="input mono !w-48" placeholder="yourcompany" maxLength={40} value={name} onChange={(e) => setName(e.target.value.toLowerCase())} autoComplete="off" />
        <span className="mono text-sm text-soft">.{zone}</span>
        {res?.ok && res.slug && <Link href={`/register?address=${encodeURIComponent(res.slug)}`} className="btn-primary">Create workspace with this name</Link>}
      </div>
      <p aria-live="polite" className={`mt-2 min-h-5 text-xs ${res ? (res.ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600") : "text-soft"}`}>{res ? res.text : "Type a name to see if it is free. We do not hold it until you sign up."}</p>
    </div>
  );
}
