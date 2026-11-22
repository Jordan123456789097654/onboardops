"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteTemplateAction, duplicateTemplateAction, saveTemplateAction, verifyChecklistAction } from "@/actions/checklists";
import { Badge, Empty, Field, Modal, PageHeader, Tabs, useAction } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

type Item = { id: string; label: string; required: boolean };
type Tpl = { scheduleDays: number[]; dueTime: string; id?: string; title: string; shiftType: string; departmentId: string; department?: string; items: Item[] };
type Sub = { id: string; title: string; by: string; at: string; done: number; total: number; notes: string; verifiedBy: string | null; photos: { id: string; fileId: string; caption: string }[] };

const blank = (): Tpl => ({ title: "", shiftType: "OPENING", departmentId: "", scheduleDays: [], dueTime: "", items: [{ id: "i1", label: "", required: true }] });

export function Checklists({ canEdit, departments, templates, submissions }: { canEdit: boolean; departments: { id: string; name: string }[]; templates: Tpl[]; submissions: Sub[] }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [tab, setTab] = useState("logs");
  const [edit, setEdit] = useState<Tpl | null>(null);
  return (
    <>
      <PageHeader title="Shift Checklists" sub="Templates per department and the logs employees submit.">{canEdit && <button className="btn-primary" onClick={() => setEdit(blank())}>New template</button>}</PageHeader>
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
        {tab === "templates" && (templates.length === 0 ? <Empty title="No templates yet" /> : (
          <div className="grid gap-3 md:grid-cols-2">{templates.map((t) => (
            <div key={t.id} className="card p-4 text-[13px]"><div className="flex items-center justify-between"><h3 className="font-medium">{t.title}</h3><Badge value="LOA" label={t.shiftType.replace("_", " ")} /></div><p className="text-xs text-soft">{t.department}{t.scheduleDays.length > 0 ? ` · ${t.scheduleDays.length === 7 ? "Every day" : t.scheduleDays.map((n) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][n]).join(", ")}${t.dueTime ? ` by ${t.dueTime}` : ""}` : ""}</p>
              <ul className="mt-2 list-disc space-y-0.5 pl-4">{t.items.map((i) => <li key={i.id}>{i.label}{i.required ? "" : " (optional)"}</li>)}</ul>
              {canEdit && <div className="mt-3 flex gap-2"><button className="btn" onClick={() => setEdit(t)}>Edit</button><button className="btn" disabled={pending} onClick={() => exec(() => duplicateTemplateAction(t.id!), { success: "Duplicated", onOk: () => router.refresh() })}>Duplicate</button><button className="btn-danger" disabled={pending} onClick={() => { if (confirm(`Delete "${t.title}"?`)) exec(() => deleteTemplateAction(t.id!), { success: "Deleted", onOk: () => router.refresh() }); }}>Delete</button></div>}</div>))}</div>
        ))}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit template" : "New template"}>
        {edit && (
          <div className="space-y-3">
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
