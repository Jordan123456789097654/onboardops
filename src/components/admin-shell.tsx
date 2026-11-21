"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, History, Inbox, LayoutDashboard, Lightbulb, Mail, Menu, ShieldCheck, UsersRound } from "lucide-react";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Brand, ThemeToggle } from "./ui";
import { cn } from "@/lib/utils";

const icons = { "/admin": LayoutDashboard, "/admin/inbox": Inbox, "/admin/feedback": Lightbulb, "/admin/privacy": ShieldCheck, "/admin/workspaces": Building2, "/admin/email": Mail, "/admin/activity": History, "/admin/staff": UsersRound } as const;

export function AdminShell({ nav, name, role, children }: { nav: { href: string; label: string }[]; name: string; role: string; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = [...nav].sort((a, b) => b.href.length - a.href.length).find((n) => path === n.href || (n.href !== "/admin" && path.startsWith(n.href + "/")))?.href;
  const side = (
    <nav className="flex h-full flex-col" aria-label="Staff console">
      <div className="flex h-14 items-center gap-2 border-b border-line px-4"><Link href="/admin" aria-label="Staff console home"><Brand /></Link><span className="mono rounded border border-line px-1 text-[10px] text-soft">STAFF</span></div>
      <div className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {nav.map((n) => { const Icon = icons[n.href as keyof typeof icons] ?? LayoutDashboard; const on = n.href === active; return (
          <Link key={n.href} href={n.href} onClick={() => setOpen(false)} aria-current={on ? "page" : undefined} className={cn("flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors", on ? "bg-muted font-medium text-ink" : "text-soft hover:bg-muted hover:text-ink")}><Icon className={cn("h-4 w-4", on && "text-accent")} />{n.label}</Link>
        ); })}
      </div>
      <div className="space-y-1 border-t border-line p-3 text-xs"><div className="truncate text-[13px] font-medium">{name}</div><div className="mono text-soft">{role}</div><Link href="/app" className="mt-2 block text-accent">Open customer app</Link><Link href="/account" className="block text-accent">Account settings</Link></div>
    </nav>
  );
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-line bg-surface lg:block">{side}</aside>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dlg-overlay fixed inset-0 z-40 bg-black/40 lg:hidden" />
          <Dialog.Content aria-describedby={undefined} className="dlg-drawer-left fixed left-0 top-0 z-50 h-full w-72 border-r border-line bg-surface lg:hidden"><Dialog.Title className="sr-only">Navigation</Dialog.Title>{side}</Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-canvas px-4">
          <button className="btn !px-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-4 w-4" /></button>
          <span className="text-[13px] text-soft">OnboardOps staff console. Every action here is logged.</span>
          <div className="ml-auto"><ThemeToggle /></div>
        </header>
        <main className="mx-auto max-w-[1400px] p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
