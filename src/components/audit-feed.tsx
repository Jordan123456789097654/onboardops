"use client";
import { useEffect, useRef, useState } from "react";

type Row = { id: number; t: string; a: string; x: string; h: string };
const pool: Omit<Row, "id">[] = [
  { t: "Nov 20 14:02", a: "Helen Okafor", x: "SETTINGS_UPDATED", h: "e91b04c7" },
  { t: "Nov 19 09:48", a: "Priya Nair", x: "CHECKLIST_VERIFIED", h: "7c20d5be" },
  { t: "Nov 18 16:31", a: "Marcus Reyes", x: "INFRACTION_ISSUED", h: "3fa8e60b" },
  { t: "Nov 18 10:12", a: "Keisha Brooks", x: "QUIZ_PASSED", h: "b6419c0e" },
  { t: "Nov 09 08:30", a: "Marcus Reyes", x: "EMPLOYEE_CREATED", h: "0d5e3a18" },
  { t: "Nov 21 08:15", a: "Dana Whitfield", x: "COURSE_ASSIGNED", h: "a41f77d2" },
  { t: "Nov 21 08:41", a: "Tomas Alvarez", x: "INFRACTION_ACKNOWLEDGED", h: "58c3be09" },
  { t: "Nov 21 09:03", a: "Rosa Delgado", x: "QUIZ_PASSED", h: "c9027ae4" },
];

/** A small live-feeling audit table: a new entry slides in every few seconds. */
export function AuditFeed() {
  const [rows, setRows] = useState<Row[]>(pool.slice(0, 5).map((r, i) => ({ ...r, id: i })));
  const next = useRef(5);
  const ref = useRef<HTMLDivElement>(null);
  const visible = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { visible.current = e.isIntersecting; }, { threshold: 0.4 });
    io.observe(el);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => io.disconnect();
    const t = setInterval(() => {
      if (!visible.current) return;
      const n = next.current++;
      const src = pool[n % pool.length];
      setRows((r) => [{ ...src, id: n }, ...r.slice(0, 4)]);
    }, 3200);
    return () => { clearInterval(t); io.disconnect(); };
  }, []);

  return (
    <div ref={ref} className="bg-surface text-[12px]">
      <div className="grid grid-cols-[110px_1fr_1.3fr_80px]">
        <div className="th !static">Time</div><div className="th !static">Actor</div><div className="th !static">Action</div><div className="th !static">Hash</div>
        {rows.map((r, i) => (
          <div key={r.id} className={i === 0 && r.id >= 5 ? "contents feed-new" : "contents"}>
            <div className="mono border-b border-line px-3 py-2 text-[11px] text-soft">{r.t}</div>
            <div className="border-b border-line px-3 py-2">{r.a}</div>
            <div className="mono border-b border-line px-3 py-2 text-[11px]">{r.x}</div>
            <div className="mono border-b border-line px-3 py-2 text-[11px] text-soft">{r.h}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
