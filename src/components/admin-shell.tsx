"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Briefcase,
  Building2,
  Eye,
  Handshake,
  History,
  Inbox,
  LayoutDashboard,
  Lightbulb,
  Mail,
  Map,
  Menu,
  MessageSquareQuote,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Brand, ThemeToggle } from "./ui";
import { cn } from "@/lib/utils";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: string;
  badge?: number;
  badgeTone?: "danger" | "warn" | "neutral";
  external?: boolean;
};

export type AdminNavGroup = {
  heading: string;
  items: AdminNavItem[];
};

const ICON_MAP = {
  dashboard: LayoutDashboard,
  status: Activity,
  workspaces: Building2,
  inbox: Inbox,
  feedback: Lightbulb,
  privacy: ShieldCheck,
  content: Sparkles,
  roadmap: Map,
  testimonials: MessageSquareQuote,
  partners: Handshake,
  careers: Briefcase,
  email: Mail,
  activity: History,
  staff: UsersRound,
  preview: Eye,
} as const;

export function AdminShell({
  groups,
  name,
  role,
  children,
}: {
  groups: AdminNavGroup[];
  name: string;
  role: string;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const flat = groups.flatMap((g) => g.items).filter((i) => !i.external);
  const active = [...flat]
    .sort((a, b) => b.href.length - a.href.length)
    .find((n) => path === n.href || (n.href !== "/admin" && path.startsWith(n.href + "/")))?.href;

  const side = (
    <nav className="flex h-full flex-col" aria-label="Staff console">
      <div className="flex h-14 items-center gap-2 border-b border-line px-4">
        <Link href="/admin" aria-label="Staff console home"><Brand /></Link>
        <span className="mono rounded border border-line px-1.5 py-0.5 text-[10px] font-medium text-soft">STAFF</span>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {groups.map((g) => (
          <div key={g.heading}>
            <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-soft/80">{g.heading}</div>
            <div className="space-y-0.5">
              {g.items.map((n) => {
                const Icon = ICON_MAP[n.icon as keyof typeof ICON_MAP] ?? LayoutDashboard;
                const on = !n.external && n.href === active;
                const badgeCls =
                  n.badgeTone === "danger"
                    ? "bg-rose-500 text-white"
                    : n.badgeTone === "warn"
                      ? "bg-amber-500/20 text-amber-800 dark:text-amber-300"
                      : "bg-muted text-soft";
                const content = (
                  <>
                    <Icon className={cn("h-4 w-4 shrink-0", on && "text-accent")} />
                    <span className="truncate">{n.label}</span>
                    {typeof n.badge === "number" && n.badge > 0 && (
                      <span className={cn("mono ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none", badgeCls)}>
                        {n.badge}
                      </span>
                    )}
                  </>
                );
                const cls = cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors",
                  on ? "bg-muted font-medium text-ink" : "text-soft hover:bg-muted/70 hover:text-ink"
                );
                if (n.external) {
                  return (
                    <a key={n.href} href={n.href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className={cls}>
                      {content}
                    </a>
                  );
                }
                return (
                  <Link key={n.href} href={n.href} onClick={() => setOpen(false)} aria-current={on ? "page" : undefined} className={cls}>
                    {content}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-1 border-t border-line p-3 text-xs">
        <div className="truncate text-[13px] font-medium">{name}</div>
        <div className="mono text-soft">{role}</div>
        <div className="flex items-center gap-3 pt-1.5">
          <Link href="/app" className="text-accent hover:underline">Customer app</Link>
          <span className="text-line">·</span>
          <Link href="/account" className="text-accent hover:underline">Account</Link>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-line bg-surface lg:block">{side}</aside>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dlg-overlay fixed inset-0 z-40 bg-black/40 lg:hidden" />
          <Dialog.Content aria-describedby={undefined} className="dlg-drawer-left fixed left-0 top-0 z-50 h-full w-72 border-r border-line bg-surface lg:hidden">
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            {side}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-canvas/95 px-4 backdrop-blur">
          <button className="btn !px-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-4 w-4" /></button>
          <span className="text-[13px] text-soft">OnboardOps staff console · Every action is audited.</span>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/admin/status" className="btn !h-8 !text-xs hidden sm:inline-flex">Status &amp; Incidents</Link>
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
