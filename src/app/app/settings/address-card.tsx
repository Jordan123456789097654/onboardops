"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { checkSubdomainNameAction, claimSubdomainAction, releaseSubdomainAction, subdomainStatusAction } from "@/actions/subdomain";
import { Badge, useAction, useToast } from "@/components/ui";

export type Address = { enabled: boolean; slug: string; status: string; zone: string; isOwner: boolean };

export function AddressCard({ a }: { a: Address }) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();
  const [name, setName] = useState(a.slug);
  const [hint, setHint] = useState<{ ok: boolean; text: string } | null>(null);
  const [live, setLive] = useState<boolean | null>(null);
  const host = a.slug ? `${a.slug}.${a.zone}` : "";

  useEffect(() => {
    const v = name.trim().toLowerCase();
    if (!a.enabled || !a.isOwner || v.length < 3 || v === a.slug) { setHint(null); return; }
    const t = setTimeout(async () => {
      const r = await checkSubdomainNameAction(v);
      if (r.ok) setHint(r.data.available ? { ok: true, text: `${v}.${a.zone} is available` } : { ok: false, text: r.data.error });
    }, 350);
    return () => clearTimeout(t);
  }, [name, a.enabled, a.isOwner, a.slug, a.zone]);

  if (!a.enabled) return null;
  return (
    <div className="card p-4 text-[13px]">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><Globe className="h-4 w-4" />Your OnboardOps address</h2>
      <p className="mt-1 text-soft">A short address for your team&apos;s sign-in page, like <span className="mono">yourcompany.{a.zone}</span>. It is set up automatically, and there is nothing to configure at a domain provider.</p>
      {a.slug && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a className="mono text-sm font-medium text-accent" href={`https://${host}`} target="_blank" rel="noreferrer">{host}</a>
          {a.status === "ACTIVE" ? <Badge value="ACTIVE" label="Active" /> : <Badge value="PENDING" label="Setting up" />}
          <button className="btn" disabled={pending} onClick={async () => { const r = await subdomainStatusAction(); if (r.ok) { setLive(r.data.live); toast(r.data.live ? "ok" : "error", r.data.live ? "The address is live." : "Still spreading through the internet. This can take a few minutes."); } }}>Check now</button>
          {live === false && <span className="text-xs text-soft">New addresses can take a few minutes to start working.</span>}
        </div>
      )}
      {a.isOwner ? (
        <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); exec(() => claimSubdomainAction({ slug: name }), { success: "Address saved. It may take a few minutes to start working.", onOk: () => router.refresh() }); }}>
          <div className="flex flex-wrap items-center gap-2">
            <input className="input mono !w-56" value={name} onChange={(e) => setName(e.target.value.toLowerCase())} placeholder="yourcompany" maxLength={40} aria-label="Address name" />
            <span className="mono text-soft">.{a.zone}</span>
            <button className="btn-primary" disabled={pending || name.trim().length < 3 || name.trim() === a.slug || (hint !== null && !hint.ok)}>{a.slug ? "Change address" : "Claim address"}</button>
            {a.slug && <button type="button" className="btn-danger" disabled={pending} onClick={() => { if (confirm(`Release ${host}? Anyone using it will need your standard sign-in link.`)) exec(() => releaseSubdomainAction(), { success: "Address released", onOk: () => router.refresh() }); }}>Release</button>}
          </div>
          {hint && <p className={`text-xs ${hint.ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600"}`}>{hint.text}</p>}
          <p className="text-xs text-soft">Use 3 to 40 letters, numbers or hyphens. Changing the address stops the old one from working.</p>
        </form>
      ) : <p className="mt-2 text-xs text-soft">Only the workspace owner can change this.</p>}
    </div>
  );
}
