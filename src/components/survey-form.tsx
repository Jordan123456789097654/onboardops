"use client";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { submitSurveyAction } from "@/actions/survey";
import { Field, useAction } from "@/components/ui";
import { cn } from "@/lib/utils";

type Kind = "FEEDBACK" | "NPS" | "STORY" | "LEAVING";
const COPY: Record<Kind, { label: string; placeholder: string; thanks: string; button: string }> = {
  FEEDBACK: { label: "What is on your mind?", placeholder: "What is working, what is not, or what you wish it did.", thanks: "Thank you. Your feedback goes straight to the person who builds OnboardOps.", button: "Send feedback" },
  NPS: { label: "Anything you want to add? (optional)", placeholder: "What is the main reason for your score?", thanks: "Thank you. We read every answer.", button: "Send my answer" },
  STORY: { label: "Tell us your story", placeholder: "What did you do before OnboardOps, what changed, and who is it for?", thanks: "Thank you. We will email you before we share anything, and you can say no at any point.", button: "Send my story" },
  LEAVING: { label: "What was the main reason?", placeholder: "One sentence is plenty.", thanks: "Thank you for telling us. It helps more than you would think.", button: "Send" },
};

/** One form for feedback, the recommendation survey, customer stories and the reason someone left. */
export function SurveyForm({ kind, initialScore }: { kind: Kind; initialScore?: number }) {
  const { exec, pending } = useAction();
  const c = COPY[kind];
  const [score, setScore] = useState<number | undefined>(initialScore);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [canQuote, setCanQuote] = useState(false);
  const [hp, setHp] = useState("");
  const [done, setDone] = useState(false);

  if (done) {
    return <div role="status" className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /><p className="text-[15px] text-soft">{c.thanks}</p></div>;
  }
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); exec(() => submitSurveyAction({ kind, score, message, name, email, canQuote, website: hp }), { onOk: () => setDone(true) }); }}>
      {kind === "NPS" && (
        <fieldset>
          <legend className="text-[13.5px] font-medium">How likely are you to recommend OnboardOps to a colleague?</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Array.from({ length: 11 }, (_, i) => (
              <button key={i} type="button" aria-pressed={score === i} onClick={() => setScore(i)} className={cn("h-10 w-10 rounded-lg border text-sm font-medium tabular-nums", score === i ? "border-accent bg-accent text-accent-fg" : "border-line bg-surface hover:bg-muted")}>{i}</button>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[11.5px] text-soft"><span>Not likely</span><span>Very likely</span></div>
        </fieldset>
      )}
      <Field label={c.label}><textarea className="textarea" rows={kind === "STORY" ? 8 : 5} maxLength={3000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={c.placeholder} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={kind === "STORY" ? "Your name" : "Your name (optional)"}><input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name" /></Field>
        <Field label={kind === "STORY" ? "Your email" : "Your email (optional, if you want a reply)"}><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} required={kind === "STORY"} autoComplete="email" /></Field>
      </div>
      {kind === "STORY" && <label className="flex items-start gap-2 text-[13px]"><input type="checkbox" className="mt-0.5" checked={canQuote} onChange={(e) => setCanQuote(e.target.checked)} /><span>We may quote this on our website or in marketing once you have approved the exact wording.</span></label>}
      <input className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" name="website" value={hp} onChange={(e) => setHp(e.target.value)} />
      <button className="btn-primary" disabled={pending}>{pending ? "Sending…" : c.button}</button>
      <p className="text-[12px] text-soft">We use this only to improve OnboardOps and to reply to you. See the <a className="text-accent underline" href="/legal/privacy">Privacy Policy</a>.</p>
    </form>
  );
}
