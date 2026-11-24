"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

type Issue = { slug: string; title: string; summary: string; category: string };
const KEY = "oo-newsletter-seen";

/** A small card shown once per browser for each newly published newsletter issue. */
export function NewsletterAnnouncement({ issue }: { issue: Issue | null }) {
  const path = usePathname() ?? "";
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!issue || path.startsWith("/newsletter")) return;
    let seen: string | null = null;
    try { seen = localStorage.getItem(KEY); } catch { /* storage blocked */ }
    if (seen === issue.slug) return;
    const t = setTimeout(() => setShow(true), 800);
    return () => clearTimeout(t);
  }, [issue, path]);

  function close() {
    setShow(false);
    try { if (issue) localStorage.setItem(KEY, issue.slug); } catch { /* ignore */ }
  }

  if (!issue || !show) return null;
  return (
    <div className="no-print fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={close}>
      <div role="dialog" aria-modal="true" aria-label="New newsletter issue" onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md rounded-2xl border border-line bg-surface p-6 text-center shadow-2xl">
        <button type="button" onClick={close} aria-label="Dismiss" className="absolute right-3 top-3 rounded p-1 text-soft hover:text-ink"><X className="h-4 w-4" /></button>
        <p className="eyebrow">New in the newsletter · {issue.category}</p>
        <h2 className="mt-2 text-xl font-semibold leading-snug">{issue.title}</h2>
        {issue.summary && <p className="mt-2 text-[14px] text-soft">{issue.summary}</p>}
        <div className="mt-5 flex justify-center gap-2">
          <Link href={`/newsletter/${issue.slug}`} onClick={close} className="btn-primary">Read it</Link>
          <button type="button" onClick={close} className="btn">Not now</button>
        </div>
      </div>
    </div>
  );
}
