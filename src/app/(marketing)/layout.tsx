import Link from "next/link";
import { Brand } from "@/components/ui";
import { MarketingNav } from "@/components/marketing-nav";
import { getSessionUserId } from "@/lib/auth";
import { legalPages, SITE } from "@/lib/site";
import { JsonLd } from "@/components/json-ld";
import { CookieNotice } from "@/components/cookie-notice";
import { RefCapture } from "@/components/ref-capture";

const cols = [
  { title: "Product", links: [["Why OnboardOps", "/why"], ["Overview", "/features"], ["Solutions", "/solutions"], ["Security", "/security"], ["Pricing", "/pricing"], ["Changelog", "/changelog"], ["Roadmap", "/roadmap"], ["Free tools", "/tools"], ["Playbooks", "/playbooks"]] },
  { title: "Company", links: [["About", "/about"], ["Help center", "/support"], ["Blog", "/blog"], ["Migration guides", "/migrate"], ["Launch checklist", "/launch"], ["Video tutorial", "/tutorial"],["Verify a certificate", "/verify"], ["Careers", "/careers"], ["Partners and badge", "/partners"], ["Brand", "/brand"], ["Contact support", "/contact"], ["FAQ", "/faq"], ["Sign in", "/login"], ["Create a workspace", "/register"]] },
  { title: "Legal", links: legalPages.map((l) => [l.label, l.href]) },
];

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const signedIn = !!(await getSessionUserId(false));
  return (
    <div className="min-h-screen">
      <JsonLd data={{ "@context": "https://schema.org", "@graph": [
        { "@type": "Organization", name: SITE.name, url: SITE.url, areaServed: "US", address: { "@type": "PostalAddress", addressRegion: "GA", addressCountry: "US" } },
        { "@type": "SoftwareApplication", name: SITE.name, applicationCategory: "BusinessApplication", operatingSystem: "Web", url: SITE.url, offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } },
      ] }} />
      <div className="no-print"><MarketingNav signedIn={signedIn} /></div>
      <main>{children}</main>
      <RefCapture />
      <CookieNotice />
      <footer className="no-print mt-24 border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" aria-label="OnboardOps home"><Brand /></Link>
            <p className="mt-3 max-w-xs text-[13px] text-soft">Write it once. Prove it forever. Staff records, discipline and training for shift-based teams. Built in Georgia, USA.</p>
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
