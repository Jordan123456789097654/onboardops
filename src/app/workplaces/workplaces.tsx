"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, MailCheck } from "lucide-react";
import { resendVerificationAction } from "@/actions/auth";
import { switchWorkspaceAction } from "@/actions/auth";
import { claimWorkplaceAction } from "@/actions/workplaces";
import { Badge, Empty, useAction } from "@/components/ui";

type Mine = { id: string; name: string; role: string; staffCode: string | null; locked: boolean; domain: string | null; slug: string };
type Claim = { id: string; workspace: string; staffCode: string; role: string | null; department: string | null };

export function Workplaces({ verified, mine, claimable }: { verified: boolean; mine: Mine[]; claimable: Claim[] }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [devLink, setDevLink] = useState<string | undefined>();
  const [sent, setSent] = useState(false);
  return (
    <div className="mt-6 space-y-8">
      {!verified && (
        <div className="anim-fade-up rounded-lg border border-amber-300 bg-amber-50 p-4 text-[13px] text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <div className="flex items-start gap-3"><MailCheck className="mt-0.5 h-4 w-4 shrink-0" /><div className="flex-1"><p className="font-medium">Verify your email to find your workplaces</p><p className="mt-1">We sent a link to your email. Once it is confirmed, any employer that added you with this address will show up here for you to join.</p>
            {devLink && <p className="mt-2 break-all text-xs">Local development: <a className="underline" href={devLink}>{devLink}</a></p>}
            <button className="btn mt-3" disabled={pending || sent} onClick={() => exec(() => resendVerificationAction(), { success: "Verification email sent", onOk: (r) => { setSent(true); setDevLink(r.devLink); } })}>{sent ? "Sent. Check your inbox" : "Send the link again"}</button></div></div>
        </div>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold">My workplaces</h2>
        {mine.length === 0 ? <Empty title="You are not part of a workplace yet" hint={verified ? "If your employer already added you, it appears below for you to join." : "Verify your email, then your employer's workspace will appear here."} /> : (
          <div className="space-y-2">
            {mine.map((m, i) => (
              <div key={m.id} style={{ "--i": i } as React.CSSProperties} className="card lift anim-fade-up flex flex-wrap items-center gap-3 p-4">
                <Building2 className="h-5 w-5 text-soft" />
                <div className="min-w-0 flex-1"><div className="font-medium">{m.name}</div><div className="text-xs text-soft">{m.role.charAt(0) + m.role.slice(1).toLowerCase()}{m.staffCode ? ` · ${m.staffCode}` : ""}</div></div>
                {m.locked ? <Badge value="SUSPENDED" label="Locked" /> : <button className="btn-primary" onClick={() => switchWorkspaceAction(m.id)}>Open <ArrowRight className="h-3.5 w-3.5" /></button>}
                {m.domain && <a className="mono w-full text-xs text-accent" href={`https://${m.domain}`}>{m.domain}</a>}
              </div>
            ))}
          </div>
        )}
      </section>

      {verified && claimable.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-semibold">Employers that added you</h2>
          <p className="mb-2 text-xs text-soft">These employee records match your verified email. Join the ones that are yours.</p>
          <div className="space-y-2">
            {claimable.map((c, i) => (
              <div key={c.id} style={{ "--i": i } as React.CSSProperties} className="card anim-fade-up flex flex-wrap items-center gap-3 border-accent p-4">
                <div className="min-w-0 flex-1"><div className="font-medium">{c.workspace}</div><div className="text-xs text-soft">{[c.staffCode, c.role, c.department].filter(Boolean).join(" · ")}</div></div>
                <button className="btn-primary" disabled={pending} onClick={() => exec(() => claimWorkplaceAction(c.id), { success: "You joined this workplace", onOk: () => { router.push("/app/my-portal"); router.refresh(); } })}>Join</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
