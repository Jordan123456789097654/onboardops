"use client";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { endSupportAccessAction } from "@/actions/admin";
import { useAction } from "./ui";
import { fmtDateTime } from "@/lib/utils";

/** Always-visible notice while a staff member is in a customer workspace with support access. */
export function SupportBanner({ workspace, until }: { workspace: string; until: string }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  return (
    <div role="status" className="no-print anim-fade-up fixed bottom-4 left-1/2 z-[80] flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-3 rounded-full border border-amber-400 bg-amber-50 px-4 py-2 text-[13px] text-amber-950 shadow-xl dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
      <Eye className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline">Support access to <b>{workspace}</b>, read-only, until <span className="mono">{fmtDateTime(until)}</span></span>
      <span className="sm:hidden">Support access, read-only</span>
      <button className="btn !h-7" disabled={pending} onClick={() => exec(() => endSupportAccessAction(), { onOk: () => { window.location.href = "/admin"; } })}>End access</button>
    </div>
  );
}
