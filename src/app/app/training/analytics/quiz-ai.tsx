"use client";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { quizInsightAction, type QuizInsightResult } from "@/actions/ai-insights";
import { useAction } from "@/components/ui";

/** Explains, in plain words, where people struggle on this quiz. Built from the statistics below; it never comments on any person. */
export function QuizAi({ courseId }: { courseId: string }) {
  const { exec, pending } = useAction();
  const [res, setRes] = useState<QuizInsightResult["ai"] | null>(null);
  return (
    <div className="card p-4 text-[13px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-accent" />What this tells us</h2>
          <p className="mt-0.5 text-xs text-soft">AI reads the statistics on this page (no names) and suggests what to coach and which lessons to improve.</p>
        </div>
        <button type="button" className="btn" disabled={pending} onClick={() => exec(() => quizInsightAction(courseId), { onOk: (r) => setRes(r.ai) })}>{pending ? "Reading…" : res ? "Refresh" : "Explain these results"}</button>
      </div>
      {res && (
        <div className="mt-3 space-y-3 rounded-lg border border-accent/30 bg-accent/5 p-4">
          <p className="font-semibold">{res.headline}</p>
          {res.weakSpots.length > 0 && <div><div className="text-xs font-semibold">Where people get stuck</div><ul className="mt-1 space-y-1.5">{res.weakSpots.map((w, i) => <li key={i}><span className="font-medium">{w.prompt}</span><br /><span className="text-soft">{w.why}</span></li>)}</ul></div>}
          {res.coachingTopics.length > 0 && <div><div className="text-xs font-semibold">Good topics for your next huddle</div><ul className="mt-1 list-disc space-y-0.5 pl-5 text-soft">{res.coachingTopics.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
          {res.lessonFixes.length > 0 && <div><div className="text-xs font-semibold">Ways to improve the lessons</div><ul className="mt-1 list-disc space-y-0.5 pl-5 text-soft">{res.lessonFixes.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
          <p className="text-[11.5px] text-soft">AI can be wrong. Treat this as a starting point.</p>
        </div>
      )}
    </div>
  );
}
