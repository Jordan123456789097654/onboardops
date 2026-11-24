"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, MessageCircle, RotateCcw, Send, Sparkles, User, X } from "lucide-react";
import { createChatTicketAction, getChatTicketAction, sendChatFollowUpAction } from "@/actions/chat-support";

type SuggestedLink = { label: string; href: string };
type ChatMsg = { id: string; role: "user" | "assistant"; content: string; suggestedLinks?: SuggestedLink[]; escalate?: boolean };
type TicketMsg = { id: string; kind: string; author: string; body: string; at: string };
type Ticket = { id: string; token: string; ref: string };

const STARTERS = [
  "How does pricing work?",
  "How do quizzes and certifications work?",
  "How is our data encrypted?",
] as const;
const TICKET_KEY = "oo_chat_ticket";

function loadTicket(): Ticket | null {
  try {
    const raw = localStorage.getItem(TICKET_KEY);
    return raw ? (JSON.parse(raw) as Ticket) : null;
  } catch {
    return null;
  }
}
function saveTicket(t: Ticket | null) {
  try {
    if (t) localStorage.setItem(TICKET_KEY, JSON.stringify(t));
    else localStorage.removeItem(TICKET_KEY);
  } catch {}
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-soft/60"
          style={{ animation: `chatDot 1.2s ${i * 0.2}s ease-in-out infinite` }}
        />
      ))}
    </div>
  );
}

/** Round chat bubble on every page. Answers from the docs; hands off to a person with a ticket, and shows their replies here. */
export function MarketingChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [ticketMsgs, setTicketMsgs] = useState<TicketMsg[]>([]);
  const [ticketStatus, setTicketStatus] = useState<{ movedToEmail: boolean; status: string } | null>(null);
  const [handoff, setHandoff] = useState(false);
  const [handoffForm, setHandoffForm] = useState({ name: "", email: "" });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = loadTicket();
    if (t) setTicket(t);
  }, []);

  useEffect(() => {
    if (!ticket || !open) return;
    let stop = false;
    const pull = async () => {
      try {
        const r = await getChatTicketAction({ id: ticket.id, token: ticket.token });
        if (stop) return;
        if (!r.ok) { setError(r.error); return; }
        setTicketMsgs(r.data.messages);
        setTicketStatus({ movedToEmail: r.data.movedToEmail, status: r.data.status });
      } catch {}
    };
    void pull();
    const id = window.setInterval(pull, 15000);
    return () => { stop = true; window.clearInterval(id); };
  }, [ticket, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 40); }, [open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, ticketMsgs, loading, open, handoff]);

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
      const data = (await res.json().catch(() => null)) as { reply?: string; escalate?: boolean; suggestedLinks?: SuggestedLink[]; error?: string } | null;
      if (!res.ok || !data?.reply) {
        setError(data?.error ?? "I can't answer that right now. You can talk to a person instead.");
        return;
      }
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", content: data.reply!, suggestedLinks: data.suggestedLinks ?? [], escalate: !!data.escalate },
      ]);
    } catch {
      setError("Network error while reaching the assistant. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function transcriptText() {
    return messages.slice(-6).map((m) => `${m.role === "user" ? "Visitor" : "Assistant"}: ${m.content}`).join("\n");
  }

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
      });
      if (!r.ok) { setError(r.error); return; }
      const t: Ticket = { id: r.data.id, token: r.data.token, ref: r.data.ref };
      saveTicket(t);
      setTicket(t);
      setHandoff(false);
    } catch {
      setError("We couldn't open a ticket just now. Please check your details and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function sendFollowUp(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!ticket || text.length < 1 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const r = await sendChatFollowUpAction({ id: ticket.id, token: ticket.token, body: text });
      if (!r.ok) { setError(r.error); return; }
      setInput("");
      setTicketMsgs((prev) => [
        ...prev,
        { id: `v-${Date.now()}`, kind: "VISITOR", author: "You", body: text, at: new Date().toISOString() },
      ]);
    } catch {
      setError("Your message didn't send. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function startOver() {
    saveTicket(null);
    setTicket(null);
    setTicketMsgs([]);
    setTicketStatus(null);
    setMessages([]);
    setError(null);
    setInput("");
    setHandoff(false);
  }

  if (!open) {
    return (
      <div className="no-print fixed bottom-5 right-5 z-40">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Chat with OnboardOps"
          className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-[0_4px_24px_rgba(0,0,0,0.18)] transition-all duration-200 hover:scale-110 hover:shadow-[0_6px_28px_rgba(0,0,0,0.22)]"
        >
          <MessageCircle className="h-6 w-6 transition-transform duration-200 group-hover:scale-110" />
          <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
        </button>
      </div>
    );
  }

  const inTicket = !!ticket;
  const replyMsg = ticketMsgs.find((m) => m.kind === "REPLY");
  const replyingTo = replyMsg?.author;

  return (
    <>
      <style>{`
        @keyframes chatDot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes chatSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .chat-panel { animation: chatSlideUp 0.22s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>

      <div
        role="dialog"
        aria-label="OnboardOps chat"
        className="chat-panel no-print fixed bottom-5 right-5 z-50 flex h-[min(600px,calc(100vh-2.5rem))] w-[400px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl bg-surface shadow-[0_8px_40px_rgba(0,0,0,0.18)]"
        style={{ border: "1px solid rgba(0,0,0,0.08)" }}
      >
        {/* Header */}
        <div className="relative overflow-hidden px-4 pb-4 pt-4" style={{ background: "linear-gradient(135deg, var(--color-accent) 0%, color-mix(in oklch, var(--color-accent), #000 18%) 100%)" }}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                {inTicket ? <User className="h-5 w-5 text-white" /> : <Sparkles className="h-5 w-5 text-white" />}
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white/40 bg-emerald-400" />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-white">
                  {inTicket ? (replyingTo ? replyingTo : "OnboardOps Support") : "Maya · OnboardOps"}
                </div>
                <div className="text-[12px] text-white/70">
                  {inTicket ? `Ticket #${ticket!.ref}` : "Here to help · Usually replies instantly"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {(messages.length > 0 || inTicket) && (
                <button
                  type="button"
                  onClick={startOver}
                  title="Start over"
                  aria-label="Start over"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/15 hover:text-white"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/15 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Messages area */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4" style={{ background: "var(--color-surface)" }}>
          {inTicket ? (
            <>
              <div className="rounded-xl bg-muted/70 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-soft">
                {ticketStatus?.movedToEmail
                  ? "This conversation has moved to email. Check your inbox for replies from our team."
                  : "🎉 You're connected! A teammate will reply here shortly. We'll also send a copy to your email."}
              </div>
              {ticketMsgs.length === 0 && (
                <div className="flex items-center gap-2 text-[12.5px] text-soft">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                  Your message is with our team. Hang tight!
                </div>
              )}
              {ticketMsgs.map((m) => (
                <div
                  key={m.id}
                  className={
                    m.kind === "VISITOR"
                      ? "flex justify-end"
                      : m.kind === "SYSTEM"
                        ? "text-center"
                        : "space-y-1"
                  }
                >
                  {m.kind === "SYSTEM" ? (
                    <span className="rounded-full border border-line/60 bg-muted/50 px-3 py-1 text-[11px] text-soft">{m.body}</span>
                  ) : (
                    <>
                      {m.kind === "REPLY" && (
                        <div className="mb-0.5 text-[11px] font-medium text-soft">
                          {m.author} · support
                        </div>
                      )}
                      <div
                        className={
                          m.kind === "VISITOR"
                            ? "max-w-[82%] rounded-2xl rounded-br-sm px-3.5 py-2.5 text-[13.5px] leading-relaxed text-accent-fg"
                            : "max-w-[88%] rounded-2xl rounded-bl-sm border border-line/60 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink"
                        }
                        style={
                          m.kind === "VISITOR"
                            ? { background: "var(--color-accent)" }
                            : { background: "var(--color-muted, #f5f5f5)" }
                        }
                      >
                        {m.body}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </>
          ) : messages.length === 0 ? (
            <div className="space-y-5">
              <div className="space-y-1">
                <p className="text-[15px] font-semibold text-ink">👋 Hey there!</p>
                <p className="text-[13px] leading-relaxed text-soft">
                  I&apos;m Maya, your OnboardOps guide. Ask me anything — I know the docs inside out!
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-[11.5px] font-medium uppercase tracking-wide text-soft/70">Popular questions</p>
                {STARTERS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={loading}
                    onClick={() => void sendQuestion(q)}
                    className="flex w-full items-center justify-between rounded-xl border border-line/70 bg-surface px-3.5 py-2.5 text-left text-[13px] font-medium text-ink transition-all hover:border-accent/40 hover:bg-accent/5 hover:shadow-sm"
                  >
                    <span>{q}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-soft/50" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "flex justify-end" : "space-y-2"}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[82%] rounded-2xl rounded-br-sm px-3.5 py-2.5 text-[13.5px] leading-relaxed text-accent-fg"
                      : "max-w-[90%] rounded-2xl rounded-bl-sm border border-line/60 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink"
                  }
                  style={
                    m.role === "user"
                      ? { background: "var(--color-accent)" }
                      : { background: "var(--color-muted, #f5f5f5)" }
                  }
                >
                  {m.content}
                </div>
                {m.role === "assistant" && m.suggestedLinks && m.suggestedLinks.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pl-0.5">
                    {m.suggestedLinks.map((link) => {
                      const cls =
                        "inline-flex items-center gap-1.5 rounded-lg border border-line/70 bg-surface px-2.5 py-1.5 text-[12px] font-medium text-accent transition-all hover:border-accent/40 hover:bg-accent/5";
                      return link.href.startsWith("http") ? (
                        <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className={cls}>
                          <BookOpen className="h-3 w-3 shrink-0" />
                          <span>{link.label}</span>
                          <ArrowUpRight className="h-3 w-3 shrink-0 opacity-60" />
                        </a>
                      ) : (
                        <Link key={link.href} href={link.href} className={cls}>
                          <BookOpen className="h-3 w-3 shrink-0" />
                          <span>{link.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
                {m.role === "assistant" && m.escalate && !inTicket && !handoff && (
                  <button
                    type="button"
                    onClick={() => setHandoff(true)}
                    className="mt-1 rounded-lg border border-accent/30 bg-accent/8 px-3 py-1.5 text-[12.5px] font-medium text-accent transition-colors hover:bg-accent/15"
                  >
                    Talk to a person →
                  </button>
                )}
              </div>
            ))
          )}

          {/* Handoff form */}
          {handoff && !inTicket && (
            <form
              onSubmit={openTicket}
              className="space-y-3 rounded-2xl border border-line/60 bg-muted/40 p-4"
            >
              <div>
                <p className="text-[13.5px] font-semibold text-ink">Get in touch with us 👋</p>
                <p className="mt-0.5 text-[12.5px] text-soft">We&apos;ll reply here and by email — usually within a business day.</p>
              </div>
              <input
                className="input w-full"
                placeholder="Your name"
                required
                minLength={2}
                value={handoffForm.name}
                onChange={(e) => setHandoffForm({ ...handoffForm, name: e.target.value })}
              />
              <input
                className="input w-full"
                type="email"
                placeholder="Your email"
                required
                value={handoffForm.email}
                onChange={(e) => setHandoffForm({ ...handoffForm, email: e.target.value })}
              />
              <div className="flex gap-2">
                <button
                  className="btn-primary flex-1 justify-center"
                  disabled={loading}
                >
                  {loading ? "Opening…" : "Send to support"}
                </button>
                <button type="button" className="btn" onClick={() => setHandoff(false)}>Cancel</button>
              </div>
            </form>
          )}

          {/* Typing indicator */}
          {loading && !inTicket && (
            <div
              className="inline-flex items-center rounded-2xl rounded-bl-sm border border-line/60 px-3.5 py-2.5"
              style={{ background: "var(--color-muted, #f5f5f5)" }}
            >
              <TypingDots />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="space-y-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-[13px] text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/60 dark:text-rose-300">
              <p>{error}</p>
              {!inTicket && !handoff && (
                <button
                  type="button"
                  onClick={() => setHandoff(true)}
                  className="inline-flex items-center gap-1 rounded-lg bg-rose-100 px-2.5 py-1 text-[12px] font-medium text-rose-700 transition-colors hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-300"
                >
                  Talk to a person →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Input area */}
        {inTicket ? (
          ticketStatus?.movedToEmail ? (
            <div className="border-t border-line/60 p-3.5 text-center text-[12.5px] text-soft">
              Replies continue by email — check your inbox.
            </div>
          ) : (
            <form onSubmit={sendFollowUp} className="flex items-center gap-2 border-t border-line/60 p-3">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={3000}
                disabled={loading}
                placeholder="Write a reply to support…"
                aria-label="Reply to support"
                className="input flex-1"
              />
              <button
                type="submit"
                disabled={loading || input.trim().length < 1}
                aria-label="Send reply"
                className="btn-primary !px-2.5 shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          )
        ) : (
          <div className="border-t border-line/60">
            {!handoff && messages.length > 0 && (
              <div className="px-3 pt-2.5 text-center">
                <button
                  type="button"
                  onClick={() => setHandoff(true)}
                  className="text-[12px] font-medium text-soft underline underline-offset-2 transition-colors hover:text-ink"
                >
                  Rather talk to a person?
                </button>
              </div>
            )}
            <form
              onSubmit={(e) => { e.preventDefault(); void sendQuestion(input); }}
              className="flex items-center gap-2 p-3"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={600}
                disabled={loading}
                placeholder="Ask me anything…"
                aria-label="Ask a question"
                className="input flex-1"
              />
              <button
                type="submit"
                disabled={loading || input.trim().length < 2}
                aria-label="Send question"
                className="btn-primary !px-2.5 shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
