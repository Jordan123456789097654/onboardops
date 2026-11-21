"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { ArrowRight, ChevronDown, Menu as MenuIcon, X } from "lucide-react";
import { Brand, ThemeToggle } from "./ui";
import { ScrollProgress, useScrolled } from "./motion";
import { cn } from "@/lib/utils";

const main = [
  { href: "/why", label: "Why OnboardOps" },
  { href: "/features", label: "Product" },
  { href: "/solutions", label: "Solutions" },
  { href: "/pricing", label: "Pricing" },
];
const more = [
  { href: "/security", label: "Security", hint: "How records are protected" },
  { href: "/support", label: "Help center", hint: "Guides and support" },
  { href: "/changelog", label: "Changelog", hint: "What's new" },
  { href: "/faq", label: "FAQ", hint: "Common questions" },
  { href: "/about", label: "About", hint: "Who we are" },
];

export function MarketingNav({ signedIn }: { signedIn: boolean }) {
  const path = usePathname();
  const scrolled = useScrolled(8);
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const inMore = more.some((m) => path === m.href || path.startsWith(m.href + "/"));
  const cta = <Link href={signedIn ? "/app/overview" : "/register"} className="btn-primary group">Open Web App<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></Link>;
  const link = (l: { href: string; label: string }) => (
    <Link key={l.href} href={l.href} className={cn("relative rounded-md px-2.5 py-1.5 transition-colors hover:text-ink", path === l.href ? "font-medium text-ink" : "text-soft")}>
      {l.label}
      <span className={cn("absolute inset-x-2.5 -bottom-0.5 h-0.5 origin-left rounded bg-accent transition-transform duration-300", path === l.href ? "scale-x-100" : "scale-x-0")} />
    </Link>
  );
  return (
    <header className={cn("sticky top-0 z-40 border-b bg-canvas transition-[box-shadow,border-color,background-color] duration-300", scrolled ? "border-line shadow-[0_8px_24px_-16px_rgba(9,9,11,0.25)]" : "border-transparent")}>
      <ScrollProgress />
      <div className={cn("mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 transition-[height] duration-300", scrolled ? "h-14" : "h-16")}>
        <Link href="/" aria-label="OnboardOps home"><Brand intro /></Link>
        <nav className="hidden items-center gap-1 text-[13px] lg:flex" aria-label="Primary">
          {main.map(link)}
          <Menu.Root>
            <Menu.Trigger className={cn("flex items-center gap-1 rounded-md px-2.5 py-1.5 outline-none transition-colors hover:text-ink data-[state=open]:text-ink", inMore ? "font-medium text-ink" : "text-soft")}>Resources <ChevronDown className="h-3.5 w-3.5" /></Menu.Trigger>
            <Menu.Portal>
              <Menu.Content align="start" sideOffset={8} className="dlg-palette z-[70] w-64 !translate-x-0 overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-2xl" style={{ animationName: "fade-up" }}>
                {more.map((m) => <Menu.Item key={m.href} asChild><Link href={m.href} className="block rounded-md px-3 py-2 outline-none data-[highlighted]:bg-muted"><div className="text-[13px] font-medium">{m.label}</div><div className="text-xs text-soft">{m.hint}</div></Link></Menu.Item>)}
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {!signedIn && <Link href="/login" className="btn hidden sm:inline-flex">Sign in</Link>}
          <span className="hidden sm:block">{cta}</span>
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger className="btn !px-2 lg:hidden" aria-label="Open menu"><MenuIcon className="h-4 w-4" /></Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="dlg-overlay fixed inset-0 z-50 bg-black/40" />
              <Dialog.Content aria-describedby={undefined} className="dlg-drawer fixed right-0 top-0 z-50 flex h-full w-72 flex-col overflow-y-auto border-l border-line bg-surface p-4">
                <div className="mb-4 flex items-center justify-between"><Dialog.Title className="font-semibold">Menu</Dialog.Title><Dialog.Close className="btn !px-2" aria-label="Close"><X className="h-4 w-4" /></Dialog.Close></div>
                <nav className="flex flex-col gap-1 text-sm">{[...main, ...more].map((l, i) => <Link key={l.href} href={l.href} style={{ "--i": i } as React.CSSProperties} className="anim-fade-up rounded-md px-2 py-2 hover:bg-muted">{l.label}</Link>)}</nav>
                <div className="mt-auto flex flex-col gap-2 pt-4">{!signedIn && <Link href="/login" className="btn">Sign in</Link>}{cta}</div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>
    </header>
  );
}
