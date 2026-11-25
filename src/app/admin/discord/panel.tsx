"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { linkDiscordAction, unlinkDiscordAction } from "@/actions/discord-link";
import { Field, useAction } from "@/components/ui";

export function DiscordLinkPanel({ linked, linkedAt, botReady }: { linked: boolean; linkedAt: string | null; botReady: boolean }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [code, setCode] = useState("");
  return (
    <div className="max-w-xl space-y-4">
      {!botReady && <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">The bot&apos;s connection key is not set on the website yet (STAFF_BOT_KEY), so the bot can&apos;t reach it.</p>}
      {linked ? (
        <section className="card space-y-3 p-4">
          <h2 className="text-sm font-semibold">Your Discord account is linked</h2>
          <p className="text-[13px] text-soft">Linked on {linkedAt ? new Date(linkedAt).toLocaleDateString() : ""}. Removing the link stops the bot acting for you.</p>
          <button className="btn" disabled={pending} onClick={() => exec(() => unlinkDiscordAction(), { success: "Unlinked", onOk: () => router.refresh() })}>Unlink Discord</button>
        </section>
      ) : (
        <section className="card space-y-3 p-4">
          <h2 className="text-sm font-semibold">Link your Discord account</h2>
          <ol className="list-decimal space-y-1 pl-5 text-[13px] text-soft">
            <li>In the staff Discord server, run <span className="mono">/link</span>. The bot replies privately with a code.</li>
            <li>Type the code below. It works for 10 minutes.</li>
          </ol>
          <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); exec(() => linkDiscordAction({ code }), { success: "Linked", onOk: () => { setCode(""); router.refresh(); } }); }}>
            <Field label="Code"><input className="input !w-44 mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={12} placeholder="ABCD-EFGH" autoComplete="off" /></Field>
            <button className="btn-primary" disabled={pending || code.replace(/[^A-Z0-9]/gi, "").length < 8}>Link</button>
          </form>
          <p className="text-xs text-soft">Staff accounts need two-step sign-in turned on to use the bot.</p>
        </section>
      )}
    </div>
  );
}
