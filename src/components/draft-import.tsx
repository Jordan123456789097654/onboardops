"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { importDraftAction } from "@/actions/draft-import";
import { DRAFT_KEY } from "@/lib/tools";
import { useAction } from "@/components/ui";

/** Offers to add a draft made with the free public tools to this workspace. Shown on the Command Center. */
export function DraftImport() {
  const { exec, pending } = useAction();
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [result, setResult] = useState<{ what: string; href: string } | null>(null);
  useEffect(() => { try { const raw = localStorage.getItem(DRAFT_KEY); if (raw) setDraft(JSON.parse(raw)); } catch { /* none */ } }, []);
  if (result) return <p className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-[13px] text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">{result.what} <Link className="underline" href={result.href}>Open</Link></p>;
  if (!draft) return null;
  const label = draft.kind === "policy" ? `the policy "${String(draft.title)}"` : draft.kind === "caseTemplate" ? `the write-up template "${String(draft.name)}"` : "your discipline ladder rules";
  const discard = () => { try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } setDraft(null); };
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-line bg-muted p-3 text-[13px]">
      <span className="min-w-0 flex-1">You saved a draft from our free tools: {label}. Add it to this workspace? It will be unpublished or inactive until you review it.</span>
      <button className="btn-primary" disabled={pending} onClick={() => exec(() => importDraftAction(draft), { onOk: (r) => { setResult(r); discard(); } })}>Add to my workspace</button>
      <button className="btn" onClick={discard}>Discard</button>
    </div>
  );
}
