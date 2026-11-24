"use client";
import { useState } from "react";
import { AlertTriangle, BookOpen, Sparkles } from "lucide-react";
import { runAiTaskAction } from "@/actions/ai";
import { Field, Modal, useAction, useToast } from "@/components/ui";

export type ComplianceMetrics = {
  totalEmployees: number;
  publishedCourses: number;
  totalEnrollments: number;
  passedCount: number;
  openCount: number;
  failedCount: number;
  overdueCount: number;
  compliancePct: number;
  courseBreakdown: {
    courseTitle: string;
    passed: number;
    open: number;
    failed: number;
    overdue: number;
    total: number;
  }[];
};

type ComplianceSummaryResult = {
  headline: string;
  summary: string;
  priorities: string[];
};

type RegulationExplainResult = {
  plainSummary: string;
  keyRequirements: string[];
  practicalSteps: string[];
  disclaimer: string;
};

const REG_EXAMPLES = [
  "OSHA hazard communication",
  "Food handler training renewal",
  "Harassment prevention training",
  "OSHA forklift recertification",
];

export function ComplianceAi({ ai, metrics }: { ai: boolean; metrics: ComplianceMetrics }) {
  const toast = useToast();
  const { exec, pending } = useAction();

  const [summary, setSummary] = useState<ComplianceSummaryResult | null>(null);
  const [regOpen, setRegOpen] = useState(false);
  const [regTopic, setRegTopic] = useState("");
  const [regIndustry, setRegIndustry] = useState("");
  const [regResult, setRegResult] = useState<RegulationExplainResult | null>(null);
  const [busyTask, setBusyTask] = useState<"summary" | "explain" | null>(null);

  if (!ai) return null;

  const runSummary = () => {
    if (metrics.totalEnrollments === 0) {
      toast("error", "Assign at least one published course before summarizing compliance.");
      return;
    }
    setBusyTask("summary");
    exec(
      () =>
        runAiTaskAction("compliance.summary", {
          scope: "training",
          metrics,
        }) as Promise<{ ok: true; data: ComplianceSummaryResult } | { ok: false; error: string }>,
      {
        onOk: (res) => {
          setSummary(res);
          toast("ok", "Compliance summary ready.");
        },
      }
    );
  };

  const runExplain = (topicOverride?: string) => {
    const topic = (topicOverride ?? regTopic).trim();
    if (topic.length < 3) {
      toast("error", "Enter a regulation, training requirement, or safety rule.");
      return;
    }
    if (topicOverride !== undefined) setRegTopic(topicOverride);
    setBusyTask("explain");
    exec(
      () =>
        runAiTaskAction("regulation.explain", {
          topic,
          industry: regIndustry.trim() || undefined,
        }) as Promise<{ ok: true; data: RegulationExplainResult } | { ok: false; error: string }>,
      {
        onOk: (res) => {
          setRegResult(res);
        },
      }
    );
  };

  return (
    <>
      <div className="card mb-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-ink">Matrix snapshot:</span>
            {metrics.totalEnrollments === 0 ? (
              <span className="text-soft">
                {metrics.totalEmployees} staff · {metrics.publishedCourses} published course{metrics.publishedCourses === 1 ? "" : "s"} · no enrollments yet
              </span>
            ) : (
              <>
                <span className="mono rounded border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {metrics.compliancePct}% passed ({metrics.passedCount}/{metrics.totalEnrollments})
                </span>
                <span className="mono rounded border border-line bg-muted px-2 py-0.5 text-soft">
                  {metrics.openCount} open
                </span>
                {metrics.failedCount > 0 && (
                  <span className="mono rounded border border-rose-300 bg-rose-100 px-2 py-0.5 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
                    {metrics.failedCount} failed
                  </span>
                )}
                {metrics.overdueCount > 0 && (
                  <span className="mono rounded border border-amber-300 bg-amber-100 px-2 py-0.5 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    {metrics.overdueCount} overdue
                  </span>
                )}
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {summary && (
              <button type="button" className="text-xs text-soft underline" onClick={() => setSummary(null)}>
                Hide
              </button>
            )}
            <button
              type="button"
              className="btn !h-7 !text-xs"
              disabled={pending || metrics.totalEnrollments === 0}
              onClick={runSummary}
            >
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              {pending && busyTask === "summary"
                ? "Summarizing…"
                : summary
                  ? "Refresh AI summary"
                  : "Summarize compliance with AI"}
            </button>
            <button
              type="button"
              className="btn !h-7 !text-xs"
              onClick={() => setRegOpen(true)}
            >
              <BookOpen className="h-3.5 w-3.5 text-accent" />
              Explain a regulation
            </button>
          </div>
        </div>

        {summary && (
          <div className="anim-slide-down mt-3 space-y-2.5 rounded-lg border border-accent/30 bg-accent/5 p-3.5 text-[13px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold text-ink">{summary.headline}</div>
              <span className="text-[11px] text-soft">
                Numbers computed directly from your database; AI only writes the summary. No employee names sent.
              </span>
            </div>
            <p className="whitespace-pre-wrap leading-relaxed text-soft">{summary.summary}</p>
            {summary.priorities.length > 0 && (
              <div>
                <div className="text-xs font-medium text-ink">Prioritized next actions</div>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-soft">
                  {summary.priorities.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal open={regOpen} onClose={() => setRegOpen(false)} title="Explain a workplace regulation">
        <div className="space-y-3 text-[13px]">
          <p className="text-xs text-soft">
            Ask for a plain-English overview of any safety training standard, renewal rule, or compliance topic.
          </p>
          <Field label="Rule, standard, or compliance topic">
            <input
              className="input"
              value={regTopic}
              onChange={(e) => setRegTopic(e.target.value)}
              placeholder="e.g. OSHA hazard communication, ServSafe food handler, harassment training"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runExplain();
                }
              }}
            />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {REG_EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                className="rounded-full border border-line bg-muted px-2.5 py-0.5 text-[11px] text-soft hover:text-ink"
                disabled={pending}
                onClick={() => runExplain(ex)}
              >
                {ex}
              </button>
            ))}
          </div>
          <Field label="Industry / team type (optional)">
            <input
              className="input"
              value={regIndustry}
              onChange={(e) => setRegIndustry(e.target.value)}
              placeholder="e.g. Restaurant, Warehouse, Retail, Healthcare"
            />
          </Field>
          <button
            type="button"
            className="btn-primary w-full"
            disabled={pending || regTopic.trim().length < 3}
            onClick={() => runExplain()}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {pending && busyTask === "explain" ? "Explaining…" : "Explain in plain English"}
          </button>

          {regResult && (
            <div className="anim-slide-down space-y-3 border-t border-line pt-3">
              <div className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                <div className="inline-flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Not legal advice
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed">
                  {regResult.disclaimer || "General educational information only — not legal advice. Verify local, state, and federal rules with a qualified advisor."}
                </p>
              </div>
              <div>
                <div className="text-xs font-semibold text-ink">Plain-English summary</div>
                <p className="mt-1 whitespace-pre-wrap leading-relaxed text-soft">{regResult.plainSummary}</p>
              </div>
              {regResult.keyRequirements.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-ink">Key requirements</div>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-soft">
                    {regResult.keyRequirements.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {regResult.practicalSteps.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-ink">Practical steps for your team</div>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-soft">
                    {regResult.practicalSteps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
