"use client";
import { useState } from "react";

export const VIDEO_ID = "Ugwfta-aG3c";
export const VIDEO_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;

export const chapters: { t: number; label: string; note: string }[] = [
  { t: 3, label: "Set up your workspace", note: "Departments, your team and starter content in the setup wizard." },
  { t: 34, label: "Invite your staff", note: "Share your sign-in page and send invites from Staff Accounts." },
  { t: 47, label: "Build your first course", note: "Lessons, a quiz and publishing in the Training Academy." },
  { t: 66, label: "Set your discipline rules", note: "Auto-suspend points, the remedial course and strike decay." },
  { t: 79, label: "Connect Discord alerts", note: "Paste a webhook for Discord, Slack or Teams." },
  { t: 91, label: "Features and roles", note: "Turn features on or off and choose what each role can do." },
  { t: 101, label: "Your own domain", note: "Point your staff sign-in at your own address." },
];
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** The YouTube player only loads after a click, so visiting the page does not contact YouTube. */
export function TutorialPlayer() {
  const [start, setStart] = useState<number | null>(null);
  const play = (t: number) => setStart(t);
  return (
    <div>
      <div className="relative aspect-video overflow-hidden rounded-lg border border-line bg-black">
        {start === null ? (
          <button type="button" onClick={() => play(0)} className="group absolute inset-0 block h-full w-full" aria-label="Play the video tutorial">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/tutorial/workspace-setup-poster.jpg" alt="" className="h-full w-full object-cover" />
            <span className="absolute inset-0 grid place-items-center bg-black/30 transition-colors group-hover:bg-black/20">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-accent text-accent-fg"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg></span>
            </span>
          </button>
        ) : (
          <iframe key={start} className="absolute inset-0 h-full w-full" src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0&start=${start}`} title="OnboardOps video tutorial: set up your workspace" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        )}
      </div>
      <p className="mt-2 text-[12px] text-soft">About 2 minutes. Captions are on screen, so it works with the sound off. The video plays from YouTube when you press play. <a href={VIDEO_URL} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">Watch on YouTube</a></p>

      <h2 className="mt-10 text-lg font-semibold">Chapters</h2>
      <ol className="mt-3 divide-y divide-line rounded-lg border border-line">
        {chapters.map((c, i) => (
          <li key={c.t}>
            <button type="button" onClick={() => play(c.t)} className="flex w-full items-start gap-4 px-4 py-3 text-left transition-colors hover:bg-muted">
              <span className="mono mt-0.5 w-10 shrink-0 text-xs text-accent">{fmt(c.t)}</span>
              <span><span className="block text-[14px] font-medium">{i + 1}. {c.label}</span><span className="block text-[13px] text-soft">{c.note}</span></span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
