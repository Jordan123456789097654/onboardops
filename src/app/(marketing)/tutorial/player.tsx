"use client";
import { useRef, useState } from "react";

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

export function TutorialPlayer() {
  const ref = useRef<HTMLVideoElement>(null);
  const [now, setNow] = useState(0);
  const active = chapters.reduce((a, c, i) => (now >= c.t - 0.5 ? i : a), -1);
  const go = (t: number) => { const v = ref.current; if (!v) return; v.currentTime = t; void v.play().catch(() => { /* user can press play */ }); v.scrollIntoView({ behavior: "smooth", block: "nearest" }); };
  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-line bg-black">
        <video ref={ref} className="block aspect-video w-full" controls preload="metadata" poster="/tutorial/workspace-setup-poster.jpg" playsInline onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}>
          <source src="/tutorial/workspace-setup.mp4" type="video/mp4" />
          Your browser cannot play this video. <a href="/tutorial/workspace-setup.mp4">Download it</a>.
        </video>
      </div>
      <p className="mt-2 text-[12px] text-soft">About 2 minutes. The captions are on screen, so it works with the sound off.</p>

      <h2 className="mt-10 text-lg font-semibold">Chapters</h2>
      <ol className="mt-3 divide-y divide-line rounded-lg border border-line">
        {chapters.map((c, i) => (
          <li key={c.t}>
            <button type="button" onClick={() => go(c.t)} className={`flex w-full items-start gap-4 px-4 py-3 text-left transition-colors hover:bg-muted ${i === active ? "bg-muted" : ""}`} aria-current={i === active ? "true" : undefined}>
              <span className="mono mt-0.5 w-10 shrink-0 text-xs text-accent">{fmt(c.t)}</span>
              <span><span className="block text-[14px] font-medium">{i + 1}. {c.label}</span><span className="block text-[13px] text-soft">{c.note}</span></span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
