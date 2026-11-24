"use client";
import { useState } from "react";
import { Copy, Loader2, Sparkles } from "lucide-react";
import { supportInsightsAction, type SupportInsights } from "@/actions/support-admin";
import { useToast } from "@/components/ui";

export function Insights({ ai }: { ai: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<SupportInsights | null>(null);

  async function run() {
    setBusy(true);
    try {
      const r = await supportInsightsAction();
      if (r.ok) setData(r.data);
      else toast("error", r.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-accent" />Help center gaps and article ideas</h2>
          <p className="mt-0.5 max-w-xl text-[12.5px] text-soft">AI reads the last 60 days of tickets (emails and phone numbers removed first), finds questions your help articles don&apos;t answer, and drafts articles for anything asked 5 or more times. Drafts are for you to review. Nothing is published.</p>
        </div>
        <button type="button" className="btn" disabled={!ai || busy} onClick={() => void run()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" /> : <Sparkles className="h-3.5 w-3.5 text-accent" />}
          {busy ? "Reading tickets…" : ai ? "Analyze tickets" : "AI not set up"}
        </button>
      </div>

      {data && (
        <div className="mt-4 space-y-5">
          <div>
            <h3 className="mb-2 text-[13px] font-semibold">Questions your docs don&apos;t cover well <span className="font-normal text-soft">({data.ticketsRead} tickets read)</span></h3>
            {data.gaps.length === 0 ? <p className="text-[13px] text-soft">No clear gaps found.</p> : (
              <ul className="space-y-2">
                {data.gaps.map((g) => (
                  <li key={g.topic} className="rounded-lg border border-line bg-muted/50 p-3 text-[13px]">
                    <div className="flex items-center justify-between gap-2"><strong>{g.topic}</strong><span className="badge border-line bg-surface text-soft">asked ~{g.count}×</span></div>
                    {g.example && <p className="mt-1 text-soft">&ldquo;{g.example}&rdquo;</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {data.articles.length > 0 && (
            <div>
              <h3 className="mb-2 text-[13px] font-semibold">Drafted help articles</h3>
              <div className="space-y-3">
                {data.articles.map((a) => (
                  <article key={a.title} className="rounded-lg border border-line p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div><h4 className="text-[14px] font-semibold">{a.title}</h4><p className="text-[12.5px] text-soft">{a.summary} · asked ~{a.questionCount}×</p></div>
                      <button type="button" className="btn !h-8" onClick={() => { void navigator.clipboard.writeText(`${a.title}\n\n${a.summary}\n\n${a.body}`); toast("ok", "Copied"); }}><Copy className="h-3.5 w-3.5" />Copy</button>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed">{a.body}</p>
                  </article>
                ))}
              </div>
              <p className="mt-2 text-[11.5px] text-soft">AI can be wrong about how the product works. Check each step before adding it to the help center.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
