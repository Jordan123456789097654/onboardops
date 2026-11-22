"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPartnerAction, deletePartnerAction } from "@/actions/partners";
import { Empty, Field, useAction, useToast } from "@/components/ui";

type P = { id: string; code: string; name: string; contact: string; signups: number };

export function PartnersAdmin({ partners, isOwner }: { partners: P[]; isOwner: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();
  const [f, setF] = useState({ code: "", name: "", contact: "" });
  const link = (c: string) => `https://onboardops.org/?ref=${c}`;
  return (
    <div className="space-y-4">
      <div className="card grid gap-3 p-4 sm:grid-cols-4">
        <Field label="Code"><input className="input mono" placeholder="acme-hr" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>
        <Field label="Partner name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Contact (optional)"><input className="input" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></Field>
        <div className="flex items-end"><button className="btn-primary w-full" disabled={pending} onClick={() => exec(() => createPartnerAction(f), { success: "Partner added", onOk: () => { setF({ code: "", name: "", contact: "" }); router.refresh(); } })}>Add partner</button></div>
      </div>
      {partners.length === 0 ? <Empty title="No partners yet" /> : (
        <div className="card divide-y divide-line">{partners.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-[13px]">
            <div className="min-w-0 flex-1"><div className="font-medium">{p.name}</div><div className="mono break-all text-xs text-soft">{link(p.code)}</div></div>
            <span className="mono">{p.signups} signup{p.signups === 1 ? "" : "s"}</span>
            <button className="btn" onClick={() => { navigator.clipboard?.writeText(link(p.code)); toast("ok", "Link copied"); }}>Copy link</button>
            {isOwner && <button className="btn-danger" disabled={pending} onClick={() => { if (confirm(`Delete ${p.name}? Past signups keep their count only if you re-add the same code.`)) exec(() => deletePartnerAction(p.id), { onOk: () => router.refresh() }); }}>Delete</button>}
          </div>
        ))}</div>
      )}
    </div>
  );
}
