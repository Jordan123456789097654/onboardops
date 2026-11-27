"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, BookOpen, CheckCheck, Clock, FileText, History, MessageCircle, Paperclip, RotateCcw, Send, Sparkles, ThumbsDown, ThumbsUp, User, X } from "lucide-react";
import {
  createChatTicketAction,
  getChatTicketAction,
  getSupportStatusAction,
  rateTicketAction,
  requestHistoryCodeAction,
  sendChatFollowUpAction,
  sweepSupportAction,
  verifyHistoryCodeAction,
} from "@/actions/chat-support";

type SuggestedLink = { label: string; href: string };
type ChatMsg = { id: string; role: "user" | "assistant"; content: string; suggestedLinks?: SuggestedLink[]; escalate?: boolean };
type FileRef = { id: string; name: string; mime: string; size: number };
type TicketMsg = { id: string; kind: string; author: string; body: string; at: string; files: FileRef[] };
type Ticket = { id: string; token: string; ref: string };
type TicketInfo = { status: string; movedToEmail: boolean; assignee: string | null; seen: { at: string; by: string } | null; typing: string | null; rated: boolean };
type Brand = { name: string; subtitle: string; color: string; greeting: string; avatar: string };
type Hours = { open: boolean; nextOpenLabel: string | null; awayMessage: string; responseTarget: string; brand: Brand };
type PastTicket = { id: string; token: string; ref: string; status: string; topic: string; createdAt: string; preview: string };

const STARTERS = ["How does pricing work?", "How do quizzes and certifications work?", "How is our data encrypted?"] as const;
const TICKET_KEY = "oo_chat_ticket";
const HISTORY_KEY = "oo_chat_history";
const HISTORY_TTL = 24 * 3600 * 1000;
const DEFAULT_BRAND: Brand = { name: "Maya", subtitle: "Here to help", color: "", greeting: "I'm Maya, your OnboardOps guide. Ask me anything. I know the docs inside out!", avatar: "" };

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function save(key: string, v: unknown) {
  try {
    if (v) localStorage.setItem(key, JSON.stringify(v));
    else localStorage.removeItem(key);
  } catch {
    // Private mode or blocked storage: the chat still works for this visit.
  }
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const sizeOf = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** Keeps line breaks, turns web addresses into links, and renders **bold**. Only http(s) links are made clickable. */
const SITE_SECTIONS = "legal|blog|playbooks|migrate|support|tools|pricing|security|features|solutions|changelog|roadmap|faq|about|contact|tutorial|register|login|why|team|partners|careers|story|brand|newsletter|verify|launch";
const SITE_PATH_RE = new RegExp(`^\\/(?:${SITE_SECTIONS})(?:\\/[a-zA-Z0-9_-]+)*$`);
const SPLIT_RE = new RegExp(`(https?:\\/\\/[^\\s)]*[^\\s).,;:!?]|\\*\\*[^*\\n]+\\*\\*|(?<![\\w/])\\/(?:${SITE_SECTIONS})(?:\\/[a-zA-Z0-9_-]+)*(?![\\w/]))`, "g");

/** Keeps line breaks, turns web addresses and OnboardOps page paths into links, and renders **bold**. */
function Rich({ text }: { text: string }) {
  const parts = text.split(SPLIT_RE);
  const linkCls = "font-medium underline underline-offset-2 [overflow-wrap:anywhere]";
  return (
    <>
      {parts.map((p, i) => {
        if (!p) return null;
        if (/^https?:\/\//.test(p)) return <a key={i} href={p} target="_blank" rel="noopener noreferrer" className={linkCls}>{p}</a>;
        if (/^\*\*[^*\n]+\*\*$/.test(p)) return <strong key={i}>{p.slice(2, -2)}</strong>;
        if (SITE_PATH_RE.test(p)) return <Link key={i} href={p} className={linkCls}>{p}</Link>;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

function Dots() {
  return (
    <span className="flex items-center gap-1 px-0.5 py-1" aria-label="Typing">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-2 w-2 rounded-full bg-soft/60" style={{ animation: `chatDot 1.2s ${i * 0.2}s ease-in-out infinite` }} />
      ))}
    </span>
  );
}

/** Round chat bubble on every page. Answers from the docs; hands off to a person with a ticket, and shows their replies live. */
export function MarketingChat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [ticketMsgs, setTicketMsgs] = useState<TicketMsg[]>([]);
  const [info, setInfo] = useState<TicketInfo | null>(null);
  const [handoff, setHandoff] = useState(false);
  const [handoffForm, setHandoffForm] = useState({ name: "", email: "" });
  const [me, setMe] = useState<{ signedIn: boolean; firstName: string | null }>({ signedIn: false, firstName: null });
  const [hours, setHours] = useState<Hours | null>(null);
  const [pending, setPending] = useState<FileRef[]>([]);
  const [uploading, setUploading] = useState(false);
  const [rateDown, setRateDown] = useState(false);
  const [rateNote, setRateNote] = useState("");
  const [lookup, setLookup] = useState<null | { step: "email" | "code" | "list"; email: string; code: string; list: PastTicket[] }>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const swept = useRef(false);

  const brand = hours?.brand ?? DEFAULT_BRAND;
  const custom = /^#[0-9a-fA-F]{6}$/.test(brand.color);
  const accentCls = custom ? "" : "bg-accent text-accent-fg";
  const accentStyle = custom ? { backgroundColor: brand.color, color: "#fff" } : undefined;
  const headStyle = custom ? { background: `linear-gradient(135deg, ${brand.color}, ${brand.color}dd)`, color: "#fff" } : { background: "linear-gradient(135deg, rgb(var(--accent)), rgb(var(--accent) / 0.82))", color: "rgb(var(--accent-fg))" };

  useEffect(() => {
    const t = load<Ticket>(TICKET_KEY);
    if (t) setTicket(t);
    const h = load<{ at: number; messages: ChatMsg[] }>(HISTORY_KEY);
    if (h && Date.now() - h.at < HISTORY_TTL && Array.isArray(h.messages)) setMessages(h.messages.slice(-30));
  }, []);

  useEffect(() => {
    save(HISTORY_KEY, messages.length ? { at: Date.now(), messages: messages.slice(-30) } : null);
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    void fetch("/api/ai/chat", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { signedIn?: boolean; firstName?: string | null }) => setMe({ signedIn: !!j.signedIn, firstName: j.firstName ?? null }))
      .catch(() => {});
    void getSupportStatusAction().then((r) => r.ok && setHours(r.data));
    if (!swept.current) {
      swept.current = true;
      void sweepSupportAction();
    }
  }, [open]);

  const pull = useCallback(async (t: Ticket) => {
    try {
      const r = await getChatTicketAction({ id: t.id, token: t.token });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setTicketMsgs(r.data.messages);
      setInfo({ status: r.data.status, movedToEmail: r.data.movedToEmail, assignee: r.data.assignee, seen: r.data.seen, typing: r.data.typing, rated: r.data.rated });
    } catch {
      // Offline: keep what is on screen.
    }
  }, []);

  // Live: while a ticket is open, check for new replies, seen receipts and typing every 4 seconds (only while the tab is visible).
  useEffect(() => {
    if (!ticket || !open) return;
    void pull(ticket);
    const id = window.setInterval(() => { if (document.visibilityState === "visible") void pull(ticket); }, 4000);
    const onVis = () => { if (document.visibilityState === "visible") void pull(ticket); };
    document.addEventListener("visibilitychange", onVis);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [ticket, open, pull]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 40); }, [open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, ticketMsgs, loading, open, handoff, info?.typing, lookup]);

  async function sendQuestion(rawText: string) {
    const text = rawText.trim();
    if (text.length < 2 || loading) return;
    setError(null);
    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: "user", content: text };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: nextHistory.slice(-10).map((m) => ({ role: m.role, content: m.content })) }),
      });
      const data = (await res.json().catch(() => null)) as { reply?: string; escalate?: boolean; suggestedLinks?: SuggestedLink[]; error?: string; signedIn?: boolean; firstName?: string | null; ticket?: Ticket | null } | null;
      if (!res.ok || !data?.reply) {
        setError(data?.error ?? "I can't answer that right now. You can talk to a person instead.");
        return;
      }
      if (data.signedIn !== undefined) setMe({ signedIn: !!data.signedIn, firstName: data.firstName ?? null });
      if (data.ticket) {
        // Maya opened a ticket for a signed-in person on their behalf. Move them straight into it.
        save(TICKET_KEY, data.ticket);
        setTicket(data.ticket);
        setTicketMsgs([{ id: `m-${Date.now()}`, kind: "REPLY", author: brand.name, body: data.reply!, at: new Date().toISOString(), files: [] }]);
        setMessages([]);
        return;
      }
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: data.reply!, suggestedLinks: data.suggestedLinks ?? [], escalate: !!data.escalate }]);
    } catch {
      setError("Network error while reaching the assistant. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const transcriptText = () => messages.slice(-6).map((m) => `${m.role === "user" ? "Visitor" : "Assistant"}: ${m.content}`).join("\n");

  async function openTicket(e: React.FormEvent) {
    e.preventDefault();
    const lastQuestion = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    setLoading(true);
    setError(null);
    try {
      const r = await createChatTicketAction({
        name: handoffForm.name,
        email: handoffForm.email,
        message: lastQuestion || "Asked to speak with support from the website chat.",
        transcript: transcriptText(),
        page: /^\/[a-zA-Z0-9/_-]*$/.test(pathname ?? "") ? pathname : undefined,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const t: Ticket = { id: r.data.id, token: r.data.token, ref: r.data.ref };
      save(TICKET_KEY, t);
      setTicket(t);
      setHandoff(false);
      setMessages([]);
    } catch {
      setError("We couldn't open a ticket just now. Please check your details and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length || !ticket) return;
    setError(null);
    setUploading(true);
    try {
      for (const f of Array.from(files).slice(0, 3)) {
        const fd = new FormData();
        fd.set("id", ticket.id);
        fd.set("token", ticket.token);
        fd.set("file", f);
        const res = await fetch("/api/support/upload", { method: "POST", body: fd });
        const j = (await res.json().catch(() => null)) as (FileRef & { error?: string }) | null;
        if (!res.ok || !j?.id) {
          setError(j?.error ?? "That file didn't upload.");
          break;
        }
        setPending((p) => [...p, { id: j.id, name: j.name, mime: j.mime, size: j.size }].slice(0, 5));
      }
    } catch {
      setError("That file didn't upload. Please try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function sendFollowUp(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!ticket || (!text && !pending.length) || loading) return;
    setLoading(true);
    setError(null);
    try {
      const r = await sendChatFollowUpAction({ id: ticket.id, token: ticket.token, body: text, attachmentIds: pending.map((p) => p.id) });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setTicketMsgs((prev) => [...prev, { id: `v-${Date.now()}`, kind: "VISITOR", author: "You", body: text || "(attachment)", at: new Date().toISOString(), files: pending }]);
      setInput("");
      setPending([]);
      setInfo((i) => (i ? { ...i, status: i.status === "SOLVED" ? "OPEN" : i.status, seen: null, rated: false } : i));
      void pull(ticket);
    } catch {
      setError("Your message didn't send. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function rate(rating: number, note = "") {
    if (!ticket) return;
    const r = await rateTicketAction({ id: ticket.id, token: ticket.token, rating, note });
    if (r.ok) { setInfo((i) => (i ? { ...i, rated: true } : i)); setRateDown(false); }
    else setError(r.error);
  }

  async function lookupStep(e: React.FormEvent) {
    e.preventDefault();
    if (!lookup) return;
    setLoading(true);
    setError(null);
    try {
      if (lookup.step === "email") {
        const r = await requestHistoryCodeAction({ email: lookup.email });
        if (!r.ok) return setError(r.error);
        setLookup({ ...lookup, step: "code" });
      } else if (lookup.step === "code") {
        const r = await verifyHistoryCodeAction({ email: lookup.email, code: lookup.code });
        if (!r.ok) return setError(r.error);
        setLookup({ ...lookup, step: "list", list: r.data });
      }
    } finally {
      setLoading(false);
    }
  }

  function openPast(p: PastTicket) {
    const t: Ticket = { id: p.id, token: p.token, ref: p.ref };
    save(TICKET_KEY, t);
    setTicketMsgs([]);
    setInfo(null);
    setTicket(t);
    setLookup(null);
    setError(null);
  }

  function startOver() {
    save(TICKET_KEY, null);
    save(HISTORY_KEY, null);
    setTicket(null);
    setTicketMsgs([]);
    setInfo(null);
    setMessages([]);
    setError(null);
    setInput("");
    setPending([]);
    setHandoff(false);
    setLookup(null);
  }

  if (!open) {
    return (
      <div className="no-print fixed bottom-4 right-4 z-40">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Open chat`}
          className={`flex h-14 w-14 items-center justify-center rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.25)] transition-transform duration-200 hover:scale-105 ${accentCls}`}
          style={custom ? accentStyle : { background: "rgb(var(--accent))", color: "rgb(var(--accent-fg))" }}
        >
          <MessageCircle className="h-6 w-6" strokeWidth={2} />
        </button>
      </div>
    );
  }

  const inTicket = !!ticket;
  const lastReply = [...ticketMsgs].reverse().find((m) => m.kind === "REPLY");
  const rep = info?.assignee || lastReply?.author || null;
  const lastVisitorId = [...ticketMsgs].reverse().find((m) => m.kind === "VISITOR")?.id;
  const away = hours && !hours.open;
  const fileUrl = (f: FileRef) => `/api/support/file/${f.id}?r=${ticket!.id}&t=${ticket!.token}`;

  const bubbleMe = `max-w-[84%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md px-3.5 py-2.5 text-[13.5px] leading-relaxed ${accentCls}`;
  const bubbleThem = "max-w-[90%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-md border border-line bg-muted px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink";

  const files = (m: TicketMsg) =>
    m.files.length > 0 && (
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {m.files.map((f) =>
          f.mime.startsWith("image/") ? (
            <a key={f.id} href={fileUrl(f)} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-line bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fileUrl(f)} alt={f.name} className="max-h-32 max-w-[180px] object-cover" />
            </a>
          ) : (
            <a key={f.id} href={fileUrl(f)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1 text-[12px] text-ink">
              <FileText className="h-3.5 w-3.5" />
              <span className="max-w-[140px] truncate">{f.name}</span>
              <span className="text-soft">{sizeOf(f.size)}</span>
            </a>
          )
        )}
      </div>
    );

  return (
    <>
      <style>{`
        @keyframes chatDot { 0%,60%,100% { transform: translateY(0); opacity: .4; } 30% { transform: translateY(-5px); opacity: 1; } }
        @keyframes chatIn { from { opacity: 0; transform: translateY(14px) scale(.97); } to { opacity: 1; transform: none; } }
        .chat-panel { animation: chatIn .22s cubic-bezier(.16,1,.3,1) both; }
      `}</style>
      <div
        role="dialog"
        aria-label="OnboardOps chat"
        className="chat-panel no-print fixed bottom-5 right-5 z-50 flex h-[min(440px,calc(100vh-6rem))] w-[320px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-line bg-surface text-ink shadow-[0_12px_48px_rgba(0,0,0,0.28)]"
      >
        <div className="px-4 py-3.5" style={headStyle}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-[16px] font-semibold">
                {inTicket ? <User className="h-5 w-5" /> : brand.avatar ? <span>{brand.avatar}</span> : <span className="text-[17px] font-bold">{brand.name.charAt(0).toUpperCase()}</span>}
                <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white/60 ${away ? "bg-amber-400" : "bg-emerald-400"}`} />
              </div>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-[14px] font-semibold">{inTicket ? rep ?? "OnboardOps Support" : `${brand.name} · OnboardOps`}</div>
                <div className="truncate text-[12px] opacity-80">
                  {inTicket ? `Ticket #${ticket!.ref}${info?.status === "SOLVED" ? " · solved" : ""}` : away ? `Away${hours?.nextOpenLabel ? ` · back ${hours.nextOpenLabel}` : ""}` : brand.subtitle}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              {(messages.length > 0 || inTicket || lookup) && (
                <button type="button" onClick={startOver} title="Start over" aria-label="Start over" className="flex h-8 w-8 items-center justify-center rounded-full opacity-80 transition hover:bg-white/15 hover:opacity-100">
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="flex h-8 w-8 items-center justify-center rounded-full opacity-80 transition hover:bg-white/15 hover:opacity-100">
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
        </div>

        {away && !inTicket && (
          <div className="flex items-start gap-2 border-b border-line bg-amber-50 px-4 py-2 text-[12px] leading-snug text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{hours!.awayMessage} Replies usually come {hours!.responseTarget}.</span>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 space-y-3.5 overflow-y-auto bg-surface px-4 py-4">
          {lookup ? (
            <form onSubmit={lookupStep} className="space-y-3 rounded-2xl border border-line bg-muted p-4">
              <p className="text-[14px] font-semibold">Find your past conversations</p>
              {lookup.step === "email" && (
                <>
                  <p className="text-[12.5px] text-soft">Enter the email you used. If we have conversations with you, we&apos;ll send a 6-digit code.</p>
                  <input className="input w-full" type="email" required placeholder="Your email" value={lookup.email} onChange={(e) => setLookup({ ...lookup, email: e.target.value })} />
                  <button className="btn-primary w-full justify-center" disabled={loading}>{loading ? "Sending…" : "Send code"}</button>
                </>
              )}
              {lookup.step === "code" && (
                <>
                  <p className="text-[12.5px] text-soft">If that address has conversations, a code is on its way. It works for 15 minutes.</p>
                  <input className="input w-full tracking-[0.3em]" inputMode="numeric" maxLength={6} required placeholder="123456" value={lookup.code} onChange={(e) => setLookup({ ...lookup, code: e.target.value.replace(/\D/g, "") })} />
                  <button className="btn-primary w-full justify-center" disabled={loading || lookup.code.length !== 6}>{loading ? "Checking…" : "Show my conversations"}</button>
                </>
              )}
              {lookup.step === "list" && (
                <div className="space-y-1.5">
                  {lookup.list.length === 0 && <p className="text-[12.5px] text-soft">No conversations found.</p>}
                  {lookup.list.map((p) => (
                    <button key={p.id} type="button" onClick={() => openPast(p)} className="block w-full rounded-xl border border-line bg-surface px-3 py-2 text-left transition hover:border-accent/50">
                      <div className="flex items-center justify-between text-[11.5px] text-soft"><span>#{p.ref}</span><span>{new Date(p.createdAt).toLocaleDateString()} · {p.status.toLowerCase()}</span></div>
                      <div className="truncate text-[13px] text-ink">{p.preview}</div>
                    </button>
                  ))}
                </div>
              )}
              <button type="button" className="text-[12px] text-soft underline underline-offset-2" onClick={() => { setLookup(null); setError(null); }}>Back to chat</button>
            </form>
          ) : inTicket ? (
            <>
              <div className="rounded-xl bg-muted px-3.5 py-2.5 text-[12.5px] leading-relaxed text-soft">
                {info?.movedToEmail ? "This conversation has moved to email. Check your inbox for replies from our team." : "You're connected. A teammate replies here as soon as they can, and we send a copy to your email too."}
              </div>
              {ticketMsgs.length === 0 && (
                <div className="flex items-center gap-2 text-[12.5px] text-soft"><span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />Your message is with our team.</div>
              )}
              {ticketMsgs.map((m) =>
                m.kind === "SYSTEM" ? (
                  <div key={m.id} className="text-center"><span className="rounded-full border border-line bg-muted px-3 py-1 text-[11px] text-soft">{m.body}</span></div>
                ) : m.kind === "VISITOR" ? (
                  <div key={m.id} className="flex flex-col items-end">
                    <div className={bubbleMe} style={accentStyle}><Rich text={m.body} /></div>
                    {files(m)}
                    {m.id === lastVisitorId && info?.seen && (
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-soft"><CheckCheck className="h-3 w-3 text-emerald-500" />Seen by {info.seen.by} · {timeOf(info.seen.at)}</div>
                    )}
                  </div>
                ) : (
                  <div key={m.id} className="space-y-1">
                    <div className="text-[11px] font-medium text-soft">{m.author} · support · {timeOf(m.at)}</div>
                    <div className={bubbleThem}><Rich text={m.body} /></div>
                    {files(m)}
                  </div>
                )
              )}
              {info?.typing && (
                <div className="space-y-1">
                  <div className="text-[11px] font-medium text-soft">{info.typing} is typing…</div>
                  <div className="inline-flex rounded-2xl rounded-bl-md border border-line bg-muted px-3.5 py-2"><Dots /></div>
                </div>
              )}
              {info?.status === "SOLVED" && !info.rated && (
                <div className="space-y-2 rounded-2xl border border-line bg-muted p-3.5 text-center">
                  <p className="text-[13px] font-medium">This conversation is marked solved. How did we do?</p>
                  {!rateDown ? (
                    <div className="flex justify-center gap-2">
                      <button type="button" onClick={() => void rate(5)} className="btn"><ThumbsUp className="h-4 w-4" />Helpful</button>
                      <button type="button" onClick={() => setRateDown(true)} className="btn"><ThumbsDown className="h-4 w-4" />Not really</button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <textarea className="textarea w-full" rows={2} placeholder="What could we have done better? (optional)" value={rateNote} onChange={(e) => setRateNote(e.target.value)} maxLength={500} />
                      <button type="button" onClick={() => void rate(1, rateNote)} className="btn-primary">Send feedback</button>
                    </div>
                  )}
                  <p className="text-[11.5px] text-soft">Need more help? Just write below and we&apos;ll reopen it.</p>
                </div>
              )}
              {info?.status === "SOLVED" && info.rated && <p className="text-center text-[12px] text-soft">Thanks for the feedback. Write below any time to reopen this.</p>}
            </>
          ) : messages.length === 0 ? (
            <div className="space-y-5">
              <div className="space-y-1">
                <p className="text-[16px] font-semibold">{me.signedIn && me.firstName ? `Hi ${me.firstName}, good to see you! 👋` : "Hi there, I'm glad you stopped by! 👋"}</p>
                <p className="text-[13px] leading-relaxed text-soft">{me.signedIn ? `I'm ${brand.name}, your OnboardOps guide. I can see your account, so ask me about your role, your training, or anything you're stuck on.` : brand.greeting}</p>
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-soft">Popular questions</p>
                {STARTERS.map((q) => (
                  <button key={q} type="button" disabled={loading} onClick={() => void sendQuestion(q)} className="flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-left text-[13px] font-medium text-ink transition hover:border-accent/50 hover:bg-muted">
                    <span>{q}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-soft" />
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => { setLookup({ step: "email", email: "", code: "", list: [] }); setError(null); }} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-soft underline underline-offset-2 hover:text-ink">
                <History className="h-3.5 w-3.5" />Find a past conversation
              </button>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "flex justify-end" : "space-y-2"}>
                <div className={m.role === "user" ? bubbleMe : bubbleThem} style={m.role === "user" ? accentStyle : undefined}><Rich text={m.content} /></div>
                {m.role === "assistant" && m.suggestedLinks && m.suggestedLinks.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {m.suggestedLinks.map((link) => {
                      const cls = "inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-medium text-accent transition hover:border-accent/50 hover:bg-muted";
                      return link.href.startsWith("http") ? (
                        <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className={cls}><BookOpen className="h-3 w-3 shrink-0" /><span>{link.label}</span><ArrowUpRight className="h-3 w-3 shrink-0 opacity-60" /></a>
                      ) : (
                        <Link key={link.href} href={link.href} className={cls}><BookOpen className="h-3 w-3 shrink-0" /><span>{link.label}</span></Link>
                      );
                    })}
                  </div>
                )}
                {m.role === "assistant" && m.escalate && !handoff && (
                  <button type="button" onClick={() => setHandoff(true)} className="rounded-lg border border-accent/40 bg-muted px-3 py-1.5 text-[12.5px] font-medium text-accent transition hover:bg-accent/10">Talk to a person →</button>
                )}
              </div>
            ))
          )}

          {handoff && !inTicket && !lookup && (
            <form onSubmit={openTicket} className="space-y-3 rounded-2xl border border-line bg-muted p-4">
              <div>
                <p className="text-[14px] font-semibold">Talk to our team</p>
                <p className="mt-0.5 text-[12.5px] text-soft">{away ? `We're away right now, but your message is saved. Replies usually come ${hours!.responseTarget}.` : `We'll reply here and by email, usually ${hours?.responseTarget ?? "within 2 business days"}.`} You can add screenshots once the chat is open.</p>
              </div>
              {me.signedIn ? (
                <p className="text-[12.5px] text-soft">We&apos;ll use your account details, so there&apos;s nothing else to fill in.</p>
              ) : (
                <>
                  <input className="input w-full" placeholder="Your name" required minLength={2} value={handoffForm.name} onChange={(e) => setHandoffForm({ ...handoffForm, name: e.target.value })} />
                  <input className="input w-full" type="email" placeholder="Your email" required value={handoffForm.email} onChange={(e) => setHandoffForm({ ...handoffForm, email: e.target.value })} />
                </>
              )}
              <div className="flex gap-2">
                <button className="btn-primary flex-1 justify-center" disabled={loading}>{loading ? "Opening…" : "Send to support"}</button>
                <button type="button" className="btn" onClick={() => setHandoff(false)}>Cancel</button>
              </div>
            </form>
          )}

          {loading && !inTicket && !handoff && !lookup && (
            <div className="inline-flex rounded-2xl rounded-bl-md border border-line bg-muted px-3.5 py-2.5"><Dots /></div>
          )}

          {error && (
            <div className="space-y-2.5 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-3 text-[13px] text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
              <p>{error}</p>
              {!inTicket && !handoff && !lookup && <button type="button" onClick={() => setHandoff(true)} className="rounded-lg bg-rose-100 px-2.5 py-1 text-[12px] font-medium text-rose-700 hover:bg-rose-200 dark:bg-rose-900 dark:text-rose-200">Talk to a person →</button>}
            </div>
          )}
        </div>

        {lookup ? null : inTicket ? (
          info?.movedToEmail ? (
            <div className="border-t border-line p-3.5 text-center text-[12.5px] text-soft">Replies continue by email. Check your inbox.</div>
          ) : (
            <div className="border-t border-line">
              {pending.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
                  {pending.map((f) => (
                    <span key={f.id} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-muted px-2 py-1 text-[12px]">
                      <FileText className="h-3 w-3" /><span className="max-w-[120px] truncate">{f.name}</span>
                      <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setPending((p) => p.filter((x) => x.id !== f.id))}><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
              <form onSubmit={sendFollowUp} className="flex items-center gap-2 p-3">
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp,application/pdf" multiple className="hidden" onChange={(e) => void uploadFiles(e.target.files)} />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || pending.length >= 5} aria-label="Attach a screenshot or PDF" title="Attach a screenshot or PDF (up to 3 MB)" className="btn !px-2.5 shrink-0"><Paperclip className="h-3.5 w-3.5" /></button>
                <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} maxLength={3000} disabled={loading} placeholder={uploading ? "Uploading…" : "Write a reply…"} aria-label="Reply to support" className="input flex-1" />
                <button type="submit" disabled={loading || uploading || (!input.trim() && !pending.length)} aria-label="Send reply" className={`btn-primary !px-2.5 shrink-0`}><Send className="h-3.5 w-3.5" /></button>
              </form>
            </div>
          )
        ) : (
          <div className="border-t border-line">
            {!handoff && messages.length > 0 && (
              <div className="px-3 pt-2.5 text-center">
                <button type="button" onClick={() => setHandoff(true)} className="text-[12px] font-medium text-soft underline underline-offset-2 hover:text-ink">Rather talk to a person?</button>
              </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); void sendQuestion(input); }} className="flex items-center gap-2 p-3">
              <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} maxLength={600} disabled={loading} placeholder="Ask me anything…" aria-label="Ask a question" className="input flex-1" />
              <button type="submit" disabled={loading || input.trim().length < 2} aria-label="Send question" className="btn-primary !px-2.5 shrink-0"><Send className="h-3.5 w-3.5" /></button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
