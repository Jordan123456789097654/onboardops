"use client";
import { useState } from "react";
import { Copy, Download } from "lucide-react";
import { useToast } from "@/components/ui";

/** Shows backup codes once. They cannot be shown again, so this offers copy and download. */
export function BackupCodes({ codes }: { codes: string[] }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const text = `OnboardOps backup codes\nEach code works once. Keep them somewhere safe.\n\n${codes.join("\n")}\n`;
  return (
    <div>
      <ul className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-muted p-3 sm:grid-cols-5" aria-label="Backup codes">
        {codes.map((c) => <li key={c} className="mono text-center text-[13px] font-medium tracking-wide">{c}</li>)}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn" onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); } catch { toast("error", "Could not copy. Select the codes and copy them by hand."); } }}><Copy className="h-3.5 w-3.5" />{copied ? "Copied" : "Copy"}</button>
        <a className="btn" download="onboardops-backup-codes.txt" href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`}><Download className="h-3.5 w-3.5" />Download</a>
      </div>
      <p className="mt-3 text-xs text-soft">Each code works one time. If you lose your phone, a backup code is the only way back in without asking a workspace owner for help.</p>
    </div>
  );
}
