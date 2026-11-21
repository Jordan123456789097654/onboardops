"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";

const items = [
  { id: "directory", label: "Staff directory", url: "/app/directory", text: "Search and filter every employee by department, status and readiness. Export the list to CSV." },
  { id: "dossier", label: "Employee dossier", url: "/app/employee/EMP-1005", text: "One page per person: contact details, shifts, training, infractions and an audit trail, with a printable PDF version." },
  { id: "course", label: "Course player", url: "/app/training/course", text: "Lessons with a minimum read time, then a quiz graded on the server. Passing issues a certificate code." },
  { id: "checklists", label: "Shift checklists", url: "/app/checklists", text: "Opening, mid-shift and closing checklists per department. Supervisors verify each completed log." },
  { id: "portal", label: "Employee portal", url: "/app/my-portal", text: "What an employee sees: their own courses, notices to sign and checklists. Nothing else." },
  { id: "settings", label: "Settings", url: "/app/settings", text: "Strike thresholds, automatic retraining, departments, job roles and the two Discord or Slack webhooks." },
];

export function Gallery() {
  const [id, setId] = useState(items[0].id);
  const cur = items.find((i) => i.id === id)!;
  return (
    <div>
      <div role="tablist" aria-label="App screens" className="no-scrollbar flex gap-1 overflow-x-auto rounded-lg border border-line bg-muted p-1">
        {items.map((i) => (
          <button key={i.id} role="tab" aria-selected={i.id === id} onClick={() => setId(i.id)} className={cn("whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium transition-all", i.id === id ? "bg-surface text-ink shadow-sm" : "text-soft hover:text-ink")}>{i.label}</button>
        ))}
      </div>
      <p className="mt-4 max-w-2xl text-[14px] text-soft">{cur.text}</p>
      <div className="mt-5 overflow-hidden rounded-xl border border-line bg-surface shadow-[0_24px_60px_-24px_rgba(9,9,11,0.28)]">
        <div className="flex h-9 items-center gap-3 border-b border-line bg-muted px-3">
          <div className="flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-line" /><i className="h-2.5 w-2.5 rounded-full bg-line" /><i className="h-2.5 w-2.5 rounded-full bg-line" /></div>
          <div className="mono mx-auto flex h-6 w-full max-w-sm items-center justify-center rounded-md border border-line bg-surface text-[11px] text-soft">{cur.url}</div>
          <div className="w-12" />
        </div>
        <div className="grid">
          {items.map((i) => (
            <div key={i.id} aria-hidden={i.id !== id} className={cn("col-start-1 row-start-1 transition-opacity duration-500", i.id === id ? "opacity-100" : "pointer-events-none opacity-0")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/screens/${i.id}-light.jpg`} width={2040} height={1260} loading="lazy" decoding="async" alt={i.id === id ? `${i.label} screen` : ""} className="shot-light block h-auto w-full" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/screens/${i.id}-dark.jpg`} width={2040} height={1260} loading="lazy" decoding="async" alt="" className="shot-dark block h-auto w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
