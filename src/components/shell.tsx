"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Inbox, KeyRound, AlertOctagon, BarChart3, FileSignature, BookOpen, CalendarCheck, ClipboardList, LayoutDashboard, LogOut, Menu, Scale, ScrollText, Search, Settings, ShieldAlert, UserCircle, Users, Wrench } from "lucide-react";
import { Brand, ThemeToggle } from "./ui";
import { NotificationBell, type Notif } from "./bell";
import { FeedbackButton } from "./feedback-button";
import { logoutAction, switchWorkspaceAction } from "@/actions/auth";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string; group: string };

const icons: Record<string, typeof Users> = {
  "/app/overview": LayoutDashboard, "/app/directory": Users, "/app/checklists": ClipboardList, "/app/training": BookOpen, "/app/training/compliance": CalendarCheck,
  "/app/training/builder": Wrench, "/app/infractions": ShieldAlert, "/app/audit": ScrollText, "/app/incidents": AlertOctagon, "/app/requests": Inbox, "/app/access": KeyRound, "/app/policies": FileSignature, "/app/reports": BarChart3, "/app/settings": Settings, "/app/my-portal": UserCircle,
};

export function Shell({ notifications, nav, workspaces, activeWorkspaceId, userName, avatarUrl, role, children }: { notifications: { unread: number; items: Notif[] }; nav: NavItem[]; workspaces: { id: string; name: string }[]; activeWorkspaceId: string; userName: string; avatarUrl?: string | null; role: string; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [palette, setPalette] = useState(false);
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); setQ(""); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  useEffect(() => { setMenu(false); }, [path]);

  const results = useMemo(() => nav.filter((n) => n.label.toLowerCase().includes(q.toLowerCase())), [nav, q]);
  const groups = Array.from(new Set(nav.map((n) => n.group)));
  const activeHref = [...nav].sort((a, b) => b.href.length - a.href.length).find((n) => path === n.href || path.startsWith(n.href + "/"))?.href;
  const initials = userName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const current = nav.find((n) => n.href === activeHref);

  const sidebar = (
    <nav className="flex h-full flex-col" aria-label="Main">
      <Link href="/" className="flex h-14 items-center border-b border-line px-4"><Brand /></Link>
      <div className="border-b border-line p-3">
        <label className="label" htmlFor="ws">Workspace</label>
        <select id="ws" className="input" value={activeWorkspaceId} onChange={(e) => switchWorkspaceAction(e.target.value)}>
          {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto p-3">
        {groups.map((g) => (
          <div key={g}>
            <div className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wider text-soft">{g}</div>
            {nav.filter((n) => n.group === g).map((n) => {
              const Icon = icons[n.href] ?? Scale;
              const active = n.href === activeHref;
              return (
                <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={cn("group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-all duration-200 hover:translate-x-0.5", active ? "bg-muted font-medium text-ink" : "text-soft hover:bg-muted hover:text-ink")}>
                  <Icon className={cn("h-4 w-4", active && "text-accent")} />{n.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
      <div className="space-y-2 border-t border-line p-3">
        <div className="flex items-center gap-2.5">
          <Link href="/account" aria-label="Account settings" className="shrink-0">{avatarUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={avatarUrl} alt="" className="h-8 w-8 rounded-full border border-line object-cover" /> : <span className="mono flex h-8 w-8 items-center justify-center rounded-full border border-line bg-muted text-xs">{initials}</span>}</Link>
          <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium">{userName}</div><div className="mono text-[11px] text-soft">{role}</div></div>
          <Link href="/account" className="text-xs text-accent">Account</Link>
        </div>
        <form action={logoutAction}><button className="btn w-full"><LogOut className="h-3.5 w-3.5" />Sign out</button></form>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="no-print sticky top-0 hidden h-screen border-r border-line bg-surface lg:block">{sidebar}</aside>
      <Dialog.Root open={menu} onOpenChange={setMenu}>
        <Dialog.Portal>
          <Dialog.Overlay className="dlg-overlay no-print fixed inset-0 z-40 bg-black/40 lg:hidden" />
          <Dialog.Content aria-describedby={undefined} className="dlg-drawer-left no-print fixed left-0 top-0 z-50 h-full w-72 border-r border-line bg-surface lg:hidden">
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            {sidebar}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <div className="min-w-0">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-canvas/95 px-4 backdrop-blur-none">
          <button className="btn !px-2 lg:hidden" onClick={() => setMenu(true)} aria-label="Open menu"><Menu className="h-4 w-4" /></button>
          <span className="hidden text-[13px] text-soft sm:block">{current?.group} <span className="mx-1">/</span> <span className="text-ink">{current?.label}</span></span>
          <button onClick={() => setPalette(true)} className="btn ml-auto w-56 justify-between text-soft sm:w-72"><span className="flex items-center gap-2"><Search className="h-3.5 w-3.5" />Jump to…</span><kbd className="mono text-[10px]">Ctrl K</kbd></button>
          <FeedbackButton />
          <NotificationBell items={notifications.items} unread={notifications.unread} />
          <ThemeToggle />
        </header>
        <main className="mx-auto max-w-[1400px] p-4 sm:p-6">{children}</main>
      </div>
      <Dialog.Root open={palette} onOpenChange={setPalette}>
        <Dialog.Portal>
          <Dialog.Overlay className="dlg-overlay no-print fixed inset-0 z-[60] bg-black/40" />
          <Dialog.Content aria-describedby={undefined} className="dlg-palette no-print fixed left-1/2 top-[15vh] z-[61] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl">
            <Dialog.Title className="sr-only">Command palette</Dialog.Title>
            <input autoFocus className="h-12 w-full border-b border-line bg-surface px-4 text-sm outline-none" placeholder="Go to…" value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && results[0]) { router.push(results[0].href); setPalette(false); } }} />
            <ul className="max-h-72 overflow-y-auto p-1">
              {results.length === 0 && <li className="px-3 py-2 text-[13px] text-soft">No matches</li>}
              {results.map((r) => (<li key={r.href}><button className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-[13px] hover:bg-muted" onClick={() => { router.push(r.href); setPalette(false); }}>{r.label}<span className="text-xs text-soft">{r.group}</span></button></li>))}
            </ul>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
