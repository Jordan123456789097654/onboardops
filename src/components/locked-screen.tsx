import Link from "next/link";
import { Lock } from "lucide-react";
import { Brand } from "./ui";
import { logoutAction } from "@/actions/auth";

export function LockedScreen({ workspace, reason, canExport, title, message }: { workspace: string; reason: string; canExport: boolean; title?: string; message?: string }) {
  return (
    <div className="flex min-h-screen flex-col p-4">
      <div><Brand /></div>
      <div className="flex flex-1 items-center justify-center">
        <div className="card anim-pop w-full max-w-md space-y-3 p-6 text-[13px]">
          <Lock className="h-6 w-6 text-rose-600" />
          <h1 className="text-xl font-semibold">{title ?? `${workspace} is locked`}</h1>
          <p className="text-soft">{message ?? "OnboardOps locked this workspace, so nobody can use it right now."}</p>
          {reason && <p className="rounded-md border border-line bg-muted p-3"><span className="text-xs text-soft">Reason</span><br />{reason}</p>}
          <div className="flex flex-wrap gap-2">
            <Link href="/contact" className="btn-primary">Contact support</Link>
            {canExport && <a href="/api/export/workspace" className="btn">Download your data</a>}
          </div>
          <form action={logoutAction}><button className="text-xs text-soft underline">Sign out</button></form>
        </div>
      </div>
    </div>
  );
}
