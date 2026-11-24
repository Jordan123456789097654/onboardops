"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { deleteTemplateAction, duplicateTemplateAction, saveTemplateAction, verifyChecklistAction } from "@/actions/checklists";
import { runAiTaskAction } from "@/actions/ai";
import { Badge, Empty, Field, Modal, PageHeader, Tabs, useAction, useToast } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

type Item = { id: string; label: string; required: boolean };
type Tpl = { scheduleDays: number[]; dueTime: string; id?: string; title: string; shiftType: string; departmentId: string; department?: string; items: Item[] };
type Sub = { id: string; title: string; by: string; at: string; done: number; total: number; notes: string; verifiedBy: string | null; photos: { id: string; fileId: string; caption: string }[] };

const blank = (): Tpl => ({ title: "", shiftType: "OPENING", departmentId: "", scheduleDays: [], dueTime: "", items: [{ id: "i1", label: "", required: true }] });

const CHECKLIST_STARTERS: { label: string; shiftType: "OPENING" | "MID_SHIFT" | "CLOSING"; prompt: string }[] = [
  { label: "Closing coffee shop", shiftType: "CLOSING", prompt: "Closing shift for a 2-person coffee shop by 21:00: clean espresso machine, clear pastry case, mop behind bar, count register drawer, take out trash, lock back door and arm alarm" },
  { label: "Opening retail store", shiftType: "OPENING", prompt: "Opening shift for a retail shop by 09:00: disarm alarm, turn on lights and music, verify POS terminals and cash floats, inspect sales floor and fitting rooms, unlock front doors" },
  { label: "Warehouse dock opening", shiftType: "OPENING", prompt: "Morning warehouse opening shift: inspect forklift battery/brakes/horn, clear loading bays and fire exits, check pallet jacks, review inbound shipment schedule, verify PPE station is stocked" },
  { label: "Kitchen closing", shiftType: "CLOSING", prompt: "Line kitchen closing shift: log walk-in fridge temperatures, date-label and wrap prepped food, shut off grills/fryers/gas valves, sanitize prep surfaces, empty grease traps, sweep and mop floor" },
  { label: "Mid-shift safety sweep", shiftType: "MID_SHIFT", prompt: "Mid-shift walkthrough: inspect restrooms and restock soap/paper, wipe high-touch surfaces, check floor for spills or trip hazards, verify temperature logs, prep restock list for next shift" },
];

export function Checklists({ canEdit, ai = false, departments, templates, submissions }: { canEdit: boolean; ai?: boolean; departments: { id: string; name: string }[]; templates: Tpl[]; submissions: Sub[] }) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();
  const [tab, setTab] = useState("logs");
  const [edit, setEdit] = useState<Tpl | null>(null);

  // AI Checklist Generator state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiShift, setAiShift] = useState<"OPENING" | "MID_SHIFT" | "CLOSING">("CLOSING");
  const [aiCount, setAiCount] = useState(10);

  const openEditor = (tpl: Tpl, withAi = false) => {
    setEdit(tpl);
    setAiOpen(withAi);
    if (tpl.shiftType === "OPENING" || tpl.shiftType === "MID_SHIFT" || tpl.shiftType === "CLOSING") {
      setAiShift(tpl.shiftType);
    }
  };

  const generateChecklist = () => {
    if (!edit) return;
    exec(
      () =>
        runAiTaskAction("checklist.draft", { prompt: aiPrompt, shiftType: aiShift, itemCount: aiCount }) as Promise<
          { ok: true; data: { title: string; shiftType: "OPENING" | "MID_SHIFT" | "CLOSING"; suggestedDueTime: string; items: { label: string; required: boolean }[] } } | { ok: false; error: string }
        >,
      {
        onOk: (res) => {
          const base = Date.now();
          setEdit({
            ...edit,
            title: res.title,
            shiftType: res.shiftType,
            dueTime: res.suggestedDueTime || edit.dueTime,
            items: res.items.map((it, idx) => ({ id: `ai${base}_${idx}`, label: it.label, required: it.required })),
          });
          setAiOpen(false);
          toast("ok", `Generated ${res.items.length} checklist items — review and save.`);
        },
      }
    );
  };

  return (
    <>
      <PageHeader title="Shift Checklists" sub="Templates per department and the logs employees submit.">
        {canEdit && ai && (
          <button className="btn" onClick={() => openEditor(blank(), true)}>
            <Sparkles className="h-3.5 w-3.5 text-accent" />Generate with AI
          </button>
        )}
        {canEdit && <button className="btn-primary" onClick={() => openEditor(blank(), false)}>New template</button>}
      </PageHeader>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "logs", label: "Completed logs" }, { id: "templates", label: "Templates" }]} />
      <div className="mt-4">
        {tab === "logs" && (submissions.length === 0 ? <Empty title="No submissions yet" hint="Employees submit checklists from their portal." /> : (
          <div className="card divide-y divide-line">{submissions.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-[13px]">
              <div className="min-w-0 flex-1"><div className="font-medium">{s.title}</div><div className="text-xs text-soft">{s.by} · <span className="mono">{fmtDateTime(s.at)}</span></div>{s.notes && <div className="mt-1 text-soft">“{s.notes}”</div>}{s.photos.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{s.photos.map((ph) => <a key={ph.id} href={`/api/files/${ph.fileId}`} target="_blank" rel="noreferrer" title={ph.caption}><img src={`/api/files/${ph.fileId}`} alt={ph.caption || "Checklist photo"} className="h-16 w-16 rounded-md border border-line object-cover" /></a>)}</div>}</div>
              <span className="mono">{s.done}/{s.total}</span>
              {s.verifiedBy ? <Badge value="PASSED" label={`Verified by ${s.verifiedBy}`} /> : <button className="btn" disabled={pending} onClick={() => exec(() => verifyChecklistAction(s.id), { success: "Verified", onOk: () => router.refresh() })}>Verify</button>}
            </div>))}</div>
        ))}
        {tab === "templates" && (templates.length === 0 ? <Empty title="No templates yet" hint="Create a template manually or click Generate with AI to build one from a shift description." /> : (
          <div className="grid gap-3 md:grid-cols-2">{templates.map((t) => (
            <div key={t.id} className="card p-4 text-[13px]"><div className="flex items-center justify-between"><h3 className="font-medium">{t.title}</h3><Badge value="LOA" label={t.shiftType.replace("_", " ")} /></div><p className="text-xs text-soft">{t.department}{t.scheduleDays.length > 0 ? ` · ${t.scheduleDays.length === 7 ? "Every day" : t.scheduleDays.map((n) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][n]).join(", ")}${t.dueTime ? ` by ${t.dueTime}` : ""}` : ""}</p>
              <ul className="mt-2 list-disc space-y-0.5 pl-4">{t.items.map((i) => <li key={i.id}>{i.label}{i.required ? "" : " (optional)"}</li>)}</ul>
              {canEdit && <div className="mt-3 flex gap-2"><button className="btn" onClick={() => openEditor(t, false)}>Edit</button><button className="btn" disabled={pending} onClick={() => exec(() => duplicateTemplateAction(t.id!), { success: "Duplicated", onOk: () => router.refresh() })}>Duplicate</button><button className="btn-danger" disabled={pending} onClick={() => { if (confirm(`Delete "${t.title}"?`)) exec(() => deleteTemplateAction(t.id!), { success: "Deleted", onOk: () => router.refresh() }); }}>Delete</button></div>}</div>))}</div>
        ))}
      </div>
      <Modal open={!!edit} onClose={() => { setEdit(null); setAiOpen(false); }} title={edit?.id ? "Edit template" : "New template"}>
        {edit && (
          <div className="space-y-3">
            {ai && (
              <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-[13px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                    <Sparkles className="h-3.5 w-3.5 text-accent" />AI Shift Checklist Generator
                  </span>
                  <button type="button" className="text-xs text-accent underline" onClick={() => setAiOpen((v) => !v)}>
                    {aiOpen ? "Hide" : "Describe shift"}
                  </button>
                </div>
                {aiOpen && (
                  <div className="mt-3 space-y-2.5">
                    <div>
                      <div className="mb-1 text-[11px] font-medium text-soft">Quick examples</div>
                      <div className="flex flex-wrap gap-1">
                        {CHECKLIST_STARTERS.map((s) => (
                          <button
                            key={s.label}
                            type="button"
                            className="btn !h-6 !px-2 !text-[11px]"
                            onClick={() => { setAiPrompt(s.prompt); setAiShift(s.shiftType); }}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Field label="Describe the shift, role, and equipment">
                      <textarea
                        className="textarea"
                        rows={3}
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder='e.g. "Closing shift for a 2-person coffee shop with espresso machine, pastry case, cash register, and alarm"'
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Shift type">
                        <select className="input" value={aiShift} onChange={(e) => setAiShift(e.target.value as typeof aiShift)}>
                          <option value="OPENING">Opening</option>
                          <option value="MID_SHIFT">Mid shift</option>
                          <option value="CLOSING">Closing</option>
                        </select>
                      </Field>
                      <Field label="Target items">
                        <select className="input" value={aiCount} onChange={(e) => setAiCount(Number(e.target.value))}>
                          {[6, 10, 15, 20].map((n) => <option key={n} value={n}>~{n} items</option>)}
                        </select>
                      </Field>
                    </div>
                    <button
                      type="button"
                      className="btn-primary w-full"
                      disabled={pending || aiPrompt.trim().length < 10}
                      onClick={generateChecklist}
                    >
                      <Sparkles className="h-3.5 w-3.5" />{pending ? "Generating checklist…" : "Generate checklist draft"}
                    </button>
                  </div>
                )}
              </div>
            )}

            <Field label="Title"><input className="input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Shift"><select className="input" value={edit.shiftType} onChange={(e) => setEdit({ ...edit, shiftType: e.target.value })}><option value="OPENING">Opening</option><option value="MID_SHIFT">Mid shift</option><option value="CLOSING">Closing</option></select></Field>
              <Field label="Department"><select className="input" value={edit.departmentId} onChange={(e) => setEdit({ ...edit, departmentId: e.target.value })}><option value="">All</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
            </div>
            <div className="rounded-md border border-line p-2 text-xs">
              <div className="mb-1 font-medium">Repeats on (leave empty for no schedule)</div>
              <div className="flex flex-wrap items-center gap-2">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, n) => (
                <label key={d} className="flex items-center gap-1"><input type="checkbox" checked={edit.scheduleDays.includes(n)} onChange={(e) => setEdit({ ...edit, scheduleDays: e.target.checked ? [...edit.scheduleDays, n] : edit.scheduleDays.filter((x) => x !== n) })} />{d}</label>
              ))}
                <label className="ml-auto flex items-center gap-1">Due by <input className="input mono !h-7 !w-24" type="time" value={edit.dueTime} onChange={(e) => setEdit({ ...edit, dueTime: e.target.value })} /></label>
              </div>
            </div>
            <div className="space-y-1.5">{edit.items.map((i, k) => (
              <div key={i.id} className="flex items-center gap-2"><input className="input" placeholder="Checklist item" value={i.label} onChange={(e) => setEdit({ ...edit, items: edit.items.map((x, n) => (n === k ? { ...x, label: e.target.value } : x)) })} />
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={i.required} onChange={(e) => setEdit({ ...edit, items: edit.items.map((x, n) => (n === k ? { ...x, required: e.target.checked } : x)) })} />Req</label>
                <button className="btn !px-2" disabled={edit.items.length === 1} onClick={() => setEdit({ ...edit, items: edit.items.filter((_, n) => n !== k) })}>×</button></div>))}</div>
            <button className="btn" onClick={() => setEdit({ ...edit, items: [...edit.items, { id: `i${Date.now()}`, label: "", required: true }] })}>Add item</button>
            <button className="btn-primary w-full" disabled={pending} onClick={() => exec(() => saveTemplateAction(edit), { success: "Template saved", onOk: () => { setEdit(null); router.refresh(); } })}>Save template</button>
          </div>
        )}
      </Modal>
    </>
  );
}
