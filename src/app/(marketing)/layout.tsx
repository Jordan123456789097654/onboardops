import Link from "next/link";
import { Brand } from "@/components/ui";
import { MarketingNav } from "@/components/marketing-nav";
import { getSessionUserId } from "@/lib/auth";
import { legalPages } from "@/lib/site";

const cols = [
  { title: "Product", links: [["Why OnboardOps", "/why"], ["Overview", "/features"], ["Solutions", "/solutions"], ["Security", "/security"], ["Pricing", "/pricing"], ["Changelog", "/changelog"]] },
  { title: "Company", links: [["About", "/about"], ["Help center", "/support"], ["Contact support", "/contact"], ["FAQ", "/faq"], ["Sign in", "/login"], ["Create a workspace", "/register"]] },
  { title: "Legal", links: legalPages.map((l) => [l.label, l.href]) },
];

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const signedIn = !!(await getSessionUserId(false));
  return (
    <div className="min-h-screen">
      <MarketingNav signedIn={signedIn} />
      <main>{children}</main>
      <footer className="mt-24 border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" aria-label="OnboardOps home"><Brand /></Link>
            <p className="mt-3 max-w-xs text-[13px] text-soft">Staff records, discipline and training for shift-based teams. Built in Georgia, USA.</p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-soft">{c.title}</h3>
              <ul className="space-y-2 text-[13px]">{c.links.map(([l, h]) => <li key={h}><Link href={h} className="link-u text-soft hover:text-ink">{l}</Link></li>)}</ul>
            </div>
          ))}
        </div>
        <div className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs text-soft">
            <span>© 2026 OnboardOps. All rights reserved.</span>
            <span>Built in Georgia, USA</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
