"use client";
import { useEffect, useState } from "react";
import { Square, Volume2 } from "lucide-react";

/** Reads text out loud with the browser's own voice. Nothing is sent anywhere. Hidden if the browser can't speak. */
export function ReadAloud({ text, className }: { text: string; className?: string }) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => { if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); };
  }, []);

  if (!supported) return null;

  function toggle() {
    const s = window.speechSynthesis;
    if (speaking) { s.cancel(); setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(text.replace(/[*_#`>]/g, ""));
    u.lang = document.documentElement.lang || "en-US";
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    s.cancel();
    s.speak(u);
    setSpeaking(true);
  }

  return (
    <button type="button" onClick={toggle} className={className ?? "inline-flex items-center gap-1 text-[11.5px] text-soft hover:text-ink"} aria-label={speaking ? "Stop reading" : "Read aloud"}>
      {speaking ? <Square className="h-3 w-3" /> : <Volume2 className="h-3.5 w-3.5" />}
      {speaking ? "Stop" : "Read aloud"}
    </button>
  );
}
