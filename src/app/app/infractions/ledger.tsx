"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, FileText, ListOrdered, RefreshCw, Scale, ShieldAlert, Sparkles } from "lucide-react";
import { addCaseAttachmentAction, applyStrikeDecayAction, decideAppealAction, deleteDisciplineRuleAction, saveDisciplineRuleAction } from "@/actions/discipline2";
import { addCaseNoteAction, issueInfractionAction, logAppealAction } from "@/actions/infractions";
import { compareInfractionCaseAction, runAiTaskAction } from "@/actions/ai";
import { Badge, Drawer, Empty, Field, Modal, PageHeader, useAction, useToast } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/utils";

export type CaseRow = {
  id: string; caseNumber: string; employeeId: string; employee: string; severity: string; points: number; policy: string; summary: string; evidence: string[]; confidential: string;
  acknowledged: boolean; signedBy: string | null; acknowledgedAt: string | null; issuedBy: string; createdAt: string;
  attachments: { id: string; kind: string; title: string; statement: string; author: string; at: string }[];
  appeals: { id: string; status: string; reason: string; by: string; reviewer: string | null; decision: string; at: string }[];
  timeline: { id: string; type: string; note: string; actor: string; at: string; confidential: boolean }[];
};

type RuleRow = { id: string; whenSeverity: string; count: number; withinDays: number; escalateTo: string };
type TemplateOpt = { id: string; name: string; severity: string; points: number; policy: string; summary: string };

type AiRewriteDraft = { policyViolated: string; summary: string; coachingTip: string; flags: string[] };
type AiTimelineDraft = { lines: string[] };
type AiCompareDraft = { consistencyNote: string; similarCases: { caseRef: string; severity: string; points: number; similarity: string }[]; considerations: string[] };
type AiPacketDraft = { executiveSummary: string; chronology: string[]; evidenceOverview: string; statusAndNextSteps: string };
type AiRedactDraft = { redactedText: string; removedCategories: string[] };
type AiDrawerTool = "timeline" | "compare" | "packet" | "redact";

function buildShareableCaseText(c: CaseRow): string {
  const publicTimeline = c.timeline.filter((t) => !t.confidential);
  const lines: string[] = [
    `Case: ${c.caseNumber}`,
    `Employee: ${c.employee}`,
    `Severity: ${c.severity.replace(/_/g, " ")} (+${c.points} pts)`,
    `Policy: ${c.policy}`,
    `Issued: ${fmtDateTime(c.createdAt)} by ${c.issuedBy}`,
    `Acknowledgment: ${c.acknowledged ? `Signed by ${c.signedBy ?? "employee"}${c.acknowledgedAt ? ` on ${fmtDateTime(c.acknowledgedAt)}` : ""}` : "Awaiting signature"}`,
    "",
    `Summary:\n${c.summary}`,
  ];
  if (publicTimeline.length > 0) {
    lines.push(
      "",
      "Timeline (non-confidential):",
      ...publicTimeline.map((t) => `- ${fmtDateTime(t.at)} [${t.type.replace(/_/g, " ")}] ${t.actor}: ${t.note}`)
    );
  }
  if (c.attachments.length > 0) {
    lines.push(
      "",
      "Attachments & Statements:",
      ...c.attachments.map((a) => `- [${a.kind}] ${a.title} (${a.author}, ${fmtDateTime(a.at)})${a.statement ? `: ${a.statement}` : ""}`)
    );
  }
  return lines.join("\n").slice(0, 12000);
}

function CaseAiHelpers({ c, canConfidential }: { c: CaseRow; canConfidential: boolean }) {
  const toast = useToast();
  const { exec, pending } = useAction();
  const [active, setActive] = useState<AiDrawerTool | null>(null);
  const [loading, setLoading] = useState<AiDrawerTool | null>(null);
  const [timelineDraft, setTimelineDraft] = useState<AiTimelineDraft | null>(null);
  const [compareDraft, setCompareDraft] = useState<AiCompareDraft | null>(null);
  const [packetDraft, setPacketDraft] = useState<(AiPacketDraft & { includedConfidential: boolean }) | null>(null);
  const [redactDraft, setRedactDraft] = useState<AiRedactDraft | null>(null);
  const [redactedText, setRedactedText] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const hasConfidentialNotes = Boolean(c.confidential.trim()) || c.timeline.some((t) => t.confidential);
  const [includeConfInPacket, setIncludeConfInPacket] = useState(canConfidential);

  useEffect(() => {
    setActive(null);
    setLoading(null);
    setTimelineDraft(null);
    setCompareDraft(null);
    setPacketDraft(null);
    setRedactDraft(null);
    setRedactedText("");
    setCopiedKey(null);
    setIncludeConfInPacket(canConfidential);
  }, [c.id, canConfidential]);

  const copyText = (key: string, text: string, label: string) => {
    if (!navigator.clipboard?.writeText) {
      toast("error", "Clipboard not available — select and copy manually.");
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => {
        setCopiedKey(key);
        toast("ok", `${label} copied.`);
        setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), 2000);
      },
      () => toast("error", "Could not copy — select and copy manually.")
    );
  };

  const runTool = <T,>(
    tool: AiDrawerTool,
    fn: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>,
    onOk: (d: T) => void
  ) => {
    setLoading(tool);
    setActive(tool);
    exec(
      async () => {
        try {
          return await fn();
        } finally {
          setLoading(null);
        }
      },
      { onOk }
    );
  };

  const fetchTimeline = () => {
    const events = (canConfidential ? c.timeline : c.timeline.filter((t) => !t.confidential))
      .slice(0, 50)
      .map((t) => ({ at: fmtDateTime(t.at).slice(0, 60), type: t.type.slice(0, 60), note: t.note.slice(0, 1500) }));
    runTool(
      "timeline",
      () =>
        runAiTaskAction("infraction.timeline", {
          caseNumber: c.caseNumber.slice(0, 40),
          severity: c.severity.slice(0, 40),
          policy: c.policy.slice(0, 160),
          summary: c.summary.slice(0, 3000),
          events,
        }) as Promise<{ ok: true; data: AiTimelineDraft } | { ok: false; error: string }>,
      (res) => setTimelineDraft(res)
    );
  };

  const fetchCompare = () => {
    runTool("compare", () => compareInfractionCaseAction(c.id), (res) => setCompareDraft(res));
  };

  const fetchPacket = () => {
    const useConf = canConfidential && includeConfInPacket;
    const baseEvents = (useConf ? c.timeline : c.timeline.filter((t) => !t.confidential)).map((t) => ({
      at: fmtDateTime(t.at).slice(0, 60),
      type: t.type.slice(0, 60),
      note: t.note.slice(0, 1200),
    }));
    const events = (
      useConf && c.confidential.trim()
        ? [{ at: fmtDateTime(c.createdAt).slice(0, 60), type: "CONFIDENTIAL_MANAGER_NOTE", note: c.confidential.trim().slice(0, 1200) }, ...baseEvents]
        : baseEvents
    ).slice(0, 50);
    const attachments = c.attachments.slice(0, 20).map((a) => ({
      kind: a.kind.slice(0, 40),
      title: a.title.slice(0, 160),
      statement: a.statement.slice(0, 2000),
    }));
    const appeals = c.appeals.slice(0, 10).map((a) => ({
      status: a.status.slice(0, 40),
      reason: a.reason.slice(0, 1500),
      decision: a.decision.slice(0, 1500),
    }));
    const includedConfidential = useConf && hasConfidentialNotes;
    runTool(
      "packet",
      () =>
        runAiTaskAction("infraction.packet", {
          caseNumber: c.caseNumber.slice(0, 40),
          severity: c.severity.slice(0, 40),
          points: c.points,
          policy: c.policy.slice(0, 160),
          summary: c.summary.slice(0, 3000),
          acknowledged: c.acknowledged,
          events,
          attachments,
          appeals,
        }) as Promise<{ ok: true; data: AiPacketDraft } | { ok: false; error: string }>,
      (res) => setPacketDraft({ ...res, includedConfidential })
    );
  };

  const fetchRedact = () => {
    const text = buildShareableCaseText(c);
    runTool(
      "redact",
      () =>
        runAiTaskAction("infraction.redact", { text }) as Promise<{ ok: true; data: AiRedactDraft } | { ok: false; error: string }>,
      (res) => {
        setRedactDraft(res);
        setRedactedText(res.redactedText);
      }
    );
  };

  const formatPacketForCopy = (p: AiPacketDraft & { includedConfidential: boolean }) => {
    const parts = [
      `Case-Packet Summary · ${c.caseNumber}`,
      p.includedConfidential
        ? "[Note: Confidential manager notes were included — restricted HR/admin use only.]"
        : "[Note: Confidential manager notes were excluded from this summary.]",
      "",
      `Executive Summary:\n${p.executiveSummary}`,
    ];
    if (p.chronology.length > 0) {
      parts.push("", "Chronology:", ...p.chronology.map((line, i) => `${i + 1}. ${line}`));
    }
    if (p.evidenceOverview) {
      parts.push("", `Evidence Overview:\n${p.evidenceOverview}`);
    }
    if (p.statusAndNextSteps) {
      parts.push("", `Status & Next Steps:\n${p.statusAndNextSteps}`);
    }
    return parts.join("\n");
  };

  const toolBtnCls = (tool: AiDrawerTool) =>
    `btn !h-7 !px-2.5 !text-xs ${active === tool ? "!border-accent !bg-accent/10 !text-accent" : ""}`;

  return (
    <div className="rounded-lg border border-line bg-muted/40 p-3 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          <span>AI Case Helpers</span>
          <span className="font-normal text-soft">(suggestions only — never decides outcomes)</span>
        </div>
        {active && (
          <button type="button" className="text-[11px] text-soft underline hover:text-ink" onClick={() => setActive(null)}>
            Hide preview
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className={toolBtnCls("timeline")}
          disabled={pending}
          onClick={() => (timelineDraft ? setActive("timeline") : fetchTimeline())}
        >
          <ListOrdered className="h-3.5 w-3.5" />
          {loading === "timeline" ? "Summarizing…" : "5-line timeline"}
        </button>
        <button
          type="button"
          className={toolBtnCls("compare")}
          disabled={pending}
          onClick={() => (compareDraft ? setActive("compare") : fetchCompare())}
        >
          <Scale className="h-3.5 w-3.5" />
          {loading === "compare" ? "Comparing…" : "Compare past cases"}
        </button>
        <button
          type="button"
          className={toolBtnCls("packet")}
          disabled={pending}
          onClick={() => (packetDraft ? setActive("packet") : fetchPacket())}
        >
          <FileText className="h-3.5 w-3.5" />
          {loading === "packet" ? "Drafting…" : "Case-packet summary"}
        </button>
        <button
          type="button"
          className={toolBtnCls("redact")}
          disabled={pending}
          onClick={() => (redactDraft ? setActive("redact") : fetchRedact())}
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          {loading === "redact" ? "Redacting…" : "Redact for sharing"}
        </button>
      </div>

      {canConfidential && hasConfidentialNotes && (
        <label className="flex items-center gap-1.5 text-[11px] text-soft">
          <input
            type="checkbox"
            checked={includeConfInPacket}
            onChange={(e) => setIncludeConfInPacket(e.target.checked)}
          />
          Include confidential notes when generating Case-packet summary (never included in Redact for sharing)
        </label>
      )}

      {active && (
        <div className="rounded-md border border-accent/30 bg-surface p-3 text-xs space-y-2.5">
          {loading === active ? (
            <p className="text-soft">Generating draft with names &amp; contact details scrubbed…</p>
          ) : active === "timeline" && timelineDraft ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">5-line factual timeline</span>
                <div className="flex items-center gap-2">
                  <button type="button" className="inline-flex items-center gap-1 text-[11px] text-soft hover:text-ink" disabled={pending} onClick={fetchTimeline}>
                    <RefreshCw className="h-3 w-3" />Refresh
                  </button>
                  <button
                    type="button"
                    className="btn !h-7 !px-2 !text-xs"
                    onClick={() => copyText("timeline", timelineDraft.lines.map((l, i) => `${i + 1}. ${l}`).join("\n"), "Timeline summary")}
                  >
                    {copiedKey === "timeline" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    {copiedKey === "timeline" ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
              <ol className="list-decimal space-y-1 pl-4 text-[13px] leading-snug">
                {timelineDraft.lines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ol>
            </>
          ) : active === "compare" && compareDraft ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">Anonymized past-case comparison</span>
                <button type="button" className="inline-flex items-center gap-1 text-[11px] text-soft hover:text-ink" disabled={pending} onClick={fetchCompare}>
                  <RefreshCw className="h-3 w-3" />Refresh
                </button>
              </div>
              <p className="text-[13px] leading-relaxed">{compareDraft.consistencyNote}</p>
              {compareDraft.similarCases.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-soft">Similar past cases</div>
                  <div className="grid gap-1.5">
                    {compareDraft.similarCases.map((sc, i) => (
                      <div key={`${sc.caseRef}-${i}`} className="rounded border border-line bg-muted/40 p-2 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="mono font-medium">{sc.caseRef}</span>
                          <Badge value={sc.severity} />
                          <span className="mono text-[11px] text-soft">+{sc.points} pts</span>
                        </div>
                        <p className="text-soft">{sc.similarity}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {compareDraft.considerations.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-soft">Consistency considerations</div>
                  <ul className="list-disc space-y-0.5 pl-4 text-soft">
                    {compareDraft.considerations.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="rounded border border-line bg-muted px-2.5 py-1.5 text-[11px] text-soft">
                Anonymized workspace history for consistency review only. Managers decide all outcomes.
              </p>
            </>
          ) : active === "packet" && packetDraft ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">Case-packet summary</span>
                <div className="flex items-center gap-2">
                  <button type="button" className="inline-flex items-center gap-1 text-[11px] text-soft hover:text-ink" disabled={pending} onClick={fetchPacket}>
                    <RefreshCw className="h-3 w-3" />Refresh
                  </button>
                  <button
                    type="button"
                    className="btn !h-7 !px-2 !text-xs"
                    onClick={() => copyText("packet", formatPacketForCopy(packetDraft), "Case-packet summary")}
                  >
                    {copiedKey === "packet" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    {copiedKey === "packet" ? "Copied" : "Copy packet summary"}
                  </button>
                </div>
              </div>
              <div
                className={
                  packetDraft.includedConfidential
                    ? "rounded border border-amber-400/50 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-950 dark:text-amber-200"
                    : "rounded border border-line bg-muted px-2.5 py-1.5 text-[11px] text-soft"
                }
              >
                {packetDraft.includedConfidential
                  ? "Confidential manager notes were included in this draft (restricted HR/admin access — do not share with supervisors or employees)."
                  : "Confidential manager notes were excluded from this summary."}
              </div>
              <div className="space-y-2 text-[13px]">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-soft">Executive summary</div>
                  <p className="mt-0.5 whitespace-pre-wrap leading-relaxed">{packetDraft.executiveSummary}</p>
                </div>
                {packetDraft.chronology.length > 0 && (
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wider text-soft">Chronology</div>
                    <ol className="mt-0.5 list-decimal space-y-0.5 pl-4">
                      {packetDraft.chronology.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}
                {packetDraft.evidenceOverview && (
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wider text-soft">Evidence overview</div>
                    <p className="mt-0.5 whitespace-pre-wrap leading-relaxed">{packetDraft.evidenceOverview}</p>
                  </div>
                )}
                {packetDraft.statusAndNextSteps && (
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wider text-soft">Status &amp; next steps</div>
                    <p className="mt-0.5 whitespace-pre-wrap leading-relaxed">{packetDraft.statusAndNextSteps}</p>
                  </div>
                )}
              </div>
            </>
          ) : active === "redact" && redactDraft ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">Redacted case export (review &amp; edit before sharing)</span>
                <div className="flex items-center gap-2">
                  <button type="button" className="inline-flex items-center gap-1 text-[11px] text-soft hover:text-ink" disabled={pending} onClick={fetchRedact}>
                    <RefreshCw className="h-3 w-3" />Refresh
                  </button>
                  <button
                    type="button"
                    className="btn !h-7 !px-2 !text-xs"
                    disabled={!redactedText.trim()}
                    onClick={() => copyText("redact", redactedText, "Redacted case text")}
                  >
                    {copiedKey === "redact" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    {copiedKey === "redact" ? "Copied" : "Copy redacted text"}
                  </button>
                </div>
              </div>
              {redactDraft.removedCategories.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-soft">Redacted:</span>
                  {redactDraft.removedCategories.map((cat, i) => (
                    <Badge key={`${cat}-${i}`} value="INFO" label={cat} />
                  ))}
                </div>
              )}
              <textarea
                className="textarea mono !text-xs"
                rows={8}
                value={redactedText}
                onChange={(e) => setRedactedText(e.target.value)}
                aria-label="Redacted case text"
              />
              <div className="rounded border border-amber-400/50 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-950 dark:text-amber-200">
                <b>Double-check before sharing externally:</b> Confidential manager notes were excluded, and identifying details were scrubbed, but AI can miss unusual names, locations, or context clues. Review and edit the text above before copying.
              </div>
            </>
          ) : (
            <p className="text-soft">No draft available yet. Click a helper button above to generate one.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function Ledger({ rows, employees, templates = [], rules = [], isAdmin = false, severities, canConfidential, aiCare = false, defaultOpen }: { rules?: RuleRow[]; isAdmin?: boolean; rows: CaseRow[]; employees: { id: string; label: string }[]; templates?: TemplateOpt[]; severities: string[]; canConfidential: boolean; aiCare?: boolean; defaultOpen: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();
  const [q, setQ] = useState("");
  const [sev, setSev] = useState("");
  const [ack, setAck] = useState("");
  const [logOpen, setLogOpen] = useState(defaultOpen);
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [noteConf, setNoteConf] = useState(false);
  const [appeal, setAppeal] = useState("");
  const [att, setAtt] = useState({ kind: "WITNESS", title: "", statement: "" });
  const [dec, setDec] = useState<Record<string, string>>({});
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rule, setRule] = useState({ whenSeverity: "VERBAL_WARNING", count: 3, withinDays: 90, escalateTo: "WRITTEN_INFRACTION" });
  const SEVS = ["VERBAL_WARNING", "WRITTEN_INFRACTION", "STRIKE_POINTS", "SUSPENSION", "TERMINATION"];
  const [f, setF] = useState({ employeeId: "", severity: severities[0] ?? "VERBAL_WARNING", pointsAdded: 0, policyViolated: "", summary: "", evidence: "", confidentialManagerNotes: "" });
  const [aiDraft, setAiDraft] = useState<AiRewriteDraft | null>(null);

  const rewriteNeutrally = () => {
    const selectedEmp = employees.find((e) => e.id === f.employeeId)?.label.replace(/^EMP-\d+\s*/i, "");
    exec(
      () =>
        runAiTaskAction("infraction.rewrite", {
          notes: f.summary,
          policy: f.policyViolated || undefined,
          severity: f.severity,
          employeeName: selectedEmp || undefined,
        }) as Promise<{ ok: true; data: AiRewriteDraft } | { ok: false; error: string }>,
      {
        onOk: (res) => {
          setAiDraft(res);
          toast("ok", "Neutral rewrite ready — review before applying.");
        },
      }
    );
  };

  const shown = useMemo(() => rows.filter((r) => (!q || (r.caseNumber + r.employee + r.policy).toLowerCase().includes(q.toLowerCase())) && (!sev || r.severity === sev) && (!ack || (ack === "yes") === r.acknowledged)), [rows, q, sev, ack]);
  const open = rows.find((r) => r.id === openId) ?? null;

  const submit = () => {
    const evidenceUrls = f.evidence.split(/\s+/).filter(Boolean);
    exec(() => issueInfractionAction({ ...f, evidenceUrls, pointsAdded: Number(f.pointsAdded) }), {
      onOk: (d) => { toast("ok", `${d.caseNumber} logged${d.effects.length ? `. Automatic: ${d.effects.join("; ")}` : ""}`); setLogOpen(false); setF({ ...f, policyViolated: "", summary: "", evidence: "", confidentialManagerNotes: "", pointsAdded: 0 }); router.refresh(); },
    });
  };

  return (
    <>
      <PageHeader title="Infractions" sub="Case ledger. Cases and timeline entries are append-only."><a className="btn" href="/app/infractions/trends">Trends</a>{isAdmin && <button className="btn" onClick={() => setRulesOpen(true)}>Discipline rules</button>}<button className="btn-primary" onClick={() => setLogOpen(true)}>Log Infraction</button></PageHeader>
      <div className="mb-3 flex flex-wrap gap-2">
        <input className="input !w-64" placeholder="Search case, employee, policy" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input !w-48" value={sev} onChange={(e) => setSev(e.target.value)}><option value="">All severities</option>{["VERBAL_WARNING", "WRITTEN_INFRACTION", "STRIKE_POINTS", "SUSPENSION", "TERMINATION"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select>
        <select className="input !w-44" value={ack} onChange={(e) => setAck(e.target.value)}><option value="">Any signature state</option><option value="yes">Acknowledged</option><option value="no">Unacknowledged</option></select>
      </div>
      {shown.length === 0 ? <Empty title="No cases match" hint="Log an infraction or adjust the filters." /> : (
        <div className="card max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[800px] border-collapse">
            <thead><tr>{["Case", "Employee", "Severity", "Pts", "Policy", "Signature", "Date"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>{shown.map((r) => (
              <tr key={r.id} className="cursor-pointer hover:bg-muted" onClick={() => setOpenId(r.id)}>
                <td className="td mono text-accent">{r.caseNumber}</td><td className="td">{r.employee}</td><td className="td"><Badge value={r.severity} /></td><td className="td mono">+{r.points}</td><td className="td">{r.policy}</td>
                <td className="td">{r.acknowledged ? <Badge value="ACTIVE" label="Signed" /> : <Badge value="PENDING" label="Awaiting" />}</td><td className="td mono">{fmtDate(r.createdAt)}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}

      <Modal open={logOpen} onClose={() => setLogOpen(false)} title="Log infraction">
        <div className="space-y-3">
          {templates.length > 0 && (
            <Field label="Pre-fill from corrective-action template (optional)">
              <select
                className="input"
                defaultValue=""
                onChange={(e) => {
                  const t = templates.find((x) => x.id === e.target.value);
                  if (t) {
                    setF({ ...f, severity: severities.includes(t.severity) ? t.severity : f.severity, pointsAdded: t.points, policyViolated: t.policy, summary: t.summary });
                  }
                }}
              >
                <option value="">Choose a template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.severity.replace(/_/g, " ")}, +{t.points} pts)</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Employee"><select className="input" value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })}><option value="">Select…</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Severity"><select className="input" value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}>{severities.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select></Field>
            <Field label="Strike points"><input className="input mono" type="number" min={0} max={20} value={f.pointsAdded} onChange={(e) => setF({ ...f, pointsAdded: Number(e.target.value) })} /></Field>
          </div>
          <Field label="Policy violated"><input className="input" value={f.policyViolated} onChange={(e) => setF({ ...f, policyViolated: e.target.value })} placeholder="e.g. Attendance, Policy 2.1" /></Field>
          <Field label="What happened (visible to the employee)"><textarea className="textarea" rows={4} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} placeholder="Type rough factual notes or what happened…" /></Field>
          {aiCare && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  className="btn !h-7 !text-xs"
                  disabled={pending || f.summary.trim().length < 15}
                  onClick={rewriteNeutrally}
                >
                  <Sparkles className="h-3.5 w-3.5 text-accent" />{pending ? "Rewriting…" : "Rewrite neutrally with AI"}
                </button>
                <span className="text-[11px] text-soft">Names &amp; contact details are scrubbed first. Human review required.</span>
              </div>
              {aiDraft && (
                <div className="rounded-lg border border-accent/40 bg-accent/5 p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between gap-2 font-semibold">
                    <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-accent" />Neutral HR draft (review before applying)</span>
                    <button type="button" className="font-normal text-soft underline" onClick={() => setAiDraft(null)}>Discard</button>
                  </div>
                  <p className="whitespace-pre-wrap rounded border border-line bg-surface p-2.5 text-[13px] text-ink">{aiDraft.summary}</p>
                  {aiDraft.policyViolated && !f.policyViolated.trim() && (
                    <div className="text-soft">Suggested policy: <span className="font-medium text-ink">{aiDraft.policyViolated}</span></div>
                  )}
                  {aiDraft.flags.length > 0 && (
                    <ul className="list-disc space-y-0.5 pl-4 text-soft">
                      {aiDraft.flags.map((fl, i) => <li key={i}>{fl}</li>)}
                    </ul>
                  )}
                  {aiDraft.coachingTip && (
                    <div className="rounded border border-amber-400/40 bg-amber-500/10 px-2.5 py-1.5 text-amber-950 dark:text-amber-200">
                      <b>1:1 conversation tip (not saved to case):</b> {aiDraft.coachingTip}
                    </div>
                  )}
                  <button
                    type="button"
                    className="btn-primary !h-8 w-full text-xs"
                    onClick={() => {
                      setF({
                        ...f,
                        summary: aiDraft.summary,
                        policyViolated: f.policyViolated.trim() ? f.policyViolated : aiDraft.policyViolated,
                      });
                      setAiDraft(null);
                      toast("ok", "Applied draft to write-up.");
                    }}
                  >
                    Use this wording
                  </button>
                </div>
              )}
            </div>
          )}
          <Field label="Evidence links (one per line)"><textarea className="textarea mono" rows={2} value={f.evidence} onChange={(e) => setF({ ...f, evidence: e.target.value })} /></Field>
          {canConfidential && <Field label="Confidential manager notes (never shown to the employee)"><textarea className="textarea" rows={3} value={f.confidentialManagerNotes} onChange={(e) => setF({ ...f, confidentialManagerNotes: e.target.value })} /></Field>}
          <button className="btn-primary w-full" disabled={pending} onClick={submit}>{pending ? "Logging…" : "Log infraction"}</button>
        </div>
      </Modal>

      <Modal open={rulesOpen} onClose={() => setRulesOpen(false)} title="Progressive discipline rules">
        <div className="space-y-3 text-[13px]">
          {rules.length === 0 ? <p className="text-soft">No rules yet.</p> : <ul className="divide-y divide-line">{rules.map((r) => <li key={r.id} className="flex items-center justify-between gap-2 py-2"><span>{r.count} x {r.whenSeverity.replace(/_/g, " ")} within {r.withinDays} days, then <b>{r.escalateTo.replace(/_/g, " ")}</b></span><button className="btn-danger" disabled={pending} onClick={() => exec(() => deleteDisciplineRuleAction(r.id), { success: "Rule removed", onOk: () => router.refresh() })}>Delete</button></li>)}</ul>}
          <div className="grid grid-cols-2 gap-2 border-t border-line pt-3">
            <Field label="When severity"><select className="input" value={rule.whenSeverity} onChange={(e) => setRule({ ...rule, whenSeverity: e.target.value })}>{SEVS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select></Field>
            <Field label="Escalate to"><select className="input" value={rule.escalateTo} onChange={(e) => setRule({ ...rule, escalateTo: e.target.value })}>{SEVS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select></Field>
            <Field label="Count"><input className="input mono" type="number" min={2} max={10} value={rule.count} onChange={(e) => setRule({ ...rule, count: Number(e.target.value) })} /></Field>
            <Field label="Within days"><input className="input mono" type="number" min={7} max={730} value={rule.withinDays} onChange={(e) => setRule({ ...rule, withinDays: Number(e.target.value) })} /></Field>
          </div>
          <button className="btn-primary w-full" disabled={pending} onClick={() => exec(() => saveDisciplineRuleAction({ ...rule, enabled: true }), { success: "Rule added", onOk: () => router.refresh() })}>Add rule</button>
          <button className="btn w-full" disabled={pending} onClick={() => exec(() => applyStrikeDecayAction(), { onOk: (d) => { toast("ok", `Decay applied: ${d.updated} employee(s) updated (${d.decayDays}-day window)`); router.refresh(); } })}>Apply strike decay now</button>
        </div>
      </Modal>

      <Drawer open={!!open} onClose={() => setOpenId(null)} title={open ? `${open.caseNumber} · case dossier` : ""} wide>
        {open && (
          <div className="space-y-4 text-[13px]">
            <div className="flex flex-wrap items-center gap-2"><Badge value={open.severity} /><span className="mono">+{open.points} pts</span><span className="ml-auto">{open.acknowledged ? <Badge value="ACTIVE" label="Acknowledged" /> : <Badge value="PENDING" label="Awaiting signature" />}</span></div>
            <div><div className="text-xs text-soft">Employee</div><a className="text-accent" href={`/app/employee/${open.employeeId}`}>{open.employee}</a></div>
            <div><div className="text-xs text-soft">Policy</div>{open.policy}</div>
            <div><div className="text-xs text-soft">Summary</div>{open.summary}</div>
            {open.evidence.length > 0 && <div><div className="text-xs text-soft">Evidence</div>{open.evidence.map((u) => <a key={u} className="mono block break-all text-accent" href={u} target="_blank" rel="noreferrer">{u}</a>)}</div>}
            {open.confidential && <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"><div className="mono text-[11px] uppercase">Confidential manager notes</div>{open.confidential}</div>}
            <div className="mono text-xs text-soft">Issued by {open.issuedBy} · {fmtDateTime(open.createdAt)}{open.acknowledged ? ` · signed "${open.signedBy}" ${fmtDateTime(open.acknowledgedAt)}` : ""}</div>
            {aiCare && <CaseAiHelpers key={open.id} c={open} canConfidential={canConfidential} />}
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-soft">Timeline (append-only)</h3>
              <ol className="space-y-2 border-l border-line pl-3">{open.timeline.map((t) => <li key={t.id}><div className="mono text-[11px] text-soft">{fmtDateTime(t.at)} · {t.type.replace(/_/g, " ")}{t.confidential ? " · confidential" : ""}</div><div>{t.actor}: {t.note}</div></li>)}</ol>
            </div>
            <div className="space-y-2 border-t border-line pt-4">
              <Field label="Add timeline note"><textarea className="textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
              {canConfidential && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={noteConf} onChange={(e) => setNoteConf(e.target.checked)} />Confidential (hidden from supervisors and the employee)</label>}
              <button className="btn" disabled={pending} onClick={() => exec(() => addCaseNoteAction(open.id, { note, isConfidential: noteConf }), { success: "Note added", onOk: () => { setNote(""); router.refresh(); } })}>Add note</button>
            </div>
            <div className="space-y-2 border-t border-line pt-4">
              <h3 className="text-xs font-medium uppercase tracking-wider text-soft">Witness statements and evidence</h3>
              {open.attachments.length === 0 && <p className="text-soft">None attached.</p>}
              {open.attachments.map((a) => <div key={a.id} className="rounded-md border border-line p-2"><div className="mono text-[11px] text-soft">{a.kind} · {a.author} · {fmtDateTime(a.at)}</div><div className="font-medium">{a.title}</div>{a.statement && <div className="whitespace-pre-wrap">{a.statement}</div>}</div>)}
              <div className="grid grid-cols-3 gap-2"><select className="input" value={att.kind} onChange={(e) => setAtt({ ...att, kind: e.target.value })}><option value="WITNESS">Witness</option><option value="EVIDENCE">Evidence</option></select><input className="input col-span-2" placeholder="Title / witness name" value={att.title} onChange={(e) => setAtt({ ...att, title: e.target.value })} /></div>
              <textarea className="textarea" rows={3} placeholder="Statement or description" value={att.statement} onChange={(e) => setAtt({ ...att, statement: e.target.value })} />
              <button className="btn" disabled={pending} onClick={() => exec(() => addCaseAttachmentAction(open.id, att), { success: "Added", onOk: () => { setAtt({ ...att, title: "", statement: "" }); router.refresh(); } })}>Add to case</button>
            </div>
            {open.appeals.length > 0 && <div className="space-y-2 border-t border-line pt-4">
              <h3 className="text-xs font-medium uppercase tracking-wider text-soft">Appeals</h3>
              {open.appeals.map((a) => <div key={a.id} className="rounded-md border border-line p-2"><div className="flex items-center gap-2"><Badge value={a.status === "OPEN" ? "PENDING" : a.status === "UPHELD" ? "FAILED" : "PASSED"} label={a.status} /><span className="mono text-[11px] text-soft">{a.by} · {fmtDateTime(a.at)}</span></div><div className="mt-1">{a.reason}</div>
                {a.status !== "OPEN" && <div className="mt-1 text-soft">{a.reviewer}: {a.decision}</div>}
                {a.status === "OPEN" && <div className="mt-2 space-y-2"><textarea className="textarea" rows={2} placeholder="Decision note" value={dec[a.id] ?? ""} onChange={(e) => setDec({ ...dec, [a.id]: e.target.value })} /><div className="flex gap-2">{(["UPHELD", "OVERTURNED"] as const).map((d) => <button key={d} className="btn" disabled={pending} onClick={() => exec(() => decideAppealAction(a.id, { decision: d, note: dec[a.id] ?? "" }), { success: `Appeal ${d.toLowerCase()}`, onOk: () => router.refresh() })}>{d === "UPHELD" ? "Uphold" : "Overturn"}</button>)}</div></div>}
              </div>)}
            </div>}
            <div className="space-y-2">
              <Field label="Log an appeal"><textarea className="textarea" rows={2} value={appeal} onChange={(e) => setAppeal(e.target.value)} /></Field>
              <button className="btn" disabled={pending} onClick={() => exec(() => logAppealAction(open.id, { note: appeal }), { success: "Appeal logged", onOk: () => { setAppeal(""); router.refresh(); } })}>Log appeal</button>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}
