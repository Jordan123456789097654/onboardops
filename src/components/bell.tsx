"use client";
import { useRouter } from "next/navigation";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { Bell, CheckCheck } from "lucide-react";
import { markNotificationsReadAction } from "@/actions/notifications";
import { fmtDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type Notif = { id: string; title: string; body: string; href: string | null; read: boolean; at: string };

export function NotificationBell({ items, unread }: { items: Notif[]; unread: number }) {
  const router = useRouter();
  return (
    <Menu.Root>
      <Menu.Trigger className="btn relative !px-2" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
        <Bell className="h-4 w-4" />
        {unread > 0 && <span className="anim-pop mono absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-fg">{unread > 9 ? "9+" : unread}</span>}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={8} className="dlg-palette z-[70] w-[22rem] max-w-[calc(100vw-1.5rem)] !translate-x-0 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl" style={{ animationName: "fade-up" }}>
          <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
            <span className="text-sm font-semibold">Notifications</span>
            <button className="flex items-center gap-1 text-xs text-accent disabled:text-soft" disabled={!unread} onClick={() => markNotificationsReadAction().then(() => router.refresh())}><CheckCheck className="h-3.5 w-3.5" />Mark all read</button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && <p className="px-4 py-8 text-center text-[13px] text-soft">You are all caught up.</p>}
            {items.map((n) => (
              <Menu.Item key={n.id} onSelect={() => { if (!n.read) markNotificationsReadAction([n.id]); if (n.href) router.push(n.href); router.refresh(); }} className="flex cursor-pointer gap-2.5 border-b border-line px-3 py-2.5 outline-none last:border-0 data-[highlighted]:bg-muted">
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-accent")} />
                <span className="min-w-0 flex-1"><span className={cn("block text-[13px]", !n.read && "font-medium")}>{n.title}</span>{n.body && <span className="block truncate text-xs text-soft">{n.body}</span>}<span className="mono text-[11px] text-soft">{fmtDateTime(n.at)}</span></span>
              </Menu.Item>
            ))}
          </div>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
