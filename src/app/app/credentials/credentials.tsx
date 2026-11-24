"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, BookOpen, Camera, ExternalLink, FileSearch, Sparkles, Trash2, Upload } from "lucide-react";
import { deleteCredentialAction, saveCredentialAction } from "@/actions/records";
import { uploadDocumentAction } from "@/actions/documents";
import { runAiTaskAction } from "@/actions/ai";
import { DOC_CATEGORIES } from "@/lib/constants";
import { Badge, Empty, Field, Modal, PageHeader, useAction, useToast } from "@/components/ui";
import { fmtDate } from "@/lib/utils";

type CredRow = { id: string; employee: string; name: string; number: string; issuer: string; expiresAt: string | null };

export type CredentialsMetrics = {
  total: number;
  expired: number;
  expiring30d: number;
  expiring90d: number;
  noExpiry: number;
  currentOver90d: number;
  topExpiringTypes: {
    name: string;
    expired: number;
    expiring30d: number;
    expiring31To90d: number;
    totalNeedingAttention: number;
  }[];
};

type CredentialScanResult = {
  name: string;
  number: string;
  issuer: string;
  issuedAt: string;
  expiresAt: string;
  holderName: string;
  suggestedEmployeeId: string;
  confidence: "high" | "medium" | "low";
  notes: string;
};

type DocumentMatchResult = {
  suggestedEmployeeId: string;
  suggestedTitle: string;
  category: string;
  holderNameFound: string;
  confidence: "high" | "medium" | "low";
  reason: string;
};

type ComplianceSummaryResult = {
  headline: string;
  summary: string;
  priorities: string[];
};

type RegulationExplainResult = {
  plainSummary: string;
  keyRequirements: string[];
  practicalSteps: string[];
  disclaimer: string;
};

type DocCategory = (typeof DOC_CATEGORIES)[number];

const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const UPLOADABLE_EXTS = new Set(["png", "jpg", "jpeg", "webp", "txt"]);
const MAX_DOC_BYTES = 4 * 1024 * 1024;
const REG_EXAMPLES = [
  "OSHA forklift recertification",
  "ServSafe food handler",
  "DOT medical card",
  "Alcohol server permit",
];

function shrinkImageToJpegDataUrl(file: File, maxDim = 1280, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!IMAGE_MIMES.has(file.type)) {
      reject(new Error("Choose a JPEG, PNG, or WebP image."));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
        const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
        const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not prepare image for scanning."));
          return;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        let dataUrl = canvas.toDataURL("image/jpeg", quality);
        if (dataUrl.length > 2_400_000) {
          dataUrl = canvas.toDataURL("image/jpeg", 0.65);
        }
        resolve(dataUrl);
      } catch {
        reject(new Error("Could not process image."));
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image file."));
    };
    img.src = url;
  });
}

function mapDocCategory(raw: string): DocCategory {
  const s = raw.toLowerCase();
  if (s.includes("i-9") || s.includes("work auth")) return "Work authorization (I-9)";
  if (s.includes("driver")) return "Driver's license";
  if (s.includes("license")) return "Professional license";
  if (s.includes("cert") || s.includes("training")) return "Training certificate";
  if (s.includes("sign") || s.includes("policy") || s.includes("form") || s.includes("hr") || s.includes("tax")) return "Signed form";
  return "Other";
}

function confidenceStyle(c: "high" | "medium" | "low") {
  if (c === "high") return "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
  if (c === "low") return "border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300";
  return "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300";
}

const EMPTY_FORM = { employeeId: "", name: "", number: "", issuer: "", issuedAt: "", expiresAt: "", notes: "" };

export function Credentials({
  rows,
  employees,
  ai = false,
  aiCare = false,
  canMatchDocs = true,
  canUploadDocs = false,
  metrics,
}: {
  rows: CredRow[];
  employees: { id: string; label: string }[];
  ai?: boolean;
  aiCare?: boolean;
  canMatchDocs?: boolean;
  canUploadDocs?: boolean;
  metrics: CredentialsMetrics;
}) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();

  // Add credential modal + Vision OCR scanner state
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY_FORM);
  const [scanResult, setScanResult] = useState<CredentialScanResult | null>(null);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [scanPrepping, setScanPrepping] = useState(false);
  const scanInputRef = useRef<HTMLInputElement | null>(null);

  // Match scanned form modal state
  const [matchOpen, setMatchOpen] = useState(false);
  const [matchFile, setMatchFile] = useState<File | null>(null);
  const [matchPreview, setMatchPreview] = useState<string | null>(null);
  const [matchPrepping, setMatchPrepping] = useState(false);
  const [matchResult, setMatchResult] = useState<DocumentMatchResult | null>(null);
  const [matchEmpId, setMatchEmpId] = useState("");
  const [matchTitle, setMatchTitle] = useState("");
  const [matchCategory, setMatchCategory] = useState<DocCategory>("Signed form");
  const [matchVisible, setMatchVisible] = useState(true);
  const matchInputRef = useRef<HTMLInputElement | null>(null);

  // Plain-language compliance summary state
  const [summary, setSummary] = useState<ComplianceSummaryResult | null>(null);

  // Explain a regulation modal state
  const [regOpen, setRegOpen] = useState(false);
  const [regTopic, setRegTopic] = useState("");
  const [regIndustry, setRegIndustry] = useState("");
  const [regResult, setRegResult] = useState<RegulationExplainResult | null>(null);

  const [busyTask, setBusyTask] = useState<"scan" | "match" | "summary" | "explain" | "save_doc" | null>(null);

  const closeAddModal = () => {
    setOpen(false);
    setScanResult(null);
    setScanPreview(null);
  };

  const resetMatchModal = () => {
    setMatchOpen(false);
    setMatchFile(null);
    setMatchPreview(null);
    setMatchResult(null);
    setMatchEmpId("");
    setMatchTitle("");
    setMatchCategory("Signed form");
    setMatchVisible(true);
  };

  const handleScanPhoto = async (file: File) => {
    setScanPrepping(true);
    try {
      const dataUrl = await shrinkImageToJpegDataUrl(file, 1280, 0.82);
      setScanPreview(dataUrl);
      setBusyTask("scan");
      exec(
        () =>
          runAiTaskAction("credential.scan", {
            image: dataUrl,
            employees,
          }) as Promise<{ ok: true; data: CredentialScanResult } | { ok: false; error: string }>,
        {
          onOk: (res) => {
            setScanResult(res);
            const matched = res.suggestedEmployeeId && employees.some((e) => e.id === res.suggestedEmployeeId);
            setF((prev) => ({
              ...prev,
              name: res.name || prev.name,
              number: res.number || prev.number,
              issuer: res.issuer || prev.issuer,
              issuedAt: res.issuedAt || prev.issuedAt,
              expiresAt: res.expiresAt || prev.expiresAt,
              employeeId: matched ? res.suggestedEmployeeId : prev.employeeId,
            }));
            toast("ok", "Photo scanned — review every field before saving.");
          },
        }
      );
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Could not read photo.");
    } finally {
      setScanPrepping(false);
    }
  };

  const handleMatchFile = async (file: File) => {
    if (employees.length === 0) {
      toast("error", "Add at least one employee before matching scanned forms.");
      return;
    }
    setMatchPrepping(true);
    setMatchResult(null);
    setMatchFile(file);
    setMatchPreview(null);
    try {
      const isImage = IMAGE_MIMES.has(file.type);
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const isText = ext === "txt" || ext === "csv" || file.type.startsWith("text/");
      if (!isImage && !isText) {
        toast("error", "Upload a JPEG, PNG, WebP image, or a .txt / .csv form.");
        setMatchFile(null);
        return;
      }

      let payload: { image?: string; fileName: string; textSnippet?: string; employees: { id: string; label: string }[] };
      if (isImage) {
        const dataUrl = await shrinkImageToJpegDataUrl(file, 1280, 0.82);
        setMatchPreview(dataUrl);
        payload = { image: dataUrl, fileName: file.name, employees };
      } else {
        const text = (await file.text()).trim();
        if (!text) {
          toast("error", "That text file is empty.");
          setMatchFile(null);
          return;
        }
        payload = { fileName: file.name, textSnippet: text.slice(0, 3800), employees };
      }

      setBusyTask("match");
      exec(
        () =>
          runAiTaskAction("document.match", payload) as Promise<{ ok: true; data: DocumentMatchResult } | { ok: false; error: string }>,
        {
          onOk: (res) => {
            setMatchResult(res);
            const validEmp = res.suggestedEmployeeId && employees.some((e) => e.id === res.suggestedEmployeeId);
            setMatchEmpId(validEmp ? res.suggestedEmployeeId : "");
            setMatchTitle(res.suggestedTitle || file.name.replace(/\.[^.]+$/, ""));
            setMatchCategory(mapDocCategory(res.category));
            toast("ok", "Match suggestion ready — review before taking action.");
          },
        }
      );
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Could not process file.");
    } finally {
      setMatchPrepping(false);
    }
  };

  const runSummary = () => {
    setBusyTask("summary");
    exec(
      () =>
        runAiTaskAction("compliance.summary", {
          scope: "credentials",
          metrics: {
            ...metrics,
            bucketDefinitions: "expired = past expiry date; expiring30d = due within next 30 days; expiring90d = due in 31 to 90 days; currentOver90d = valid more than 90 days; noExpiry = no expiry date recorded",
          },
        }) as Promise<{ ok: true; data: ComplianceSummaryResult } | { ok: false; error: string }>,
      {
        onOk: (res) => {
          setSummary(res);
          toast("ok", "Plain-language summary ready.");
        },
      }
    );
  };

  const runRegExplain = (topicOverride?: string) => {
    const topic = (topicOverride ?? regTopic).trim();
    if (topic.length < 3) {
      toast("error", "Enter a regulation, license, or safety rule.");
      return;
    }
    if (topicOverride !== undefined) setRegTopic(topicOverride);
    setBusyTask("explain");
    exec(
      () =>
        runAiTaskAction("regulation.explain", {
          topic,
          industry: regIndustry.trim() || undefined,
        }) as Promise<{ ok: true; data: RegulationExplainResult } | { ok: false; error: string }>,
      {
        onOk: (res) => {
          setRegResult(res);
        },
      }
    );
  };

  const canSaveMatchedFile = (() => {
    if (!canUploadDocs || !matchFile) return false;
    const ext = matchFile.name.split(".").pop()?.toLowerCase() ?? "";
    return UPLOADABLE_EXTS.has(ext) && matchFile.size > 0 && matchFile.size <= MAX_DOC_BYTES;
  })();

  const saveMatchedDocument = () => {
    if (!matchFile || !matchEmpId || matchTitle.trim().length < 2) return;
    const fd = new FormData();
    fd.set(
      "json",
      JSON.stringify({
        employeeId: matchEmpId,
        title: matchTitle.trim(),
        category: matchCategory,
        restricted: false,
        visibleToEmployee: matchVisible,
        expiresAt: "",
      })
    );
    fd.set("file", matchFile);
    setBusyTask("save_doc");
    exec(() => uploadDocumentAction(fd), {
      success: "Saved to employee's documents",
      onOk: () => {
        resetMatchModal();
        router.refresh();
      },
    });
  };

  const prefillCredentialFromMatch = () => {
    const empId = matchEmpId;
    const title = matchTitle.trim();
    resetMatchModal();
    setScanResult(null);
    setScanPreview(null);
    setF({
      ...EMPTY_FORM,
      employeeId: empId,
      name: title,
    });
    setOpen(true);
    toast("ok", "Pre-filled Add credential — review details before saving.");
  };

  const matchedEmployeeLabel = employees.find((e) => e.id === matchResult?.suggestedEmployeeId)?.label ?? null;

  return (
    <>
      <PageHeader title="Credentials" sub="Licenses and certifications across all staff, sorted by expiry.">
        {ai && (
          <button type="button" className="btn" onClick={() => setRegOpen(true)}>
            <BookOpen className="h-3.5 w-3.5 text-accent" />
            Explain a regulation
          </button>
        )}
        {aiCare && canMatchDocs && (
          <button type="button" className="btn" onClick={() => setMatchOpen(true)}>
            <FileSearch className="h-3.5 w-3.5 text-accent" />
            Match scanned form
          </button>
        )}
        <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
          Add credential
        </button>
      </PageHeader>

      {ai && rows.length > 0 && (
        <div className="card mb-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium text-ink">Status overview:</span>
              <span className="mono rounded border border-line bg-muted px-2 py-0.5 text-soft">{metrics.total} total</span>
              <span className={`mono rounded border px-2 py-0.5 ${metrics.expired > 0 ? "border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300" : "border-line bg-muted text-soft"}`}>
                {metrics.expired} expired
              </span>
              <span className={`mono rounded border px-2 py-0.5 ${metrics.expiring30d > 0 ? "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300" : "border-line bg-muted text-soft"}`}>
                {metrics.expiring30d} due ≤30d
              </span>
              <span className="mono rounded border border-line bg-muted px-2 py-0.5 text-soft">
                {metrics.expiring90d} due 31–90d
              </span>
              {metrics.noExpiry > 0 && (
                <span className="mono rounded border border-line bg-muted px-2 py-0.5 text-soft">
                  {metrics.noExpiry} no expiry
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {summary && (
                <button type="button" className="text-xs text-soft underline" onClick={() => setSummary(null)}>
                  Hide
                </button>
              )}
              <button
                type="button"
                className="btn !h-7 !text-xs"
                disabled={pending}
                onClick={runSummary}
              >
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                {pending && busyTask === "summary" ? "Summarizing…" : summary ? "Refresh AI summary" : "Summarize expiring credentials"}
              </button>
            </div>
          </div>

          {summary && (
            <div className="anim-slide-down mt-3 space-y-2.5 rounded-lg border border-accent/30 bg-accent/5 p-3.5 text-[13px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-ink">{summary.headline}</div>
                <span className="text-[11px] text-soft">Numbers computed directly from your database; AI only writes the summary.</span>
              </div>
              <p className="whitespace-pre-wrap leading-relaxed text-soft">{summary.summary}</p>
              {summary.priorities.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-ink">Prioritized next steps</div>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-soft">
                    {summary.priorities.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <Empty title="No credentials yet" hint="Click 'Add credential' to track staff licenses and expiry dates." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse">
            <thead>
              <tr>
                {["Employee", "Credential", "Number", "Issuer", "Expires", ""].map((h) => (
                  <th key={h} className="th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const soon = c.expiresAt && new Date(c.expiresAt).getTime() < Date.now() + 30 * 86400000;
                return (
                  <tr key={c.id} className="hover:bg-muted">
                    <td className="td font-medium">{c.employee}</td>
                    <td className="td">{c.name}</td>
                    <td className="td mono">{c.number || "—"}</td>
                    <td className="td">{c.issuer || "—"}</td>
                    <td className="td mono">
                      {c.expiresAt ? (
                        soon ? <Badge value="RETRAINING_REQUIRED" label={`Expires ${fmtDate(c.expiresAt)}`} /> : fmtDate(c.expiresAt)
                      ) : (
                        "No expiry"
                      )}
                    </td>
                    <td className="td text-right">
                      <button
                        className="btn !px-2"
                        aria-label="Delete credential"
                        disabled={pending}
                        onClick={() => exec(() => deleteCredentialAction(c.id), { success: "Credential removed", onOk: () => router.refresh() })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Credential Modal (with Vision OCR Photo Scanner when aiCare) */}
      <Modal open={open} onClose={closeAddModal} title="Add credential or license">
        <div className="space-y-3">
          {aiCare && (
            <div className="rounded-lg border border-dashed border-accent/50 bg-accent/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
                    <Camera className="h-3.5 w-3.5 text-accent" />
                    Scan photo with AI (OCR)
                  </div>
                  <p className="mt-0.5 text-[11px] text-soft">
                    Take or choose a photo of a license or certificate to auto-fill fields below.
                  </p>
                </div>
                <input
                  ref={scanInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void handleScanPhoto(file);
                  }}
                />
                <button
                  type="button"
                  className="btn !h-7 !text-xs"
                  disabled={scanPrepping || (pending && busyTask === "scan")}
                  onClick={() => scanInputRef.current?.click()}
                >
                  <Camera className="h-3.5 w-3.5 text-accent" />
                  {scanPrepping ? "Preparing photo…" : pending && busyTask === "scan" ? "Scanning photo…" : scanResult ? "Scan another" : "Scan photo"}
                </button>
              </div>

              {scanResult && (
                <div className="mt-2.5 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                  <div className="flex items-start gap-2.5">
                    {scanPreview && (
                      <img
                        src={scanPreview}
                        alt="Scanned credential preview"
                        className="h-12 w-12 shrink-0 rounded border border-amber-300/80 object-cover dark:border-amber-800"
                      />
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          Review AI scan before saving
                        </span>
                        <span className={`badge mono uppercase ${confidenceStyle(scanResult.confidence)}`}>
                          {scanResult.confidence} confidence
                        </span>
                      </div>
                      {scanResult.holderName && (
                        <div className="text-[11px]">
                          Holder name read: <span className="font-medium">{scanResult.holderName}</span>
                          {!scanResult.suggestedEmployeeId && " (select employee below)"}
                        </div>
                      )}
                      {scanResult.notes && <p className="text-[11px] opacity-90">{scanResult.notes}</p>}
                      <p className="text-[11px] opacity-80">
                        Check license number, issuer, and dates carefully before clicking Save credential.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <Field label="Employee">
            <select className="input" value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })}>
              <option value="">Select employee…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Credential / license name">
            <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Forklift Operator License" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="License number (optional)">
              <input className="input mono" value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} />
            </Field>
            <Field label="Issuer (optional)">
              <input className="input" value={f.issuer} onChange={(e) => setF({ ...f, issuer: e.target.value })} placeholder="OSHA / State Board" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Issued date (optional)">
              <input className="input mono" type="date" value={f.issuedAt} onChange={(e) => setF({ ...f, issuedAt: e.target.value })} />
            </Field>
            <Field label="Expires date (optional)">
              <input className="input mono" type="date" value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} />
            </Field>
          </div>
          <button
            type="button"
            className="btn-primary w-full"
            disabled={pending || !f.employeeId || !f.name.trim()}
            onClick={() =>
              exec(() => saveCredentialAction(f), {
                success: "Credential saved",
                onOk: () => {
                  closeAddModal();
                  setF(EMPTY_FORM);
                  router.refresh();
                },
              })
            }
          >
            Save credential
          </button>
        </div>
      </Modal>

      {/* Match Scanned Form to Employee Modal (when aiCare && canMatchDocs) */}
      <Modal open={matchOpen} onClose={resetMatchModal} title="Match scanned form to employee">
        <div className="space-y-3 text-[13px]">
          <p className="text-xs text-soft">
            Upload a scanned photo (JPEG, PNG, WebP) or a text/CSV form. AI identifies which employee it belongs to and suggests a clean title and category for your review.
          </p>

          <div className="rounded-lg border border-dashed border-line bg-muted/50 p-3.5 text-center">
            <input
              ref={matchInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,.txt,.csv,text/plain,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void handleMatchFile(file);
              }}
            />
            <button
              type="button"
              className="btn"
              disabled={matchPrepping || (pending && busyTask === "match") || employees.length === 0}
              onClick={() => matchInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5 text-accent" />
              {matchPrepping ? "Preparing file…" : pending && busyTask === "match" ? "Matching with AI…" : matchFile ? "Choose another file" : "Choose scanned form or photo"}
            </button>
            {matchFile && (
              <div className="mono mt-2 truncate text-[11px] text-soft">
                Selected: {matchFile.name}
              </div>
            )}
            {employees.length === 0 && (
              <div className="mt-2 text-[11px] text-rose-600">Add employees first before matching forms.</div>
            )}
          </div>

          {matchResult && (
            <div className="anim-slide-down space-y-3 rounded-lg border border-accent/40 bg-accent/5 p-3.5">
              <div className="flex items-start gap-3">
                {matchPreview && (
                  <img
                    src={matchPreview}
                    alt="Scanned form preview"
                    className="h-14 w-14 shrink-0 rounded border border-line object-cover"
                  />
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
                      <Sparkles className="h-3.5 w-3.5 text-accent" />
                      AI match suggestion
                    </span>
                    <span className={`badge mono uppercase ${confidenceStyle(matchResult.confidence)}`}>
                      {matchResult.confidence} confidence
                    </span>
                  </div>
                  <div className="text-xs text-ink">
                    Matched employee:{" "}
                    <span className="font-medium">
                      {matchedEmployeeLabel ?? "No confident match — select manually below"}
                    </span>
                  </div>
                  {matchResult.holderNameFound && (
                    <div className="text-[11px] text-soft">
                      Name found on form: <span className="font-medium text-ink">{matchResult.holderNameFound}</span>
                    </div>
                  )}
                  <div className="text-[11px] text-soft">
                    Suggested category: <span className="font-medium text-ink">{matchResult.category}</span>
                  </div>
                  {matchResult.reason && <p className="text-[11px] text-soft">{matchResult.reason}</p>}
                </div>
              </div>

              <div className="space-y-2.5 border-t border-line pt-3">
                <Field label="Confirm employee">
                  <select className="input" value={matchEmpId} onChange={(e) => setMatchEmpId(e.target.value)}>
                    <option value="">Select employee…</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>{e.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Document / credential title">
                  <input className="input" value={matchTitle} onChange={(e) => setMatchTitle(e.target.value)} placeholder="Signed Forklift Certification" />
                </Field>
                {canSaveMatchedFile && (
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <Field label="Document category">
                      <select className="input" value={matchCategory} onChange={(e) => setMatchCategory(e.target.value as DocCategory)}>
                        {DOC_CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </Field>
                    <label className="flex items-end gap-2 pb-1.5 text-xs text-soft">
                      <input
                        type="checkbox"
                        checked={matchVisible}
                        onChange={(e) => setMatchVisible(e.target.checked)}
                      />
                      Visible to employee in portal
                    </label>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {canSaveMatchedFile && (
                  <button
                    type="button"
                    className="btn-primary flex-1"
                    disabled={pending || !matchEmpId || matchTitle.trim().length < 2}
                    onClick={saveMatchedDocument}
                  >
                    {pending && busyTask === "save_doc" ? "Uploading…" : "Save to employee documents"}
                  </button>
                )}
                <button
                  type="button"
                  className={canSaveMatchedFile ? "btn" : "btn-primary flex-1"}
                  disabled={!matchEmpId && !matchTitle.trim()}
                  onClick={prefillCredentialFromMatch}
                >
                  Pre-fill Add credential
                </button>
                {matchEmpId && (
                  <Link href={`/app/employee/${matchEmpId}`} className="btn" onClick={resetMatchModal}>
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open dossier
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Explain a Regulation Modal (when ai) */}
      <Modal open={regOpen} onClose={() => setRegOpen(false)} title="Explain a workplace regulation">
        <div className="space-y-3 text-[13px]">
          <p className="text-xs text-soft">
            Get a plain-English overview of any safety standard, license renewal rule, or compliance topic.
          </p>
          <Field label="Rule, license, or regulation">
            <input
              className="input"
              value={regTopic}
              onChange={(e) => setRegTopic(e.target.value)}
              placeholder="e.g. OSHA forklift recertification, ServSafe food handler, DOT medical card"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runRegExplain();
                }
              }}
            />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {REG_EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                className="rounded-full border border-line bg-muted px-2.5 py-0.5 text-[11px] text-soft hover:text-ink"
                disabled={pending}
                onClick={() => runRegExplain(ex)}
              >
                {ex}
              </button>
            ))}
          </div>
          <Field label="Industry / team type (optional)">
            <input
              className="input"
              value={regIndustry}
              onChange={(e) => setRegIndustry(e.target.value)}
              placeholder="e.g. Warehouse, Restaurant, Cafe, Retail"
            />
          </Field>
          <button
            type="button"
            className="btn-primary w-full"
            disabled={pending || regTopic.trim().length < 3}
            onClick={() => runRegExplain()}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {pending && busyTask === "explain" ? "Explaining…" : "Explain in plain English"}
          </button>

          {regResult && (
            <div className="anim-slide-down space-y-3 border-t border-line pt-3">
              <div className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                <div className="inline-flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Not legal advice
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed">
                  {regResult.disclaimer || "General educational information only — not legal advice. Verify local, state, and federal rules with a qualified advisor."}
                </p>
              </div>
              <div>
                <div className="text-xs font-semibold text-ink">Plain-English summary</div>
                <p className="mt-1 whitespace-pre-wrap leading-relaxed text-soft">{regResult.plainSummary}</p>
              </div>
              {regResult.keyRequirements.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-ink">Key requirements</div>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-soft">
                    {regResult.keyRequirements.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {regResult.practicalSteps.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-ink">Practical steps for your team</div>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-soft">
                    {regResult.practicalSteps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
