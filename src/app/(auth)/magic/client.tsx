"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { magicSignInAction } from "@/actions/auth";
import { Brand, ThemeToggle, useAction } from "@/components/ui";

export function MagicClient({ token, ws }: { token: string; ws?: string }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  return (
    <div className="flex min-h-screen flex-col p-4">
      <div className="flex items-center justify-between"><Link href="/" aria-label="OnboardOps home"><Brand /></Link><ThemeToggle /></div>
      <div className="flex flex-1 items-center justify-center">
        <div className="anim-pop w-full max-w-sm space-y-4 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-accent" />
          <h1 className="text-xl font-semibold">Ready to sign in</h1>
          <p className="text-[13px] text-soft">Press the button to finish signing in on this device. The link can only be used once.</p>
          {!token && <p className="rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800">This link is missing its token. Open the link from your email again.</p>}
          <button className="btn-primary !h-10 w-full !text-sm" disabled={pending || !token} onClick={() => exec(() => magicSignInAction({ token, ws }), { onOk: (d) => { router.push(d.to); router.refresh(); } })}>{pending ? "Signing in…" : "Continue"}</button>
          <p className="text-xs text-soft"><Link className="text-accent" href="/login">Use a password instead</Link></p>
        </div>
      </div>
    </div>
  );
}
