"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Globe } from "lucide-react";
import { checkDomainAction, connectDomainAction, removeDomainAction } from "@/actions/domain";
import { Badge, Field, useAction, useToast } from "@/components/ui";
import type { DomainDetails } from "@/lib/vercel-domains";

export function DomainPanel({ slug, baseUrl, domain, status, details, vercel }: { slug: string; baseUrl: string; domain: string | null; status: string; details: DomainDetails | null; vercel: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();
  const [name, setName] = useState("");
  const copy = (t: string) => { navigator.clipboard?.writeText(t); toast("ok", "Copied"); };
  const staffUrl = `${baseUrl}/w/${slug}`;
  const rows: [string, string, string][] = [];
  if (domain && details) {
    for (const v of details.verification) rows.push([v.type, v.domain, v.value]);
    rows.push(details.apex ? ["A", "@", details.a] : ["CNAME", domain.split(".")[0], details.cname]);
  }
  return (
    <div className="space-y-4">
      <div className="card p-4 text-[13px]">
        <h2 className="text-sm font-semibold">Staff sign-in link</h2>
        <p className="mt-1 text-soft">Share this with your team. It opens a sign-in page branded with your company name, for employees of {slug}.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2"><code className="mono rounded-md border border-line bg-muted px-2 py-1 text-xs">{staffUrl}</code><button className="btn" onClick={() => copy(staffUrl)}><Copy className="h-3.5 w-3.5" />Copy</button></div>
      </div>

      <div className="card p-4 text-[13px]">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Globe className="h-4 w-4" />Custom domain</h2>
        {!domain ? (
          <form className="mt-2 space-y-3" onSubmit={(e) => { e.preventDefault(); exec(() => connectDomainAction({ domain: name }), { success: "Domain added.", onOk: () => router.refresh() }); }}>
            <p className="text-soft">Put your staff sign-in on an OnboardOps subdomain like <span className="mono">{slug}.onboardops.org</span>, or your own address such as <span className="mono">hr.yourcompany.com</span>.</p>
            <Field label="Domain"><input className="input mono" value={name} onChange={(e) => setName(e.target.value)} placeholder={`${slug}.onboardops.org`} /></Field>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" disabled={pending || name.length < 4}>{pending ? "Connecting…" : "Connect domain"}</button>
              <button type="button" className="btn" onClick={() => setName(`${slug}.onboardops.org`)}>Use {slug}.onboardops.org</button>
            </div>
            {!vercel && <p className="text-xs text-soft">Automatic Vercel connection is not configured on this server (VERCEL_API_TOKEN and VERCEL_PROJECT_ID), so external domains must also be added to the Vercel project by the site owner.</p>}
          </form>
        ) : (
          <div className="mt-2 space-y-3">
            <div className="flex flex-wrap items-center gap-2"><span className="mono text-sm font-medium">{domain}</span>{status === "VERIFIED" ? <Badge value="ACTIVE" label="Connected" /> : status === "ERROR" ? <Badge value="FAILED" label="Error" /> : <Badge value="PENDING" label="Waiting for DNS" />}{status === "VERIFIED" && <a className="text-accent underline" href={`https://${domain}`} target="_blank" rel="noreferrer">Open</a>}</div>
            {details?.error && <p className="rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">{details.error}</p>}
            {status !== "VERIFIED" && (
              <>
                <p className="text-soft">Add these records at your domain provider (where you bought the domain). Changes can take a few minutes to a few hours to spread.</p>
                <div className="overflow-x-auto rounded-md border border-line"><table className="w-full border-collapse text-left text-xs"><thead><tr>{["Type", "Name / host", "Value"].map((h) => <th key={h} className="th !static">{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}><td className="td mono !text-xs">{r[0]}</td><td className="td mono !text-xs">{r[1]}</td><td className="td mono break-all !text-xs">{r[2]} <button className="ml-1 text-accent" onClick={() => copy(r[2])}>copy</button></td></tr>)}</tbody></table></div>
                {details?.manual && <p className="text-xs text-soft">Check runs a DNS lookup. The domain must also be added to the Vercel project; ask the OnboardOps site owner if it is not yet.</p>}
              </>
            )}
            <div className="flex flex-wrap gap-2">
              <button className="btn" disabled={pending} onClick={() => exec(() => checkDomainAction(), { onOk: (r) => { toast(r.status === "VERIFIED" ? "ok" : "error", r.status === "VERIFIED" ? "Domain connected" : r.error ?? "Not connected yet. DNS may still be updating."); router.refresh(); } })}>Check status</button>
              <button className="btn-danger" disabled={pending} onClick={() => { if (confirm(`Remove ${domain}? Staff will need to use the standard sign-in link.`)) exec(() => removeDomainAction(), { success: "Domain removed", onOk: () => router.refresh() }); }}>Remove domain</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
