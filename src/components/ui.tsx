"use client";
import { createContext, useCallback, useContext, useEffect, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as RTabs from "@radix-ui/react-tabs";
import { CheckCircle2, Inbox, Monitor, Moon, Sun, X, XCircle } from "lucide-react";
import { statusTone, cn } from "@/lib/utils";

/* ---------- Toasts ---------- */
type Toast = { id: number; kind: "ok" | "error"; text: string };
const ToastCtx = createContext<(kind: Toast["kind"], text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="no-print pointer-events-none fixed bottom-4 right-4 z-[100] flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast-in pointer-events-auto flex items-start gap-2 rounded-lg border border-line bg-surface p-3 text-[13px] shadow-lg">
            {t.kind === "error" ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
            <span className="flex-1">{t.text}</span>
            <button aria-label="Dismiss" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="text-soft hover:text-ink"><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/** Runs a server action returning Result and toasts the outcome. */
export function useAction() {
  const toast = useToast();
  const [pending, start] = useTransition();
  function exec<T>(fn: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>, opts?: { success?: string; onOk?: (d: T) => void }) {
    start(async () => {
      const r = await fn();
      if (r.ok) {
        if (opts?.success) toast("ok", opts.success);
        opts?.onOk?.(r.data);
      } else toast("error", r.error);
    });
  }
  return { exec, pending };
}

/* ---------- Primitives ---------- */
export function Badge({ value, label }: { value: string; label?: string }) {
  return <span className={cn("badge mono", statusTone[value] ?? "border-line bg-muted text-soft")}>{(label ?? value).replace(/_/g, " ")}</span>;
}

export function Empty({ title, hint, children }: { title: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-line px-6 py-10 text-center">
      <Inbox className="mb-1 h-5 w-5 text-soft" aria-hidden />
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="max-w-md text-[13px] text-soft">{hint}</p>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

export function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}

/** Mark: an open loop (the employee lifecycle) closing into a check (certified). */
export function Logo({ size = 24, intro }: { size?: number; intro?: boolean }) {
  return (
    <svg className={cn("logo-mark", intro && "intro")} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="rgb(var(--accent))" />
      <g className="ring"><circle cx="16" cy="16" r="8.5" fill="none" stroke="rgb(var(--accent-fg))" strokeWidth="3" strokeLinecap="round" strokeDasharray="43 10.4" transform="rotate(-20 16 16)" /></g>
      <path className="tick" d="M12.2 16.4l2.7 2.7 6.4-7.1" fill="none" stroke="rgb(var(--accent-fg))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Mark plus wordmark. Use inside a Link. */
export function Brand({ size = 24, intro, className }: { size?: number; intro?: boolean; className?: string }) {
  return (
    <span className={cn("logo-link inline-flex items-center gap-2", className)}>
      <Logo size={size} intro={intro} />
      <span className="font-display text-[17px] font-semibold leading-none tracking-[-0.035em]">Onboard<span className="text-soft">Ops</span></span>
    </span>
  );
}

/* ---------- Theme: light / system / dark ---------- */
type Mode = "light" | "system" | "dark";

export function applyTheme(mode: Mode) {
  const dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

export function useThemeMode(): [Mode, (m: Mode) => void] {
  const [mode, setMode] = useState<Mode>("light");
  useEffect(() => {
    try {
      const s = localStorage.getItem("oo-theme");
      if (s === "light" || s === "dark" || s === "system") setMode(s);
    } catch {}
  }, []);
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = () => applyTheme("system");
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, [mode]);
  const set = (m: Mode) => {
    setMode(m);
    try { localStorage.setItem("oo-theme", m); } catch {}
    applyTheme(m);
  };
  return [mode, set];
}

export function ThemeToggle() {
  const [mode, set] = useThemeMode();
  const opts: { id: Mode; label: string; Icon: typeof Sun }[] = [{ id: "light", label: "Light", Icon: Sun }, { id: "system", label: "System", Icon: Monitor }, { id: "dark", label: "Dark", Icon: Moon }];
  const idx = opts.findIndex((o) => o.id === mode);
  return (
    <div role="radiogroup" aria-label="Color theme" className="relative inline-flex rounded-md border border-line bg-muted p-0.5">
      <span aria-hidden className="absolute left-0.5 top-0.5 h-7 w-7 rounded bg-surface shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)]" style={{ transform: `translateX(${idx * 28}px)` }} />
      {opts.map(({ id, label, Icon }) => (
        <button key={id} role="radio" aria-checked={mode === id} aria-label={`${label} theme`} title={`${label} theme`} onClick={() => set(id)}
          className={cn("relative z-10 flex h-7 w-7 items-center justify-center rounded text-soft transition-colors", mode === id ? "text-ink" : "hover:text-ink")}>
          <Icon className={cn("h-3.5 w-3.5 transition-transform duration-300", mode === id && "rotate-[360deg]")} />
        </button>
      ))}
    </div>
  );
}

/* ---------- Overlays (Radix: focus trap, scroll lock, Esc) ---------- */
export function Drawer({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dlg-overlay no-print fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content aria-describedby={undefined} className={cn("dlg-drawer no-print fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l border-line bg-surface shadow-2xl", wide ? "max-w-2xl" : "max-w-md")}>
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
            <Dialog.Title className="text-sm font-semibold">{title}</Dialog.Title>
            <Dialog.Close className="btn !px-2" aria-label="Close"><X className="h-4 w-4" /></Dialog.Close>
          </header>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dlg-overlay no-print fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content aria-describedby={undefined} className="dlg-modal fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-surface p-5 shadow-2xl">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-sm font-semibold">{title}</Dialog.Title>
            <Dialog.Close className="btn no-print !px-2" aria-label="Close"><X className="h-4 w-4" /></Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <RTabs.Root value={value} onValueChange={onChange}>
      <RTabs.List className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line" aria-label="Sections">
        {tabs.map((t) => (
          <RTabs.Trigger key={t.id} value={t.id} className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium transition-colors", value === t.id ? "border-accent text-accent" : "border-transparent text-soft hover:text-ink")}>
            {t.label}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
    </RTabs.Root>
  );
}

export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-[13px] text-soft">{sub}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
