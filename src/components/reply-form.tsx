"use client";
import { useRef, useState } from "react";
import { CheckCircle2, Paperclip } from "lucide-react";
import { Field } from "@/components/ui";

const MAX_TOTAL = 4_200_000;

/** The form behind the Reply button in our emails. Files go with the message as one upload. */
export function ReplyForm({ token }: { token: string }) {
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [hp, setHp] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ref, setRef] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  function pick(list: FileList | null) {
    const next = Array.from(list ?? []).slice(0, 3);
    if (next.reduce((n, f) => n + f.size, 0) > MAX_TOTAL) { setError("Those files are too large. Keep the total under 4 MB."); setFiles([]); if (input.current) input.current.value = ""; return; }
    setError("");
    setFiles(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.set("token", token);
      fd.set("message", message);
      fd.set("name", name);
      fd.set("website", hp);
      files.forEach((f) => fd.append("files", f));
      const res = await fetch("/api/reply", { method: "POST", body: fd });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; ref?: string; error?: string };
      if (!res.ok || !j.ok) setError(j.error ?? "We couldn't send your reply. Please try again.");
      else setRef(j.ref ?? "");
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (ref !== null) {
    return (
      <div role="status" className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <p className="text-[15px] text-soft">Thank you, your reply was sent.{ref && <> Your reference is <span className="mono font-medium text-ink">{ref}</span>.</>} A person will answer by email, and we sent you a confirmation.</p>
      </div>
    );
  }
  return (
    <form className="space-y-4" onSubmit={submit}>
      <Field label="Your message"><textarea className="textarea" rows={8} required minLength={2} maxLength={5000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write your reply here." /></Field>
      <Field label="Your name (optional)"><input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name" /></Field>
      <div>
        <label className="btn inline-flex cursor-pointer items-center gap-1.5"><Paperclip className="h-3.5 w-3.5" />Attach files<input ref={input} type="file" className="sr-only" multiple accept="image/png,image/jpeg,image/gif,image/webp,application/pdf" onChange={(e) => pick(e.target.files)} /></label>
        <p className="mt-1.5 text-[12px] text-soft">Up to 3 images or PDFs, 4 MB in total.{files.length > 0 && <> Selected: {files.map((f) => f.name).join(", ")}</>}</p>
      </div>
      <input className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" name="website" value={hp} onChange={(e) => setHp(e.target.value)} />
      {error && <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-2.5 text-[13px] text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">{error}</p>}
      <button className="btn-primary" disabled={busy || message.trim().length < 2}>{busy ? "Sending…" : "Send reply"}</button>
      <p className="text-[12px] text-soft">We reply to the email address this message was sent to. See our <a className="text-accent underline" href="/legal/privacy">Privacy Policy</a>.</p>
    </form>
  );
}
