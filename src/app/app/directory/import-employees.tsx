"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileUp, Sparkles } from "lucide-react";
import { importEmployeesAction, type ImportResult } from "@/actions/import";
import { runAiTaskAction } from "@/actions/ai";
import { mapEmployeeCsv, csvHeaders, parseCsv, IMPORT_FIELDS, EMPLOYEE_CSV_TEMPLATE, type ParsedImport } from "@/lib/csv";
import { Modal, useAction, useToast } from "@/components/ui";

export function ImportEmployees({ aiCare = false }: { aiCare?: boolean }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [fileName, setFileName] = useState("");
  const [raw, setRaw] = useState("");
  const [cols, setCols] = useState<{ headers: string[]; map: string[] }>({ headers: [], map: [] });
  const [mapOpen, setMapOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [createMissing, setCreateMissing] = useState(false);
  const [sendWelcome, setSendWelcome] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const reset = () => { setParsed(null); setFileName(""); setRaw(""); setCols({ headers: [], map: [] }); setMapOpen(false); setAiBusy(false); setResult(null); if (input.current) input.current.value = ""; };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setResult(null);
    setFileName(f.name);
    const text = await f.text();
    const h = csvHeaders(text);
    const p = mapEmployeeCsv(text);
    setRaw(text);
    setCols({ headers: h.headers, map: h.auto });
    setParsed(p);
    setMapOpen(p.missingRequired.length > 0);
  };
  const matchWithAi = async () => {
    if (!raw || cols.headers.length === 0) return;
    setAiBusy(true);
    const sendHeaders = cols.headers.slice(0, 40).map((h) => h.slice(0, 120));
    const grid = parseCsv(raw);
    const sampleRows = grid.slice(1, 4).map((row) =>
      Array.from({ length: sendHeaders.length }, (_, idx) => (row[idx] ?? "").trim().slice(0, 160))
    );
    const r = await runAiTaskAction("csv.match", {
      headers: sendHeaders,
      sampleRows,
    }) as { ok: true; data: { mapping: string[]; notes: string } } | { ok: false; error: string };
    setAiBusy(false);
    if (!r.ok) {
      toast("error", r.error);
      return;
    }
    const validKeys = new Set(IMPORT_FIELDS.map((f) => f.key));
    const seen = new Set<string>();
    const nextMap = cols.headers.map((_, i) => {
      const k = r.data.mapping[i] ?? "";
      if (!k || !validKeys.has(k) || seen.has(k)) return "";
      seen.add(k);
      return k;
    });
    setCols({ ...cols, map: nextMap });
    setParsed(mapEmployeeCsv(raw, nextMap));
    setMapOpen(true);
    toast("ok", r.data.notes || "Columns matched — review before importing.");
  };
  const template = () => {
    const url = URL.createObjectURL(new Blob([EMPLOYEE_CSV_TEMPLATE], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "onboardops-employee-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };
  const ready = parsed && parsed.rows.length > 0 && parsed.missingRequired.length === 0;

  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}><FileUp className="h-3.5 w-3.5" />Import CSV</button>
      <Modal open={open} onClose={() => { setOpen(false); reset(); }} title="Import employees from CSV">
        {result ? (
          <div className="space-y-3 text-[13px]">
            <p className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"><b>{result.created}</b> employee{result.created === 1 ? "" : "s"} imported. Required courses were assigned from their job roles.</p>
            {result.skipped.length > 0 && (
              <div><p className="mb-1 font-medium">{result.skipped.length} row{result.skipped.length === 1 ? "" : "s"} skipped</p>
                <div className="max-h-48 overflow-y-auto rounded-md border border-line">{result.skipped.map((s) => <div key={s.line} className="flex gap-2 border-b border-line px-2 py-1.5 text-xs last:border-0"><span className="mono w-12 shrink-0 text-soft">line {s.line}</span><span className="min-w-0 flex-1"><span className="mono">{s.email || "(no email)"}</span> · {s.reason}</span></div>)}</div></div>
            )}
            <button className="btn-primary w-full" onClick={() => { setOpen(false); reset(); router.refresh(); }}>Done</button>
          </div>
        ) : (
          <div className="space-y-3 text-[13px]">
            <p className="text-soft">Upload a CSV with a header row. Required columns: <b>Full name</b> and <b>Email</b>. Optional: Phone, Department, Job role, Hire date (YYYY-MM-DD), Emergency contact. Up to 500 rows.</p>
            <div className="flex flex-wrap items-center gap-2">
              <input ref={input} type="file" accept=".csv,text/csv" className="text-xs" onChange={(e) => onFile(e.target.files?.[0])} />
              <button className="btn" type="button" onClick={template}><Download className="h-3.5 w-3.5" />Template</button>
            </div>
            {parsed && cols.headers.length > 0 && (
              <details className="rounded-md border border-line p-2" open={mapOpen} onToggle={(e) => setMapOpen(e.currentTarget.open)}>
                <summary className="cursor-pointer text-xs font-medium">Match columns ({cols.headers.length} found)</summary>
                {aiCare ? (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-accent/30 bg-accent/5 px-2.5 py-2">
                    <span className="text-[11px] text-soft">Employee fields are redacted before AI matching. Review columns before importing.</span>
                    <button type="button" className="btn !h-7 !px-2.5 !text-xs" disabled={aiBusy || pending} onClick={matchWithAi}>
                      <Sparkles className="h-3.5 w-3.5 text-accent" />
                      {aiBusy ? "Matching…" : "Match columns with AI"}
                    </button>
                  </div>
                ) : (
                  <p className="mt-1.5 text-[11px] text-soft">AI column matching is locked while people-data AI is off.</p>
                )}
                <div className="mt-2 grid gap-2 sm:grid-cols-2">{cols.headers.map((h, i) => (
                  <label key={i} className="flex items-center gap-2 text-xs"><span className="w-32 truncate" title={h}>{h || `Column ${i + 1}`}</span>
                    <select className="input !h-8" value={cols.map[i] ?? ""} onChange={(e) => { const map = cols.map.slice(); map[i] = e.target.value; setCols({ ...cols, map }); setParsed(mapEmployeeCsv(raw, map)); }}>
                      <option value="">Ignore</option>{IMPORT_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select></label>
                ))}</div>
              </details>
            )}
            {parsed && (
              <div className="space-y-2">
                {parsed.missingRequired.length > 0 && <p className="rounded-md border border-rose-300 bg-rose-50 p-2 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">Missing required column(s): {parsed.missingRequired.join(", ")}.</p>}
                {parsed.unmapped.length > 0 && <p className="text-xs text-soft">Ignored columns: {parsed.unmapped.join(", ")}</p>}
                {parsed.rows.length > 0 && <>
                  <p className="text-xs text-soft">{fileName}: {parsed.rows.length} row{parsed.rows.length === 1 ? "" : "s"}. Preview of the first {Math.min(5, parsed.rows.length)}:</p>
                  <div className="overflow-x-auto rounded-md border border-line"><table className="w-full border-collapse text-xs"><thead><tr><th className="th !static">Name</th><th className="th !static">Email</th><th className="th !static">Department</th><th className="th !static">Job role</th></tr></thead>
                    <tbody>{parsed.rows.slice(0, 5).map((r, i) => <tr key={i}><td className="td !text-xs">{r.fullName}</td><td className="td !text-xs">{r.email}</td><td className="td !text-xs">{r.department}</td><td className="td !text-xs">{r.jobRole}</td></tr>)}</tbody></table></div>
                </>}
                <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5" checked={createMissing} onChange={(e) => setCreateMissing(e.target.checked)} />Create departments and job roles that do not exist yet (new job roles start with no required courses)</label>
                <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5" checked={sendWelcome} onChange={(e) => setSendWelcome(e.target.checked)} />Send each employee a welcome email</label>
                <button className="btn-primary w-full" disabled={!ready || pending} onClick={() => exec(() => importEmployeesAction({ rows: parsed.rows, createMissing, sendWelcome }), { onOk: (r) => setResult(r) })}>{pending ? "Importing…" : `Import ${parsed.rows.length} row${parsed.rows.length === 1 ? "" : "s"}`}</button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
