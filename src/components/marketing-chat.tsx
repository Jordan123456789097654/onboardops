"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Loader2, MessageCircle, RotateCcw, Send, User, X } from "lucide-react";
import { createChatTicketAction, getChatTicketAction, sendChatFollowUpAction } from "@/actions/chat-support";

type SuggestedLink = { label: string; href: string };
type ChatMsg = { id: string; role: "user" | "assistant"; content: string; suggestedLinks?: SuggestedLink[]; escalate?: boolean };
type TicketMsg = { id: string; kind: string; author: string; body: string; at: string };
type Ticket = { id: string; token: string; ref: string };

const STARTERS = ["How does pricing work?", "How do quizzes and certifications work?", "How is our data encrypted?"] as const;
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
  } catch {
    // Private mode or blocked storage: the conversation still works for this visit.
  }
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

  // Restore an open ticket from this browser.
  useEffect(() => {
    const t = loadTicket();
    if (t) setTicket(t);
  }, []);

  // While a ticket is open, pull new replies every 15 seconds.
  useEffect(() => {
    if (!ticket || !open) return;
    let stop = false;
    const pull = async () => {
      try {
        const r = await getChatTicketAction({ id: ticket.id, token: ticket.token });
        if (stop) return;
        if (!r.ok) {
          setError(r.error);
          return;
        }
        setTicketMsgs(r.data.messages);
        setTicketStatus({ movedToEmail: r.data.movedToEmail, status: r.data.status });
      } catch {
        // Offline: keep what is on screen.
      }
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
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: data.reply!, suggestedLinks: data.suggestedLinks ?? [], escalate: !!data.escalate }]);
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
      const r = await createChatTicketAction({ name: handoffForm.name, email: handoffForm.email, message: lastQuestion || "Asked to speak with support from the website chat.", transcript: transcriptText() });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const t: Ticket = { id: r.data.id, token: r.data.token, ref: r.data.ref };
      saveTicket(t);
      setTicket(t);
      setHandoff(false);
    } catch {
      setError("We couldn't open a ticket just now. Please try again or use the contact page.");
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
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setInput("");
      setTicketMsgs((prev) => [...prev, { id: `v-${Date.now()}`, kind: "VISITOR", author: "You", body: text, at: new Date().toISOString() }]);
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
      <div className="no-print fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Chat with OnboardOps"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-xl transition-transform hover:scale-105"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      </div>
    );
  }

  const inTicket = !!ticket;
  const replyingTo = ticketMsgs.find((m) => m.kind === "REPLY")?.author;

  return (
    <div
      role="dialog"
      aria-label="OnboardOps chat"
      className="no-print fixed bottom-4 right-4 z-50 flex h-[min(560px,calc(100vh-2rem))] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-line bg-surface px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-fg">
            {inTicket ? <User className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
          </span>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold text-ink">{inTicket ? (replyingTo ? `Support: ${replyingTo}` : "OnboardOps support") : "OnboardOps assistant"}</div>
            <div className="text-[11px] text-soft">{inTicket ? `Ticket #${ticket!.ref}` : "Friendly answers from our help center"}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {(messages.length > 0 || inTicket) && (
            <button type="button" onClick={startOver} title="Start over" aria-label="Start over" className="btn !h-7 !px-2 text-soft">
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="btn !h-7 !px-2 text-soft">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3.5">
        {inTicket ? (
          <>
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-[12px] text-soft">
              {ticketStatus?.movedToEmail
                ? "This conversation continues by email. Check your inbox for replies."
                : "A support teammate will reply here, and also by email. Their name shows above each reply."}
            </p>
            {ticketMsgs.length === 0 && <p className="text-[12.5px] text-soft">Your message is with support. Waiting for a reply.</p>}
            {ticketMsgs.map((m) => (
              <div key={m.id} className={m.kind === "VISITOR" ? "flex justify-end" : m.kind === "SYSTEM" ? "text-center text-[11.5px] text-soft" : "space-y-1"}>
                {m.kind === "SYSTEM" ? (
                  <span>{m.body}</span>
                ) : (
                  <>
                    {m.kind === "REPLY" && <div className="text-[11px] font-medium text-soft">{m.author} · support</div>}
                    <div className={m.kind === "VISITOR" ? "max-w-[85%] rounded-xl rounded-br-sm bg-accent px-3 py-2 text-[13px] text-accent-fg" : "max-w-[92%] whitespace-pre-wrap rounded-xl rounded-bl-sm border border-line bg-muted/60 px-3 py-2 text-[13px] text-ink"}>
                      {m.body}
                    </div>
                  </>
                )}
              </div>
            ))}
          </>
        ) : messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-[13px] leading-relaxed text-soft">Hi there! Ask anything about OnboardOps, or pick a question below.</p>
            <div className="space-y-1.5">
              {STARTERS.map((q) => (
                <button key={q} type="button" disabled={loading} onClick={() => void sendQuestion(q)} className="block w-full rounded-lg border border-line bg-surface px-3 py-2 text-left text-[12.5px] font-medium text-ink transition-colors hover:border-accent/50 hover:bg-muted">
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : "space-y-1.5"}>
              <div className={m.role === "user" ? "max-w-[85%] rounded-xl rounded-br-sm bg-accent px-3 py-2 text-[13px] leading-relaxed text-accent-fg" : "max-w-[92%] whitespace-pre-wrap rounded-xl rounded-bl-sm border border-line bg-muted/60 px-3 py-2 text-[13px] leading-relaxed text-ink"}>
                {m.content}
              </div>
              {m.role === "assistant" && m.suggestedLinks && m.suggestedLinks.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {m.suggestedLinks.map((link) => {
                    const cls = "inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-[11.5px] font-medium text-accent transition-colors hover:border-accent/40 hover:bg-muted";
                    return link.href.startsWith("http") ? (
                      <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className={cls}><BookOpen className="h-3 w-3 shrink-0" /><span>{link.label}</span><ArrowUpRight className="h-3 w-3 shrink-0" /></a>
                    ) : (
                      <Link key={link.href} href={link.href} className={cls}><BookOpen className="h-3 w-3 shrink-0" /><span>{link.label}</span></Link>
                    );
                  })}
                </div>
              )}
              {m.role === "assistant" && m.escalate && !inTicket && !handoff && (
                <button type="button" onClick={() => setHandoff(true)} className="btn mt-1 text-[12px]">Talk to a person</button>
              )}
            </div>
          ))
        )}

        {handoff && !inTicket && (
          <form onSubmit={openTicket} className="space-y-2 rounded-lg border border-line p-3">
            <p className="text-[12.5px] text-ink">Leave your name and email and a person will reply here and by email.</p>
            <input className="input w-full" placeholder="Your name" required minLength={2} value={handoffForm.name} onChange={(e) => setHandoffForm({ ...handoffForm, name: e.target.value })} />
            <input className="input w-full" type="email" placeholder="Your email" required value={handoffForm.email} onChange={(e) => setHandoffForm({ ...handoffForm, email: e.target.value })} />
            <div className="flex gap-2">
              <button className="btn-primary" disabled={loading}>{loading ? "Opening…" : "Open ticket"}</button>
              <button type="button" className="btn" onClick={() => setHandoff(false)}>Not now</button>
            </div>
          </form>
        )}

        {loading && !inTicket && (
          <div className="inline-flex items-center gap-2 rounded-xl border border-line bg-muted/60 px-3 py-2 text-[12.5px] text-soft">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
            <span>Thinking…</span>
          </div>
        )}
        {error && <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-[12px] text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">{error}</div>}
      </div>

      {inTicket ? (
        ticketStatus?.movedToEmail ? (
          <div className="border-t border-line p-3 text-center text-[12px] text-soft">Replies continue by email.</div>
        ) : (
          <form onSubmit={sendFollowUp} className="flex items-center gap-2 border-t border-line p-2.5">
            <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} maxLength={3000} disabled={loading} placeholder="Write a reply to support…" aria-label="Reply to support" className="input flex-1" />
            <button type="submit" disabled={loading || input.trim().length < 1} aria-label="Send reply" className="btn-primary !px-2.5 shrink-0"><Send className="h-3.5 w-3.5" /></button>
          </form>
        )
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); void sendQuestion(input); }} className="flex items-center gap-2 border-t border-line p-2.5">
          <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} maxLength={600} disabled={loading} placeholder="Ask a question…" aria-label="Ask a question" className="input flex-1" />
          <button type="submit" disabled={loading || input.trim().length < 2} aria-label="Send question" className="btn-primary !px-2.5 shrink-0"><Send className="h-3.5 w-3.5" /></button>
        </form>
      )}
    </div>
  );
}
