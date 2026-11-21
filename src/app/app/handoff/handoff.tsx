"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createHandoffNoteAction, deleteHandoffNoteAction } from "@/actions/operations";
import { Empty, Field, PageHeader, useAction } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

type Note = { id: string; author: string; body: string; departmentId: string | null; department: string | null; at: string };
type ChecklistNote = { id: string; author: string; checklist: string; body: string; at: string };

export function HandoffFeed({
  notes,
  checklistNotes,
  departments,
  canManage,
}: {
  notes: Note[];
  checklistNotes: ChecklistNote[];
  departments: { id: string; name: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [body, setBody] = useState("");
  const [dept, setDept] = useState("");
  const [filterDept, setFilterDept] = useState("");

  const shown = useMemo(() => notes.filter((n) => !filterDept || n.departmentId === filterDept), [notes, filterDept]);

  return (
    <>
      <PageHeader title="Shift Handoff Notes" sub="Shared operational log passed between opening, mid-shift, and closing teams." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="card p-4">
            <h2 className="mb-2 text-sm font-semibold">Post a handoff note</h2>
            <div className="space-y-3">
              <Field label="Department (optional)">
                <select className="input" value={dept} onChange={(e) => setDept(e.target.value)}>
                  <option value="">All departments / General</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="What does the next shift need to know?">
                <textarea className="textarea" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Pending tasks, equipment status, incidents or follow-ups…" />
              </Field>
              <button
                className="btn-primary"
                disabled={pending || body.trim().length < 3}
                onClick={() => exec(() => createHandoffNoteAction({ departmentId: dept, body }), { success: "Handoff note posted", onOk: () => { setBody(""); router.refresh(); } })}
              >
                Post note
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Handoff feed</h2>
            <select className="input !w-48" value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {shown.length === 0 ? (
            <Empty title="No handoff notes yet" hint="Post an update above for the incoming shift." />
          ) : (
            <div className="space-y-2">
              {shown.map((n) => (
                <div key={n.id} className="card p-3.5 text-[13px]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{n.author}</span>
                      {n.department && <span className="rounded border border-line bg-muted px-1.5 py-0.5 text-[11px]">{n.department}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="mono text-xs text-soft">{fmtDateTime(n.at)}</span>
                      {canManage && (
                        <button
                          className="btn !px-1.5"
                          aria-label="Delete note"
                          disabled={pending}
                          onClick={() => exec(() => deleteHandoffNoteAction(n.id), { success: "Note deleted", onOk: () => router.refresh() })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-ink">{n.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold">Notes from shift checklists</h2>
          {checklistNotes.length === 0 ? (
            <div className="card p-4 text-[13px] text-soft">When employees include handoff notes while submitting a shift checklist, they appear here automatically.</div>
          ) : (
            <div className="card divide-y divide-line">
              {checklistNotes.map((c) => (
                <div key={c.id} className="p-3 text-[13px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{c.checklist}</span>
                    <span className="mono text-[11px] text-soft">{fmtDateTime(c.at)}</span>
                  </div>
                  <div className="text-xs text-soft">By {c.author}</div>
                  <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
