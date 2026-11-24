"use client";
import { useState } from "react";
import Link from "next/link";
import { unsubscribeNewsletterAction } from "@/actions/newsletter";
import { useAction } from "@/components/ui";

export function UnsubscribeButton({ token }: { token: string }) {
  const { exec, pending } = useAction();
  const [done, setDone] = useState<null | boolean>(null);
  if (done !== null) {
    return done ? <p className="text-[15px] text-soft">You&apos;re unsubscribed. Sorry to see you go. You can read every issue on the <Link className="text-accent underline" href="/newsletter">newsletter page</Link>.</p> : <p className="text-[15px] text-soft">That link isn&apos;t valid, or you were already unsubscribed.</p>;
  }
  return <button className="btn-primary" disabled={pending || !token} onClick={() => exec(() => unsubscribeNewsletterAction(token), { onOk: (r) => setDone(r.done) })}>{pending ? "Working…" : "Yes, unsubscribe me"}</button>;
}
