"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { verifyEmailAction } from "@/actions/auth";
import { Brand, ThemeToggle } from "@/components/ui";

export function VerifyClient({ token, emailId }: { token: string; emailId?: string }) {
  const [state, setState] = useState<{ status: "working" | "ok" | "error"; msg?: string; signedIn?: boolean }>({ status: "working" });
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!token) { setState({ status: "error", msg: "This link is missing its token." }); return; }
    verifyEmailAction(token, emailId).then((r) => setState(r.ok ? { status: "ok", signedIn: r.data.signedIn } : { status: "error", msg: r.error }));
  }, [token, emailId]);
  return (
    <div className="flex min-h-screen flex-col p-4">
      <div className="flex items-center justify-between"><Link href="/" aria-label="OnboardOps home"><Brand /></Link><ThemeToggle /></div>
      <div className="flex flex-1 items-center justify-center">
        <div className="anim-pop w-full max-w-sm space-y-3 text-center">
          {state.status === "working" && <p className="text-[13px] text-soft">Verifying…</p>}
          {state.status === "ok" && <><CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" /><h1 className="text-xl font-semibold">Email verified</h1><p className="text-[13px] text-soft">Your email address is confirmed. You can use it to sign in and to find workplaces that added you.</p><Link className="btn-primary" href={state.signedIn ? "/workplaces" : "/login"}>{state.signedIn ? "See my workplaces" : "Sign in"}</Link></>}
          {state.status === "error" && <><XCircle className="mx-auto h-8 w-8 text-rose-600" /><h1 className="text-xl font-semibold">We couldn&apos;t verify that link</h1><p className="text-[13px] text-soft">{state.msg}</p><Link className="btn" href="/workplaces">Go to my workplaces</Link></>}
        </div>
      </div>
    </div>
  );
}
