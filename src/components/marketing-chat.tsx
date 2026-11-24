"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Loader2, MessageSquare, RotateCcw, Send, Sparkles, X } from "lucide-react";

type SuggestedLink = { label: string; href: string };
type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestedLinks?: SuggestedLink[];
};

const STARTERS = [
  "How does pricing work?",
  "How do employee quizzes & certifications work?",
  "How is our data encrypted?",
] as const;

export function MarketingChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, open]);

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
      const payloadMessages = nextHistory.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: payloadMessages }),
      });
      const data = (await res.json().catch(() => null)) as
        | { reply?: string; suggestedLinks?: SuggestedLink[]; error?: string }
        | null;

      if (!res.ok || !data?.reply) {
        setError(data?.error ?? "Unable to answer right now. Try browsing the help center or contacting support.");
        return;
      }

      const assistantMsg: ChatMsg = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.reply,
        suggestedLinks: Array.isArray(data.suggestedLinks) ? data.suggestedLinks : [],
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setError("Network error while reaching the assistant. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void sendQuestion(input);
  }

  function resetChat() {
    setMessages([]);
    setError(null);
    setInput("");
    inputRef.current?.focus();
  }

  if (!open) {
    return (
      <div className="no-print fixed bottom-4 right-4 z-40">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ask OnboardOps"
          className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-[13px] font-medium text-ink shadow-lg transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-xl"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-fg">
            <Sparkles className="h-3 w-3" />
          </span>
          <span>Ask OnboardOps</span>
        </button>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Ask OnboardOps"
      className="no-print fixed bottom-4 right-4 z-50 flex w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-line bg-surface px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-accent-fg">
            <MessageSquare className="h-3.5 w-3.5" />
          </span>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold text-ink">Ask OnboardOps</div>
            <div className="text-[11px] text-soft">Public help docs &amp; pricing</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={resetChat}
              disabled={loading}
              title="Start a new chat"
              aria-label="Start a new chat"
              className="btn !h-7 !px-2 text-soft"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close chat"
            className="btn !h-7 !px-2 text-soft"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="border-b border-line bg-muted/60 px-3.5 py-1.5 text-[11px] text-soft">
        Answers from public help docs &amp; pricing only — no account data.
      </div>

      <div ref={scrollRef} className="max-h-[360px] min-h-[220px] flex-1 space-y-3 overflow-y-auto p-3.5">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-[13px] leading-relaxed text-soft">
              Have a question about OnboardOps features, training quizzes, encryption, or beta pricing? Pick a question or ask below.
            </p>
            <div className="space-y-1.5">
              {STARTERS.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={loading}
                  onClick={() => void sendQuestion(q)}
                  className="block w-full rounded-lg border border-line bg-surface px-3 py-2 text-left text-[12.5px] font-medium text-ink transition-colors hover:border-accent/50 hover:bg-muted"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : "space-y-1.5"}>
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] rounded-xl rounded-br-sm bg-accent px-3 py-2 text-[13px] leading-relaxed text-accent-fg"
                    : "max-w-[92%] rounded-xl rounded-bl-sm border border-line bg-muted/60 px-3 py-2 text-[13px] leading-relaxed text-ink whitespace-pre-wrap"
                }
              >
                {m.content}
              </div>
              {m.role === "assistant" && m.suggestedLinks && m.suggestedLinks.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {m.suggestedLinks.map((link) => {
                    const external = link.href.startsWith("http");
                    const cls =
                      "inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-[11.5px] font-medium text-accent transition-colors hover:border-accent/40 hover:bg-muted";
                    return external ? (
                      <a
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cls}
                      >
                        <BookOpen className="h-3 w-3 shrink-0" />
                        <span>{link.label}</span>
                        <ArrowUpRight className="h-3 w-3 shrink-0" />
                      </a>
                    ) : (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setOpen(false)}
                        className={cls}
                      >
                        <BookOpen className="h-3 w-3 shrink-0" />
                        <span>{link.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}

        {loading && (
          <div className="inline-flex items-center gap-2 rounded-xl border border-line bg-muted/60 px-3 py-2 text-[12.5px] text-soft">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
            <span>Checking help docs…</span>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-[12px] text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
            <p>{error}</p>
            <div className="mt-1.5 flex items-center gap-3 text-[11.5px] font-medium underline">
              <Link href="/support" onClick={() => setOpen(false)}>Help center</Link>
              <Link href="/contact" onClick={() => setOpen(false)}>Contact support</Link>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-line bg-surface p-2.5">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={600}
          disabled={loading}
          placeholder="Ask about pricing, quizzes, security…"
          aria-label="Ask a question about OnboardOps"
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
  );
}
