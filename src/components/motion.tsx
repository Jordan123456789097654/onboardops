"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

function useInView<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setSeen(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold, rootMargin: "0px 0px -6% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, seen] as const;
}

/** Fades content in when it scrolls into view. `group` lets children with class "item" stagger (set --i). */
export function Reveal({ children, className, delay = 0, from, group, as: Tag = "div" }: { children: React.ReactNode; className?: string; delay?: number; from?: "left" | "right"; group?: boolean; as?: "div" | "section" | "li" | "ol" | "ul" }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  return (
    <Tag ref={ref as never} style={{ "--d": `${delay}ms` } as React.CSSProperties} className={cn(group ? "reveal-group" : "reveal", from === "left" && "from-left", from === "right" && "from-right", seen && "in", className)}>
      {children}
    </Tag>
  );
}

/** Counts up to a number when visible. */
export function CountUp({ to, suffix = "", duration = 1100, className }: { to: number; suffix?: string; duration?: number; className?: string }) {
  const [ref, seen] = useInView<HTMLSpanElement>(0.3);
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!seen) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(to); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, to, duration]);
  return <span ref={ref} className={className}>{v}{suffix}</span>;
}

/** Progress bar that fills when visible. */
export function Bar({ pct, index = 0, className }: { pct: number; index?: number; className?: string }) {
  const [ref, seen] = useInView<HTMLDivElement>(0.3);
  return (
    <div ref={ref} style={{ "--i": index } as React.CSSProperties} className={cn("bar-wrap h-2 overflow-hidden rounded-full bg-muted", seen && "in", className)}>
      <div className="bar-fill h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Thin accent line showing how far down the page you are. */
export function ScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const h = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setP(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    h();
    window.addEventListener("scroll", h, { passive: true });
    window.addEventListener("resize", h);
    return () => { window.removeEventListener("scroll", h); window.removeEventListener("resize", h); };
  }, []);
  return <div aria-hidden className="pointer-events-none fixed left-0 top-0 z-[60] h-0.5 w-full origin-left bg-accent" style={{ transform: `scaleX(${p})` }} />;
}

export function useScrolled(px = 8) {
  const [s, setS] = useState(false);
  useEffect(() => {
    const h = () => setS(window.scrollY > px);
    h();
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, [px]);
  return s;
}
