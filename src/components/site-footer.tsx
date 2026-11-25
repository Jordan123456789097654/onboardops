import Link from "next/link";
import { ArrowRight, ShieldCheck, Lock, MapPin } from "lucide-react";
import { Brand } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { FacebookIcon, YouTubeIcon } from "@/components/social-icons";
import { legalPages, SITE } from "@/lib/site";

const STATUS_URL = "https://status.onboardops.org";

const cols: { title: string; links: [string, string][] }[] = [
  { title: "Product", links: [["Overview", "/features"], ["Solutions", "/solutions"], ["Pricing", "/pricing"], ["Security", "/security"], ["Changelog", "/changelog"], ["Newsletter", "/newsletter"],["Roadmap", "/roadmap"], ["Why OnboardOps", "/why"]] },
  { title: "Resources", links: [["Help center", "/support"], ["Video tutorial", "/tutorial"], ["Launch checklist", "/launch"], ["Migration guides", "/migrate"], ["Playbooks", "/playbooks"], ["Free tools", "/tools"], ["Blog", "/blog"], ["FAQ", "/faq"]] },
  { title: "Company", links: [["About", "/about"], ["Our team", "/team"], ["Careers", "/careers"], ["Partners and badge", "/partners"], ["Brand", "/brand"], ["Verify a certificate", "/verify"], ["Contact support", "/contact"], ["System status", STATUS_URL]] },
];

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const cls = "text-[13px] text-soft transition-colors hover:text-ink";
  return href.startsWith("http")
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{children}</a>
    : <Link href={href} className={cls}>{children}</Link>;
}

export function SiteFooter() {
  const build = (process.env.NEXT_PUBLIC_BUILD_ID || process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7);
  return (
    <footer className="no-print mt-24 border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 pt-14">
        <div className="flex flex-col items-start justify-between gap-5 rounded-xl border border-line bg-canvas p-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Write it once. Prove it forever.</h2>
            <p className="mt-1 text-[13px] text-soft">Set up your workspace in minutes. Free while in beta.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/register" className="btn-primary inline-flex items-center gap-1.5">Create a workspace <ArrowRight className="h-3.5 w-3.5" /></Link>
            <Link href="/contact" className="btn">Talk to us</Link>
          </div>
        </div>

        <div className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" aria-label="OnboardOps home"><Brand /></Link>
            <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-soft">Staff records, discipline and training for shift-based teams.</p>
            <ul className="mt-4 space-y-2 text-[12px] text-soft">
              <li className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> Built in Georgia, USA</li>
              <li className="flex items-center gap-2"><Lock className="h-3.5 w-3.5" /> Encrypted at rest and in transit</li>
              <li className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5" /> SSO, SCIM and audit logs</li>
            </ul>
            <div className="mt-5 flex items-center gap-3">
              <a href={SITE.facebookUrl} target="_blank" rel="noopener noreferrer" aria-label="OnboardOps on Facebook" className="inline-flex transition-transform hover:-translate-y-0.5"><FacebookIcon className="h-7 w-7" /></a>
              <a href={SITE.youtubeUrl} target="_blank" rel="noopener noreferrer" aria-label="OnboardOps on YouTube" className="inline-flex transition-transform hover:-translate-y-0.5"><YouTubeIcon className="h-7 w-7" /></a>
            </div>
          </div>

          {cols.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink">{c.title}</h3>
              <ul className="space-y-2.5">{c.links.map(([l, h]) => <li key={h}><FooterLink href={h}>{l}</FooterLink></li>)}</ul>
            </nav>
          ))}

          <nav aria-label="Legal">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink">Legal</h3>
            <ul className="space-y-2.5">{legalPages.map((l) => <li key={l.href}><FooterLink href={l.href}>{l.label}</FooterLink></li>)}</ul>
          </nav>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-soft">
          <span>© 2026 {SITE.legalEntity}. All rights reserved.</span>
          <span className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <StatusBadge />
            <Link href="/login" className="hover:text-ink">Sign in</Link>
            {SITE.contactEmail && <a href={`mailto:${SITE.contactEmail}`} className="hover:text-ink">{SITE.contactEmail}</a>}
            {build && <span className="mono">v{build}</span>}
          </span>
        </div>
      </div>
    </footer>
  );
}
