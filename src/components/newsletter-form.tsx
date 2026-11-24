"use client";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import { subscribeNewsletterAction } from "@/actions/newsletter";
import { useAction } from "@/components/ui";

/** Subscribe form. Nothing is sent to anyone until they confirm from the email we send. */
export function NewsletterForm({ compact = false }: { compact?: boolean }) {
  const { exec, pending } = useAction();
  const [email, setEmail] = useState("");
  const [hp, setHp] = useState("");
  const [done, setDone] = useState(false);
  if (done) {
    return (
      <div className="flex items-start gap-2.5 text-[13.5px] text-emerald-800 dark:text-emerald-300" role="status">
        <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p><strong>Check your email.</strong> We sent a link to confirm your address. If it doesn&apos;t show up in a few minutes, look in spam.</p>
      </div>
    );
  }
  return (
    <form className={compact ? "flex flex-wrap items-center gap-2" : "space-y-2"} onSubmit={(e) => { e.preventDefault(); exec(() => subscribeNewsletterAction({ email, website: hp }), { onOk: () => setDone(true) }); }}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="news-email">Email address</label>
        <input id="news-email" className="input !w-72" type="email" required placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" name="website" value={hp} onChange={(e) => setHp(e.target.value)} />
        <button className="btn-primary" disabled={pending}>{pending ? "Sending…" : "Subscribe"}</button>
      </div>
      {!compact && <p className="text-[12px] text-soft">Every issue is on this page. We only email the bigger ones. Unsubscribe any time.</p>}
    </form>
  );
}
