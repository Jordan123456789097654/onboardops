"use client";
import { useState } from "react";
import { helpfulAction } from "@/actions/help-feedback";
import { useAction } from "@/components/ui";

export function HelpfulVote({ slug }: { slug: string }) {
  const { exec, pending } = useAction();
  const [stage, setStage] = useState<"ask" | "comment" | "done">("ask");
  const [comment, setComment] = useState("");
  const [hp, setHp] = useState("");
  const send = (helpful: boolean) => exec(() => helpfulAction({ slug, helpful, comment, website: hp }), { onOk: () => setStage("done") });
  if (stage === "done") return <div className="card mt-8 p-4 text-[13px]">Thanks for the feedback. It helps us improve this guide.</div>;
  return (
    <div className="card mt-8 p-4 text-[13px]" role="group" aria-label="Was this article helpful?">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Was this helpful?</span>
        <button className="btn" disabled={pending} onClick={() => send(true)}>Yes</button>
        <button className="btn" disabled={pending} onClick={() => setStage("comment")}>No</button>
      </div>
      {stage === "comment" && (
        <div className="mt-3 space-y-2">
          <label className="text-xs text-soft" htmlFor="why">What was missing or confusing? (optional, please do not include personal details)</label>
          <textarea id="why" className="textarea" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
          <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={hp} onChange={(e) => setHp(e.target.value)} />
          <button className="btn-primary" disabled={pending} onClick={() => send(false)}>Send</button>
        </div>
      )}
    </div>
  );
}
