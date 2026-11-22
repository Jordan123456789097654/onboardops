"use client";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { entries } from "@/lib/changelog";
import { Modal } from "./ui";

const KEY = "oo-seen-version";
const SHOWN = 4;

/** Header button with the latest releases. A dot shows while the newest version has not been opened. */
export function WhatsNewButton() {
  const latest = entries[0]?.v ?? "";
  const [open, setOpen] = useState(false);
  const [unseen, setUnseen] = useState(false);
  useEffect(() => { try { setUnseen(!!latest && localStorage.getItem(KEY) !== latest); } catch { /* storage blocked: no dot */ } }, [latest]);
  const show = () => { setOpen(true); setUnseen(false); try { localStorage.setItem(KEY, latest); } catch { /* ignore */ } };
  return (
    <>
      <button className="btn relative" onClick={show} aria-label={unseen ? "What's new (unread)" : "What's new"} title="What's new">
        <Sparkles className="h-4 w-4" /><span className="hidden xl:inline">What&apos;s new</span>
        {unseen && <i className="absolute -right-0.5 -top-0.5 block h-2 w-2 rounded-full bg-accent ring-2 ring-surface" aria-hidden />}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="What's new in OnboardOps">
        <div className="space-y-5">
          {entries.slice(0, SHOWN).map((e, i) => (
            <section key={e.v}>
              <div className="flex items-baseline gap-2">
                <h3 className="text-[13px] font-semibold">{e.highlight ?? `Version ${e.v}`}</h3>
                {i === 0 && <span className="mono rounded border border-line px-1.5 text-[10px] uppercase text-soft">Latest</span>}
              </div>
              <div className="mono mt-0.5 text-[11px] text-soft">v{e.v} · {e.date}</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-soft">
                {e.items.slice(0, 3).map((t) => <li key={t}>{t.length > 160 ? `${t.slice(0, 157).trimEnd()}...` : t}</li>)}
              </ul>
            </section>
          ))}
          <a href="/changelog" target="_blank" rel="noopener noreferrer" className="inline-block text-[13px] text-accent underline underline-offset-2">See the full changelog</a>
        </div>
      </Modal>
    </>
  );
}
