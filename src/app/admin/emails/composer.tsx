"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BadgeCheck, BookOpen, CalendarDays, CheckCircle2, Clock, Eye, KeyRound, Loader2, Lock, MessageSquare, PartyPopper, PenLine, RefreshCw, Search, Send, Shield, Sparkles, Trash2, Unlock, UserPlus, UsersRound } from "lucide-react";
import { audienceCountAction, deleteEmailTemplateAction, generateEmailDraftAction, previewEmailAction, saveEmailTemplateAction, sendEmailCampaignAction } from "@/actions/admin-email";
import { Field, Modal, useToast } from "@/components/ui";
import { MAIL_LIBRARY } from "@/lib/email-library";
import { CATEGORIES, ICONS, OPTIONAL_CATEGORIES, findVars, type MailIcon } from "@/lib/email-markup";
import { cn, fmtDateTime } from "@/lib/utils";

export type CustomTpl = { id: string; title: string; cat: string; desc: string; subject: string; body: string; icon: string; buttonText: string; buttonUrl: string };
export type HistoryRow = { id: string; at: string; audience: string; target: string; subject: string; total: number; delivered: number; failed: number; skipped: number; status: string; by: string };

type Item = { id: string; cat: string; title: string; desc: string; subject: string; body: string; icon: string; buttonText: string; buttonUrl: string; custom: boolean };
type Audience = "TEST" | "SINGLE" | "OWNERS" | "ALL";

const ICON_VIEW: Record<MailIcon, React.ComponentType<{ className?: string }>> = {
  shield: Shield, alert: AlertTriangle, key: KeyRound, lock: Lock, unlock: Unlock, eye: Eye, pen: PenLine, chat: MessageSquare, calendar: CalendarDays,
  clock: Clock, book: BookOpen, team: UsersRound, welcome: PartyPopper, invite: UserPlus, seal: BadgeCheck, verify: CheckCircle2, magic: Sparkles,
};

const BUILTIN: Item[] = MAIL_LIBRARY.map((t) => ({ id: t.id, cat: t.cat, title: t.title, desc: t.desc, subject: t.subject, body: t.body, icon: t.icon, buttonText: t.button?.[0] ?? "", buttonUrl: t.button?.[1] ?? "", custom: false }));
const BLANK = { subject: "", body: "", icon: "chat" as MailIcon, buttonText: "", buttonUrl: "", optional: false, category: "" };

const AUD: { id: Audience; title: string; hint: string; owner?: boolean }[] = [
  { id: "TEST", title: "Test to me", hint: "One copy to your own address." },
  { id: "SINGLE", title: "Single recipient", hint: "Any email address, registered or not." },
  { id: "OWNERS", title: "Workspace owners", hint: "Everyone who owns a workspace.", owner: true },
  { id: "ALL", title: "All registered users", hint: "Every account on OnboardOps.", owner: true },
];

export function Composer({ ai, isOwner, myEmail, custom, history }: { ai: boolean; isOwner: boolean; myEmail: string; custom: CustomTpl[]; history: HistoryRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [form, setForm] = useState(BLANK);
  const [vars, setVars] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState<string | null>(null);
  const [tab, setTab] = useState<"compose" | "preview">("compose");
  const [preview, setPreview] = useState<{ html: string; missing: string[]; badUrl: boolean } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [aud, setAud] = useState<Audience>("TEST");
  const [to, setTo] = useState("");
  const [greet, setGreet] = useState("");
  const [confirm, setConfirm] = useState("");
  const [count, setCount] = useState<{ count: number; tooMany: boolean } | null>(null);
  const [sending, setSending] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const items: Item[] = useMemo(() => [...custom.map((c) => ({ ...c, custom: true })), ...BUILTIN], [custom]);
  const cats = useMemo(() => ["All", ...(custom.length ? ["Custom"] : []), ...CATEGORIES], [custom.length]);
  const counts = useMemo(() => { const m: Record<string, number> = { All: items.length }; for (const i of items) m[i.cat] = (m[i.cat] ?? 0) + 1; return m; }, [items]);
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return items.filter((i) => (cat === "All" || i.cat === cat) && (!n || `${i.title} ${i.desc} ${i.cat} ${i.subject}`.toLowerCase().includes(n)));
  }, [items, q, cat]);

  const fields = useMemo(() => findVars(form.subject, form.body, form.buttonText, form.buttonUrl), [form.subject, form.body, form.buttonText, form.buttonUrl]);
  const missing = fields.filter((f) => !(vars[f] ?? "").trim());

  function load(i: Item) {
    setForm({ subject: i.subject, body: i.body, icon: (ICONS as readonly string[]).includes(i.icon) ? (i.icon as MailIcon) : "chat", buttonText: i.buttonText, buttonUrl: i.buttonUrl, optional: OPTIONAL_CATEGORIES.includes(i.cat), category: i.cat });
    setVars({});
    setLoaded(i.title);
    setTab("compose");
    editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Live preview, a moment after you stop typing.
  useEffect(() => {
    if (tab !== "preview" || form.subject.trim().length < 2 || form.body.trim().length < 10) { if (tab === "preview") setPreview(null); return; }
    setPreviewing(true);
    const t = setTimeout(async () => {
      const r = await previewEmailAction({ ...form, vars });
      if (r.ok) setPreview({ html: r.data.html, missing: r.data.missing, badUrl: r.data.badUrl });
      else toast("error", r.error);
      setPreviewing(false);
    }, 450);
    return () => clearTimeout(t);
  }, [tab, form, vars, toast]);

  useEffect(() => {
    setConfirm("");
    setCount(null);
    if (aud === "OWNERS" || aud === "ALL") void audienceCountAction(aud).then((r) => r.ok && setCount(r.data));
  }, [aud]);

  const broadcast = aud === "OWNERS" || aud === "ALL";
  const ready = form.subject.trim().length >= 2 && form.body.trim().length >= 10 && missing.length === 0
    && (aud !== "SINGLE" || /.+@.+\..+/.test(to))
    && (!broadcast || (confirm === "SEND" && !!count && count.count > 0 && !count.tooMany));

  async function send(testOverride = false) {
    const audience = testOverride ? "TEST" : aud;
    if (audience === "OWNERS" || audience === "ALL") {
      if (!window.confirm(`Send "${form.subject}" to ${count?.count ?? "?"} ${audience === "ALL" ? "registered users" : "workspace owners"}? This can't be undone.`)) return;
    }
    setSending(true);
    try {
      const r = await sendEmailCampaignAction({ ...form, vars, audience, to: aud === "SINGLE" ? to : undefined, greetingName: greet || undefined, templateId: loaded ?? undefined, confirm, expectedCount: count?.count });
      if (r.ok) {
        const { delivered, failed, skipped } = r.data;
        toast(failed ? "error" : "ok", `${delivered} sent${failed ? `, ${failed} failed` : ""}${skipped ? `, ${skipped} opted out` : ""}.`);
        setConfirm("");
        router.refresh();
      } else toast("error", r.error);
    } finally {
      setSending(false);
    }
  }

  async function generate() {
    setAiBusy(true);
    try {
      const r = await generateEmailDraftAction({ prompt: aiPrompt, category: form.category });
      if (r.ok) {
        setForm({ ...form, subject: r.data.subject, body: r.data.body, icon: r.data.icon, buttonText: r.data.buttonText, buttonUrl: r.data.buttonText ? "{{action_url}}" : "", optional: r.data.optional });
        setVars({});
        setLoaded("AI draft");
        setAiOpen(false);
        setTab("compose");
        toast("ok", "Draft loaded. Read it and edit before sending.");
      } else toast("error", r.error);
    } finally {
      setAiBusy(false);
    }
  }

  async function saveTemplate() {
    const title = window.prompt("Name this template");
    if (!title) return;
    const r = await saveEmailTemplateAction({ title, category: "Custom", subject: form.subject, body: form.body, icon: form.icon, buttonText: form.buttonText, buttonUrl: form.buttonUrl });
    if (r.ok) { toast("ok", "Template saved"); router.refresh(); } else toast("error", r.error);
  }

  return (
    <div className="space-y-5">
      <section className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-soft" />
            <input className="input !pl-8" placeholder="Search templates by title, subject or tag" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search templates" />
          </div>
          <span className="mono text-xs text-soft">{shown.length} of {items.length} templates</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {cats.map((c) => (
            <button key={c} type="button" onClick={() => setCat(c)} className={cn("rounded-full border px-3 py-1 text-[12px]", cat === c ? "border-accent bg-accent/10 font-medium text-accent" : "border-line text-soft hover:text-ink")}>
              {c} <span className="tabular-nums opacity-70">{counts[c] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 grid max-h-[380px] gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
          {shown.length === 0 && <p className="col-span-full py-6 text-center text-[13px] text-soft">No templates match.</p>}
          {shown.map((i) => {
            const Icon = ICON_VIEW[(ICONS as readonly string[]).includes(i.icon) ? (i.icon as MailIcon) : "chat"];
            return (
              <div key={i.id} className="flex flex-col rounded-xl border border-line bg-surface p-3 transition hover:border-accent/50">
                <div className="flex items-start gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent"><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold">{i.title}</div>
                    <p className="line-clamp-2 text-[12px] text-soft">{i.desc}</p>
                  </div>
                  {i.custom && <button type="button" aria-label={`Delete ${i.title}`} className="text-soft hover:text-rose-600" onClick={async () => { if (window.confirm(`Delete the template "${i.title}"?`)) { const r = await deleteEmailTemplateAction(i.id); if (r.ok) router.refresh(); else toast("error", r.error); } }}><Trash2 className="h-3.5 w-3.5" /></button>}
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <span className="mono truncate text-[10.5px] uppercase text-soft">{i.cat}</span>
                  <button type="button" className="btn !h-7 !text-xs" onClick={() => load(i)}>Load into editor</button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div ref={editorRef} className="grid scroll-mt-4 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex rounded-lg border border-line bg-surface p-0.5">
              {(["compose", "preview"] as const).map((t) => <button key={t} type="button" onClick={() => setTab(t)} className={cn("rounded-md px-3 py-1 text-[12.5px] font-medium", tab === t ? "bg-accent text-accent-fg" : "text-soft hover:text-ink")}>{t === "compose" ? "Compose" : "Live preview"}</button>)}
            </div>
            <button type="button" className="btn-primary" disabled={!ai} onClick={() => setAiOpen(true)} title={ai ? "" : "AI is not set up on this server"}><Sparkles className="h-3.5 w-3.5" />Generate with AI</button>
          </div>

          {tab === "compose" ? (
            <div className="space-y-3">
              <Field label="Subject"><input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} maxLength={200} placeholder="Security notice: …" /></Field>
              <Field label="Body (plain text, blank line between paragraphs)"><textarea className="textarea mono !text-[13px]" rows={16} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder={"Hi {{name}},\n\nWrite your message here."} /></Field>
              <button type="button" className="text-[12px] text-soft underline underline-offset-2" onClick={() => setHelp((v) => !v)}>{help ? "Hide" : "Show"} formatting help</button>
              {help && (
                <pre className="overflow-x-auto rounded-lg border border-line bg-muted p-3 text-[12px] leading-relaxed">{`## A heading
- A bullet point
1. A numbered step
> A blue note      >! A warning      >!! An alert      >+ Good news
[details]
Label: value
Another label: another value

{{name}} is the person's first name. Anything else in {{double braces}} becomes a field below.
{{app_url}} {{login_url}} {{status_url}} {{support_url}} {{security_url}} are filled in for you.`}</pre>
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Header icon">
                  <select className="input" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value as MailIcon })}>{ICONS.map((i) => <option key={i} value={i}>{i}</option>)}</select>
                </Field>
                <Field label="Button text"><input className="input" value={form.buttonText} onChange={(e) => setForm({ ...form, buttonText: e.target.value })} maxLength={60} placeholder="Leave blank for no button" /></Field>
                <Field label="Button address (https)"><input className="input" value={form.buttonUrl} onChange={(e) => setForm({ ...form, buttonUrl: e.target.value })} maxLength={500} placeholder="{{action_url}} or https://…" /></Field>
              </div>
              <label className="flex items-start gap-2 text-[12.5px]"><input type="checkbox" className="mt-0.5" checked={form.optional} onChange={(e) => setForm({ ...form, optional: e.target.checked })} /><span><strong>Product news.</strong> People can turn these off in their notification settings. Leave unticked for security, legal, outage, account, billing and compliance notices, which everyone gets.</span></label>
              {fields.length > 0 && (
                <div className="rounded-xl border border-line bg-muted/50 p-3">
                  <div className="mb-2 text-xs font-semibold">Fill in the blanks <span className="font-normal text-soft">({missing.length} left)</span></div>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {fields.map((f) => (
                      <label key={f} className="block">
                        <span className="mono text-[11px] text-soft">{`{{${f}}}`}</span>
                        <input className={cn("input", !(vars[f] ?? "").trim() && "!border-amber-400")} value={vars[f] ?? ""} onChange={(e) => setVars({ ...vars, [f]: e.target.value })} placeholder={f.replace(/_/g, " ")} />
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-soft">
                <span>{loaded ? `Loaded: ${loaded}` : "Start from a template above, or write your own."}</span>
                <span className="flex gap-2">
                  <button type="button" className="btn !h-8" disabled={form.subject.trim().length < 2 || form.body.trim().length < 10} onClick={() => void saveTemplate()}>Save as template</button>
                  <button type="button" className="btn !h-8" onClick={() => { setForm(BLANK); setVars({}); setLoaded(null); setPreview(null); }}>Clear composer</button>
                </span>
              </div>
            </div>
          ) : (
            <div>
              {previewing && !preview && <p className="flex items-center gap-2 py-10 text-[13px] text-soft"><Loader2 className="h-4 w-4 animate-spin" />Building the preview…</p>}
              {!preview && !previewing && <p className="py-10 text-center text-[13px] text-soft">Write a subject and a message to see the finished email.</p>}
              {preview && (
                <div className="space-y-2">
                  {preview.missing.length > 0 && <p className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">Still to fill in: {preview.missing.map((m) => `{{${m}}}`).join(", ")}. Go back to Compose and complete them.</p>}
                  {preview.badUrl && <p className="rounded-lg border border-rose-300 bg-rose-50 p-2.5 text-xs text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">The button address must start with https://</p>}
                  <p className="text-[11.5px] text-soft">Shown with sample name &ldquo;Alex&rdquo;. {previewing && "Updating…"}</p>
                  <iframe title="Email preview" sandbox="" srcDoc={preview.html} className="h-[680px] w-full rounded-lg border border-line bg-white" />
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="card h-fit space-y-4 p-4">
          <div>
            <div className="label">Audience</div>
            <div className="space-y-1.5">
              {AUD.map((a) => {
                const locked = a.owner && !isOwner;
                return (
                  <button key={a.id} type="button" disabled={locked} onClick={() => setAud(a.id)} className={cn("w-full rounded-lg border px-3 py-2 text-left transition", aud === a.id ? "border-accent bg-accent/10" : "border-line hover:border-accent/40", locked && "cursor-not-allowed opacity-50")}>
                    <div className="text-[13px] font-semibold">{a.title}</div>
                    <div className="text-[11.5px] text-soft">{locked ? "Owners only." : a.hint}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {aud === "TEST" && <p className="text-[12px] text-soft">Goes to {myEmail}, with &ldquo;[Test]&rdquo; at the start of the subject.</p>}
          {aud === "SINGLE" && (
            <div className="space-y-2">
              <Field label="Email address"><input className="input" type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@example.com" /></Field>
              <Field label="Greeting name (optional)"><input className="input" value={greet} onChange={(e) => setGreet(e.target.value)} maxLength={80} placeholder="e.g. Priya" /></Field>
            </div>
          )}
          {broadcast && (
            <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[12px] text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
              <p className="font-semibold">{count ? (count.tooMany ? "More than 500 people. Narrow the audience." : `This reaches ${count.count} ${count.count === 1 ? "person" : "people"}.`) : "Counting…"}</p>
              <p>Send a test to yourself first. A sent email can&apos;t be recalled.</p>
              <Field label="Type SEND to confirm"><input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="SEND" /></Field>
            </div>
          )}

          {missing.length > 0 && <p className="text-[12px] text-amber-700 dark:text-amber-400">Fill in {missing.length} blank{missing.length === 1 ? "" : "s"} first.</p>}
          <button type="button" className="btn-primary w-full justify-center" disabled={!ready || sending} onClick={() => void send()}>
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {sending ? "Sending…" : aud === "TEST" ? "Send test to me" : aud === "SINGLE" ? "Send email" : "Send to everyone selected"}
          </button>
          {aud !== "TEST" && <button type="button" className="btn w-full justify-center" disabled={sending || form.subject.trim().length < 2 || form.body.trim().length < 10 || missing.length > 0} onClick={() => void send(true)}>Send a test to me</button>}
          <p className="text-[11.5px] leading-relaxed text-soft">Sent from notifications@onboardops.org. Every send is recorded in the staff activity log (without the message text) and in the email log.</p>
        </aside>
      </div>

      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><Clock className="h-4 w-4 text-soft" />Send history</h2>
          <button type="button" className="btn !h-8" onClick={() => router.refresh()}><RefreshCw className="h-3.5 w-3.5" />Refresh</button>
        </div>
        {history.length === 0 ? <p className="py-6 text-center text-[13px] text-soft">Nothing sent yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[13px]">
              <thead><tr>{["When", "Audience", "Subject", "Delivered", "Failed", "Status"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="hover:bg-muted">
                    <td className="td mono whitespace-nowrap text-xs">{fmtDateTime(h.at)}</td>
                    <td className="td"><div>{h.audience === "ALL" ? "Broadcast" : h.audience === "OWNERS" ? "Owners" : h.audience === "TEST" ? "Test" : "Single"}</div><div className="text-[11px] text-soft">{h.target || `${h.total} recipients`} · {h.by}</div></td>
                    <td className="td max-w-xs truncate">{h.subject}</td>
                    <td className="td tabular-nums">{h.delivered}{h.skipped ? <span className="text-soft"> (+{h.skipped} opted out)</span> : null}</td>
                    <td className={cn("td tabular-nums", h.failed > 0 && "text-rose-600")}>{h.failed}</td>
                    <td className="td"><span className={cn("badge mono uppercase", h.status === "COMPLETED" ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300" : h.status === "SENDING" ? "border-line bg-muted text-soft" : "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300")}>{h.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={aiOpen} onClose={() => setAiOpen(false)} title="Draft an email with AI">
        <div className="space-y-3 text-[13px]">
          <p className="text-soft">Say what the email should cover. AI writes a subject and body in the same format as the templates. It leaves {"{{blanks}}"} for anything it doesn&apos;t know, and never invents dates, prices or promises.</p>
          <textarea className="textarea w-full" rows={5} value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} maxLength={1000} placeholder="e.g. Tell workspace owners we are adding a new subprocessor next month and how they can object." aria-label="What the email should say" />
          <button type="button" className="btn-primary w-full" disabled={aiBusy || aiPrompt.trim().length < 10} onClick={() => void generate()}>{aiBusy ? "Writing…" : "Write the draft"}</button>
          <p className="text-[11.5px] text-soft">AI can be wrong. Read the draft and edit it before you send anything.</p>
        </div>
      </Modal>
    </div>
  );
}
