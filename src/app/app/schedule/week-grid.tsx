"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { assignShiftAction, moveShiftAction } from "@/actions/operations";
import { useAction } from "@/components/ui";

export type GridShift = { id: string; employeeId: string | null; employee: string; label: string; startsAt: string; endsAt: string; swap?: string | null };

const DAY = 86400000;
const startOfWeek = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export function WeekGrid({ shifts, employees }: { shifts: GridShift[]; employees: { id: string; label: string }[] }) {
  const router = useRouter();
  const { exec } = useAction();
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const [over, setOver] = useState<string | null>(null);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(week.getTime() + i * DAY)), [week]);
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const byDay = useMemo(() => {
    const m: Record<string, GridShift[]> = {};
    for (const s of shifts) (m[key(new Date(s.startsAt))] ??= []).push(s);
    for (const k of Object.keys(m)) m[k].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return m;
  }, [shifts]);

  const drop = (e: React.DragEvent, target: { day?: Date; shiftId?: string }) => {
    e.preventDefault();
    setOver(null);
    const raw = e.dataTransfer.getData("text/plain");
    const [type, id] = raw.split(":");
    if (type === "emp" && target.shiftId) exec(() => assignShiftAction(target.shiftId!, id || null), { success: "Assigned", onOk: () => router.refresh() });
    if (type === "shift" && target.day) {
      const s = shifts.find((x) => x.id === id);
      if (!s) return;
      const from = new Date(s.startsAt); from.setHours(0, 0, 0, 0);
      const delta = Math.round((target.day.getTime() - from.getTime()) / DAY);
      if (delta !== 0) exec(() => moveShiftAction(id, delta), { success: "Shift moved", onOk: () => router.refresh() });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[13px]">
        <button className="btn" onClick={() => setWeek(new Date(week.getTime() - 7 * DAY))}>Prev week</button>
        <span className="font-medium">{days[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} to {days[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
        <button className="btn" onClick={() => setWeek(new Date(week.getTime() + 7 * DAY))}>Next week</button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-soft">Drag a person onto a shift to assign it, or drag a shift to another day:</span>
        {employees.map((e) => <span key={e.id} draggable onDragStart={(ev) => ev.dataTransfer.setData("text/plain", `emp:${e.id}`)} className="cursor-grab rounded-full border border-line bg-surface px-2 py-0.5 active:cursor-grabbing">{e.label}</span>)}
        <span draggable onDragStart={(ev) => ev.dataTransfer.setData("text/plain", "emp:")} className="cursor-grab rounded-full border border-dashed border-line px-2 py-0.5">Open (unassign)</span>
      </div>
      <div className="grid gap-2 md:grid-cols-7">
        {days.map((d) => (
          <div key={d.toISOString()} onDragOver={(e) => { e.preventDefault(); setOver(key(d)); }} onDragLeave={() => setOver(null)} onDrop={(e) => drop(e, { day: d })}
            className={`card min-h-40 p-2 ${over === key(d) ? "!border-accent" : ""}`}>
            <div className="mb-1 text-xs font-medium text-soft">{d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</div>
            <div className="space-y-1.5">
              {(byDay[key(d)] ?? []).map((s) => (
                <div key={s.id} draggable onDragStart={(ev) => ev.dataTransfer.setData("text/plain", `shift:${s.id}`)}
                  onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.stopPropagation(); drop(e, { shiftId: s.id, day: d }); }}
                  className={`cursor-grab rounded-md border p-1.5 text-xs active:cursor-grabbing ${s.employeeId ? "border-line bg-muted" : "border-dashed border-amber-400 bg-amber-50 dark:bg-amber-950"}`}>
                  <div className="font-medium">{s.label || "Shift"}</div>
                  <div className="mono text-soft">{fmtTime(s.startsAt)} to {fmtTime(s.endsAt)}</div>
                  <div className={s.employeeId ? "" : "text-amber-700 dark:text-amber-300"}>{s.employee}</div>
                  {s.swap === "PENDING" && <div className="text-amber-700 dark:text-amber-300">swap requested</div>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
