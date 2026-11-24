"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, ListChecks, Plus, Sparkles, Trash2 } from "lucide-react";
import { convertIncidentAction, updateIncidentAction } from "@/actions/incidents";
import { saveTemplateAction } from "@/actions/checklists";
import { runAiTaskAction } from "@/actions/ai";
import { Badge, Drawer, Empty, Field, PageHeader, useAction, useToast } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

type Row = { id: string; type: string; status: string; at: string; filedAt: string; location: string; description: string; by: string; notes: string; caseNumber: string | null; anonymous: boolean; photos: string[]; investigatorId: string; investigator: string; due: string; injury: { bodyPart?: string; treatment?: string; daysAway?: number } };
const tone: Record<string, string> = { NEW: "PENDING", REVIEWING: "IN_PROGRESS", CLOSED: "PASSED", CONVERTED: "WRITTEN_INFRACTION" };

type AiIncidentDraft = { target: "reviewer_notes" | "case_summary"; rewritten: string; followUpChecklist: string[]; flags: string[] };
type ShiftType = "OPENING" | "MID_SHIFT" | "CLOSING";
type PreventativeItem = { id: string; label: string; required: boolean; selected: boolean };
type ChecklistDraft = { title: string; shiftType: ShiftType; rationale: string; items: PreventativeItem[] };
type AiChecklistResponse = { title: string; shiftType: ShiftType; items: { label: string; required: boolean }[]; rationale: string };

const SHIFT_TYPES: { value: ShiftType; label: string }[] = [
  { value: "OPENING", label: "Opening" },
  { value: "MID_SHIFT", label: "Mid-shift" },
  { value: "CLOSING", label: "Closing" },
];

const mkItemId = (idx: number) => `prev-${Date.now().toString(36)}-${idx}-${Math.random().toString(36).slice(2, 6)}`;

export function Incidents({ rows, employees, members = [], severities, canManage, aiCare = false }: { members?: { id: string; name: string }[]; rows: Row[]; employees: { id: string; label: string }[]; severities: string[]; canManage: boolean; aiCare?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();
  const [status, setStatus] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [conv, setConv] = useState(false);
  const [inv, setInv] = useState({ investigatorMemberId: "", investigationDue: "", bodyPart: "", treatment: "", daysAway: 0 });
  const [f, setF] = useState({ employeeId: "", severity: severities[0] ?? "VERBAL_WARNING", pointsAdded: 0, policyViolated: "", summary: "", confidentialManagerNotes: "" });
  const [aiDraft, setAiDraft] = useState<AiIncidentDraft | null>(null);
  const [checklistDraft, setChecklistDraft] = useState<ChecklistDraft | null>(null);
  const [savedChecklistTitle, setSavedChecklistTitle] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState<"rewrite" | "checklist" | "save_checklist" | null>(null);
  const shown = useMemo(() => rows.filter((r) => !status || r.status === status), [rows, status]);
  const open = rows.find((r) => r.id === openId) ?? null;
  const select = (r: Row) => {
    setOpenId(r.id);
    setNotes(r.notes);
    setAiDraft(null);
    setChecklistDraft(null);
    setSavedChecklistTitle(null);
    setInv({ investigatorMemberId: r.investigatorId, investigationDue: r.due, bodyPart: r.injury.bodyPart ?? "", treatment: r.injury.treatment ?? "", daysAway: r.injury.daysAway ?? 0 });
    setConv(false);
    setF((x) => ({ ...x, summary: r.description, policyViolated: "" }));
  };

  const runIncidentAi = (target: "reviewer_notes" | "case_summary") => {
    if (!open) return;
    const empName = employees.find((e) => e.id === f.employeeId)?.label.replace(/^EMP-\d+\s*/i, "");
    const names = [open.by, open.investigator, empName].filter((x): x is string => !!x && x !== "Anonymous");
    setAiBusy("rewrite");
    exec(
      () =>
        runAiTaskAction("incident.rewrite", {
          incidentType: open.type,
          location: open.location || undefined,
          description: target === "case_summary" ? (f.summary || open.description) : open.description,
          reviewerNotes: notes || undefined,
          target,
          names,
        }) as Promise<{ ok: true; data: { rewritten: string; followUpChecklist: string[]; flags: string[] } } | { ok: false; error: string }>,
      {
        onOk: (res) => {
          setAiDraft({ target, ...res });
          toast("ok", "Neutral summary ready — review before applying.");
        },
      }
    );
  };

  const runChecklistSuggest = () => {
    if (!open) return;
    setAiBusy("checklist");
    setSavedChecklistTitle(null);
    exec(
      () =>
        runAiTaskAction("incident.checklist", {
          incidentType: open.type,
          location: open.location || undefined,
          description: open.description,
          reviewerNotes: notes.trim().slice(0, 4000) || undefined,
        }) as Promise<{ ok: true; data: AiChecklistResponse } | { ok: false; error: string }>,
      {
        onOk: (res) => {
          setChecklistDraft({
            title: res.title,
            shiftType: res.shiftType,
            rationale: res.rationale,
            items: res.items.map((it, idx) => ({
              id: mkItemId(idx),
              label: it.label,
              required: it.required,
              selected: true,
            })),
          });
          toast("ok", "Preventative checklist draft ready — review items before saving.");
        },
      }
    );
  };

  const savePreventativeChecklist = () => {
    if (!checklistDraft) return;
    const chosen = checklistDraft.items.filter((it) => it.selected && it.label.trim().length > 0);
    if (checklistDraft.title.trim().length < 3 || chosen.length === 0) return;
    const savedTitle = checklistDraft.title.trim();
    setAiBusy("save_checklist");
    exec(
      () =>
        saveTemplateAction({
          title: savedTitle,
          shiftType: checklistDraft.shiftType,
          departmentId: "",
          scheduleDays: [],
          dueTime: "",
          items: chosen.map((it) => ({
            id: it.id,
            label: it.label.trim(),
            required: it.required,
          })),
        }),
      {
        success: "Preventative checklist template created",
        onOk: () => {
          setSavedChecklistTitle(savedTitle);
          setChecklistDraft(null);
          router.refresh();
        },
      }
    );
  };

  const selectedChecklistItems = checklistDraft ? checklistDraft.items.filter((it) => it.selected) : [];
  const canSaveChecklist =
    !!checklistDraft &&
    checklistDraft.title.trim().length >= 3 &&
    selectedChecklistItems.length > 0 &&
    selectedChecklistItems.every((it) => it.label.trim().length > 0);

  return (
    <>
      <PageHeader title="Incident Reports" sub="Near misses, injuries, hazards and conduct concerns filed by anyone on the team. Review them, then close them or turn them into a case.">{canManage && <a className="btn" href="/api/export/osha">Injury log (CSV)</a>}</PageHeader>
      <div className="mb-3"><select className="input !w-48" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{["NEW", "REVIEWING", "CLOSED", "CONVERTED"].map((s) => <option key={s}>{s}</option>)}</select></div>
      {shown.length === 0 ? <Empty title="No incident reports" hint="Employees file them from My Portal." /> : (
        <div className="card max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead><tr>{["Type", "Happened", "Where", "Reported by", "Status", "Summary"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>{shown.map((r) => (
              <tr key={r.id} className="cursor-pointer hover:bg-muted" onClick={() => select(r)}>
                <td className="td"><Badge value={r.type === "INJURY" ? "SUSPENSION" : r.type === "NEAR_MISS" ? "STRIKE_POINTS" : "VERBAL_WARNING"} label={r.type} /></td>
                <td className="td mono text-xs">{fmtDateTime(r.at)}</td><td className="td">{r.location || "—"}</td><td className="td">{r.by}</td>
                <td className="td"><Badge value={tone[r.status] ?? "PENDING"} label={r.status} /></td><td className="td max-w-xs truncate text-soft">{r.description}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
      <Drawer open={!!open} onClose={() => setOpenId(null)} title="Incident report" wide>
        {open && (
          <div className="space-y-4 text-[13px]">
            <div className="flex flex-wrap items-center gap-2"><Badge value="VERBAL_WARNING" label={open.type} /><Badge value={tone[open.status] ?? "PENDING"} label={open.status} />{open.caseNumber && <span className="mono">→ {open.caseNumber}</span>}</div>
            <div className="grid gap-3 sm:grid-cols-2"><div><div className="text-xs text-soft">Happened</div><div className="mono">{fmtDateTime(open.at)}</div></div><div><div className="text-xs text-soft">Location</div>{open.location || "—"}</div><div><div className="text-xs text-soft">Reported by</div>{open.by}</div><div><div className="text-xs text-soft">Filed</div><div className="mono">{fmtDateTime(open.filedAt)}</div></div></div>
            <div><div className="text-xs text-soft">What happened</div><p className="mt-0.5 whitespace-pre-wrap leading-relaxed">{open.description}</p></div>
            {open.anonymous && <p className="text-xs text-soft">Filed anonymously. The reporter&apos;s identity was not saved.</p>}
            {open.photos.length > 0 && <div className="flex flex-wrap gap-2">{open.photos.map((id) => <a key={id} href={`/api/files/${id}`} target="_blank" rel="noreferrer"><img src={`/api/files/${id}`} alt="Incident photo" className="h-24 w-24 rounded-md border border-line object-cover" /></a>)}</div>}
            {(open.investigator || open.due) && <p className="text-xs text-soft">Investigator: <span className="font-medium text-ink">{open.investigator || "unassigned"}</span>{open.due ? ` · due ${open.due}` : ""}</p>}
            {canManage && open.status !== "CONVERTED" && (
              <div className="space-y-2 border-t border-line pt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Investigator"><select className="input" value={inv.investigatorMemberId} onChange={(e) => setInv({ ...inv, investigatorMemberId: e.target.value })}><option value="">Unassigned</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
                  <Field label="Investigation due"><input className="input mono" type="date" value={inv.investigationDue} onChange={(e) => setInv({ ...inv, investigationDue: e.target.value })} /></Field>
                </div>
                {open.type === "INJURY" && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Body part"><input className="input" value={inv.bodyPart} onChange={(e) => setInv({ ...inv, bodyPart: e.target.value })} /></Field>
                    <Field label="Treatment"><input className="input" placeholder="First aid, clinic, ER" value={inv.treatment} onChange={(e) => setInv({ ...inv, treatment: e.target.value })} /></Field>
                    <Field label="Days away from work"><input className="input mono" type="number" min={0} value={inv.daysAway} onChange={(e) => setInv({ ...inv, daysAway: Number(e.target.value) })} /></Field>
                  </div>
                )}
                <Field label="Reviewer notes (internal)"><textarea className="textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
                {aiCare && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button type="button" className="btn !h-7 !text-xs" disabled={pending} onClick={() => runIncidentAi("reviewer_notes")}>
                        <Sparkles className="h-3.5 w-3.5 text-accent" />{pending && aiBusy === "rewrite" ? "Drafting…" : "Structure & neutralize with AI"}
                      </button>
                      <span className="text-[11px] text-soft">Names &amp; contact details scrubbed before AI. Draft only.</span>
                    </div>
                    {aiDraft && aiDraft.target === "reviewer_notes" && (
                      <div className="space-y-2 rounded-lg border border-accent/40 bg-accent/5 p-3 text-xs">
                        <div className="flex items-center justify-between gap-2 font-semibold">
                          <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-accent" />Structured review draft</span>
                          <button type="button" className="font-normal text-soft underline" onClick={() => setAiDraft(null)}>Discard</button>
                        </div>
                        <p className="whitespace-pre-wrap rounded border border-line bg-surface p-2.5 text-[13px] text-ink">{aiDraft.rewritten}</p>
                        {aiDraft.followUpChecklist.length > 0 && (
                          <div>
                            <div className="font-medium text-soft">Suggested investigator follow-ups:</div>
                            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-soft">{aiDraft.followUpChecklist.map((item, i) => <li key={i}>{item}</li>)}</ul>
                          </div>
                        )}
                        {aiDraft.flags.length > 0 && (
                          <ul className="list-disc space-y-0.5 pl-4 text-amber-800 dark:text-amber-300">{aiDraft.flags.map((fl, i) => <li key={i}>{fl}</li>)}</ul>
                        )}
                        <button type="button" className="btn-primary !h-8 w-full text-xs" onClick={() => { setNotes(aiDraft.rewritten); setAiDraft(null); toast("ok", "Applied draft to reviewer notes."); }}>
                          Apply to reviewer notes
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {(["REVIEWING", "CLOSED"] as const).map((s) => <button key={s} className="btn" disabled={pending} onClick={() => exec(() => updateIncidentAction(open.id, { status: s, reviewerNotes: notes, investigatorMemberId: inv.investigatorMemberId, investigationDue: inv.investigationDue, ...(open.type === "INJURY" ? { injury: { bodyPart: inv.bodyPart, treatment: inv.treatment, daysAway: inv.daysAway } } : {}) }), { success: `Marked ${s.toLowerCase()}`, onOk: () => router.refresh() })}>{s === "REVIEWING" ? "Start review" : "Close"}</button>)}
                  <button className="btn-primary" onClick={() => setConv(!conv)}>Turn into a case</button>
                </div>
                {conv && (
                  <div className="anim-slide-down space-y-3 rounded-lg border border-line p-3">
                    <p className="text-xs text-soft">Only open a case if someone&apos;s conduct needs documented follow-up. Reports made in good faith, such as stop-work or near-miss reports, should not be punished.</p>
                    <Field label="Employee the case is about"><select className="input" value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })}><option value="">Select…</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}</select></Field>
                    <div className="grid grid-cols-2 gap-3"><Field label="Severity"><select className="input" value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}>{severities.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select></Field><Field label="Strike points"><input className="input mono" type="number" min={0} value={f.pointsAdded} onChange={(e) => setF({ ...f, pointsAdded: Number(e.target.value) })} /></Field></div>
                    <Field label="Policy violated"><input className="input" value={f.policyViolated} onChange={(e) => setF({ ...f, policyViolated: e.target.value })} /></Field>
                    <Field label="Summary (visible to the employee)"><textarea className="textarea" rows={3} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} /></Field>
                    {aiCare && (
                      <div className="space-y-2">
                        <button type="button" className="btn !h-7 !text-xs" disabled={pending || (f.summary || open.description).trim().length < 10} onClick={() => runIncidentAi("case_summary")}>
                          <Sparkles className="h-3.5 w-3.5 text-accent" />{pending && aiBusy === "rewrite" ? "Rewriting…" : "Rewrite case summary neutrally with AI"}
                        </button>
                        {aiDraft && aiDraft.target === "case_summary" && (
                          <div className="space-y-2 rounded-lg border border-accent/40 bg-accent/5 p-3 text-xs">
                            <div className="flex items-center justify-between gap-2 font-semibold">
                              <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-accent" />Neutral case summary draft</span>
                              <button type="button" className="font-normal text-soft underline" onClick={() => setAiDraft(null)}>Discard</button>
                            </div>
                            <p className="whitespace-pre-wrap rounded border border-line bg-surface p-2.5 text-[13px] text-ink">{aiDraft.rewritten}</p>
                            {aiDraft.flags.length > 0 && (
                              <ul className="list-disc space-y-0.5 pl-4 text-amber-800 dark:text-amber-300">{aiDraft.flags.map((fl, i) => <li key={i}>{fl}</li>)}</ul>
                            )}
                            <button type="button" className="btn-primary !h-8 w-full text-xs" onClick={() => { setF({ ...f, summary: aiDraft.rewritten }); setAiDraft(null); toast("ok", "Applied neutral summary."); }}>
                              Use this summary
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    <Field label="Confidential manager notes"><textarea className="textarea" rows={2} value={f.confidentialManagerNotes} onChange={(e) => setF({ ...f, confidentialManagerNotes: e.target.value })} /></Field>
                    <button className="btn-primary w-full" disabled={pending} onClick={() => exec(() => convertIncidentAction(open.id, { ...f, pointsAdded: Number(f.pointsAdded) }), { success: "Case created", onOk: () => { setConv(false); router.refresh(); } })}>Create case</button>
                  </div>
                )}
              </div>
            )}

            {canManage && aiCare && (
              <div className="space-y-2.5 border-t border-line pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-ink">Post-incident prevention</div>
                    <p className="text-[11px] text-soft">Turn lessons from this report into recurring shift checklist items.</p>
                  </div>
                  <button
                    type="button"
                    className="btn !h-7 !text-xs"
                    disabled={pending || open.description.trim().length < 10}
                    onClick={runChecklistSuggest}
                  >
                    <ListChecks className="h-3.5 w-3.5 text-accent" />
                    {pending && aiBusy === "checklist" ? "Suggesting…" : checklistDraft ? "Regenerate suggestions" : "Suggest preventative checklist items"}
                  </button>
                </div>

                {savedChecklistTitle && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                    <span>Saved checklist template &ldquo;{savedChecklistTitle}&rdquo;.</span>
                    <Link href="/app/checklists" className="inline-flex items-center gap-1 font-medium underline">
                      Open Shift Checklists
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                )}

                {checklistDraft && (
                  <div className="anim-slide-down space-y-3 rounded-lg border border-accent/40 bg-accent/5 p-3.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                        <Sparkles className="h-3.5 w-3.5 text-accent" />
                        Preventative checklist draft
                      </span>
                      <button type="button" className="text-soft underline" onClick={() => setChecklistDraft(null)}>
                        Discard
                      </button>
                    </div>

                    {checklistDraft.rationale && (
                      <p className="rounded border border-line bg-surface p-2 text-[12px] text-soft">
                        <span className="font-medium text-ink">Why these checks:</span> {checklistDraft.rationale}
                      </p>
                    )}

                    <div className="grid gap-2.5 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <Field label="Checklist title">
                          <input
                            className="input"
                            value={checklistDraft.title}
                            onChange={(e) => setChecklistDraft({ ...checklistDraft, title: e.target.value })}
                          />
                        </Field>
                      </div>
                      <Field label="Shift type">
                        <select
                          className="input"
                          value={checklistDraft.shiftType}
                          onChange={(e) => setChecklistDraft({ ...checklistDraft, shiftType: e.target.value as ShiftType })}
                        >
                          {SHIFT_TYPES.map((st) => (
                            <option key={st.value} value={st.value}>{st.label}</option>
                          ))}
                        </select>
                      </Field>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="label !mb-0">
                          Checklist items ({selectedChecklistItems.length} of {checklistDraft.items.length} selected)
                        </span>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
                          onClick={() =>
                            setChecklistDraft({
                              ...checklistDraft,
                              items: [
                                ...checklistDraft.items,
                                { id: mkItemId(checklistDraft.items.length), label: "", required: true, selected: true },
                              ],
                            })
                          }
                        >
                          <Plus className="h-3 w-3" />
                          Add item
                        </button>
                      </div>

                      {checklistDraft.items.map((item, idx) => (
                        <div key={item.id} className="flex items-center gap-2 rounded-md border border-line bg-surface p-1.5">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            aria-label={`Include item ${idx + 1}`}
                            onChange={(e) =>
                              setChecklistDraft({
                                ...checklistDraft,
                                items: checklistDraft.items.map((x) => (x.id === item.id ? { ...x, selected: e.target.checked } : x)),
                              })
                            }
                          />
                          <input
                            className={`input !h-7 flex-1 !border-0 !bg-transparent !px-1 text-xs ${!item.selected ? "text-soft line-through" : ""}`}
                            value={item.label}
                            placeholder="Describe preventative check…"
                            onChange={(e) =>
                              setChecklistDraft({
                                ...checklistDraft,
                                items: checklistDraft.items.map((x) => (x.id === item.id ? { ...x, label: e.target.value } : x)),
                              })
                            }
                          />
                          <button
                            type="button"
                            className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${item.required ? "border-accent/40 bg-accent/10 text-accent" : "border-line bg-muted text-soft"}`}
                            onClick={() =>
                              setChecklistDraft({
                                ...checklistDraft,
                                items: checklistDraft.items.map((x) => (x.id === item.id ? { ...x, required: !x.required } : x)),
                              })
                            }
                          >
                            {item.required ? "Required" : "Optional"}
                          </button>
                          <button
                            type="button"
                            aria-label="Remove item"
                            className="p-1 text-soft hover:text-rose-600"
                            onClick={() =>
                              setChecklistDraft({
                                ...checklistDraft,
                                items: checklistDraft.items.filter((x) => x.id !== item.id),
                              })
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <p className="text-[11px] text-soft">
                      Review, edit, or uncheck items above. Nothing is created until you click Save.
                    </p>

                    <button
                      type="button"
                      className="btn-primary !h-8 w-full text-xs"
                      disabled={pending || !canSaveChecklist}
                      onClick={savePreventativeChecklist}
                    >
                      {pending && aiBusy === "save_checklist"
                        ? "Saving checklist…"
                        : `Save as new checklist template (${selectedChecklistItems.length} item${selectedChecklistItems.length === 1 ? "" : "s"})`}
                    </button>
                  </div>
                )}
              </div>
            )}

            {open.notes && !canManage && <div><div className="text-xs text-soft">Reviewer notes</div>{open.notes}</div>}
          </div>
        )}
      </Drawer>
    </>
  );
}
