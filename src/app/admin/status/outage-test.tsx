"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startOutageTestAction, stopOutageTestAction } from "@/actions/statuspage";
import { useAction } from "@/components/ui";

const SERVICES: { id: string; label: string; note?: string }[] = [
  { id: "database", label: "Database", note: "also takes Storage, Sign-in and the Core API down" },
  { id: "storage", label: "File storage" },
  { id: "auth", label: "Sign-in" },
  { id: "api", label: "Core API" },
  { id: "email", label: "Email" },
  { id: "frontend", label: "Website" },
  { id: "domains", label: "Domains" },
];

function left(until: string) {
  const s = Math.max(0, Math.round((Date.parse(until) - Date.now()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Forces the health checks for chosen services to report down, for a limited time, to test monitors and the status page. */
export function OutageTest({ canEdit, active, services, until, startedBy }: { canEdit: boolean; active: boolean; services: string[]; until: string | null; startedBy: string | null }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [picked, setPicked] = useState<string[]>(["database"]);
  const [minutes, setMinutes] = useState(10);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => { tick((n) => n + 1); if (until && Date.parse(until) <= Date.now()) router.refresh(); }, 1000);
    return () => clearInterval(t);
  }, [active, until, router]);

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <section className={`card p-4 text-[13px] ${active ? "border-red-400/60 bg-red-500/5" : ""}`}>
      <h2 className="text-sm font-semibold">Outage test</h2>
      {active ? (
        <>
          <p className="mt-2"><b>A test outage is running.</b> These services are reporting down: {services.join(", ")}. {until && <>Ends in <span className="mono">{left(until)}</span>.</>} {startedBy && <span className="text-soft">Started by {startedBy}.</span>}</p>
          <p className="mt-1 text-soft">The real app and database are working normally. Only the health checks are forced to fail, so monitors and the public status page react as in a real outage. Remember to post a notice if you want visitors to understand it.</p>
          {canEdit && <button className="btn-primary mt-3" disabled={pending} onClick={() => exec(() => stopOutageTestAction(), { success: "Outage test stopped", onOk: () => router.refresh() })}>Stop the test now</button>}
        </>
      ) : (
        <>
          <p className="mt-1 text-soft">Make the health checks for the services you pick report down for a short time, to test alerts and the public status page. Nothing is actually broken, and it always ends by itself.</p>
          {canEdit ? (
            <>
              <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {SERVICES.map((s) => <label key={s.id} className="flex items-start gap-2"><input className="mt-0.5" type="checkbox" checked={picked.includes(s.id)} onChange={() => toggle(s.id)} /><span>{s.label}{s.note && <span className="block text-[11px] text-soft">{s.note}</span>}</span></label>)}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2">Lasts <select className="input !h-8 !w-auto" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>{[2, 5, 10, 15, 30, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}</select></label>
                <button className="btn-danger" disabled={pending || picked.length === 0} onClick={() => { if (confirm("Start a test outage? Monitors will go down and alert emails may be sent. The public status page will show the affected services as down until it ends.")) exec(() => startOutageTestAction({ services: picked, minutes }), { success: "Outage test started", onOk: () => router.refresh() }); }}>Start outage test</button>
              </div>
              <p className="mt-2 text-xs text-soft">Visitors will see the services as down on the status page, and Better Stack may email you. Monitors take up to a few minutes to notice.</p>
            </>
          ) : <p className="mt-2 text-xs text-soft">Only the site owner can start an outage test.</p>}
        </>
      )}
    </section>
  );
}
