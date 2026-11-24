import Link from "next/link";
import { Brand } from "@/components/ui";
import { MarketingNav } from "@/components/marketing-nav";
import { getSessionUserId } from "@/lib/auth";
import { legalPages, SITE } from "@/lib/site";
import { JsonLd } from "@/components/json-ld";
import { CookieNotice } from "@/components/cookie-notice";
import { MarketingChat } from "@/components/marketing-chat";
import { RefCapture } from "@/components/ref-capture";
import { FacebookIcon, YouTubeIcon } from "@/components/social-icons";
import { aiConfigured } from "@/lib/ai/groq";

const cols = [
  { title: "Product", links: [["Why OnboardOps", "/why"], ["Overview", "/features"], ["Solutions", "/solutions"], ["Security", "/security"], ["Pricing", "/pricing"], ["Changelog", "/changelog"], ["Roadmap", "/roadmap"], ["Free tools", "/tools"], ["Playbooks", "/playbooks"]] },
  { title: "Company", links: [["About", "/about"], ["Help center", "/support"], ["Blog", "/blog"], ["Migration guides", "/migrate"], ["Launch checklist", "/launch"], ["System status", "https://status.onboardops.org"], ["Video tutorial", "/tutorial"],["Verify a certificate", "/verify"], ["Careers", "/careers"], ["Partners and badge", "/partners"], ["Brand", "/brand"], ["Contact support", "/contact"], ["FAQ", "/faq"], ["Sign in", "/login"], ["Create a workspace", "/register"]] },
  { title: "Legal", links: legalPages.map((l) => [l.label, l.href]) },
];

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const signedIn = !!(await getSessionUserId(false));
  return (
    <div className="min-h-screen">
      <JsonLd data={{ "@context": "https://schema.org", "@graph": [
        { "@type": "Organization", name: SITE.name, url: SITE.url, sameAs: [SITE.facebookUrl, SITE.youtubeUrl], areaServed: "US", address: { "@type": "PostalAddress", addressRegion: "GA", addressCountry: "US" } },
        { "@type": "SoftwareApplication", name: SITE.name, applicationCategory: "BusinessApplication", operatingSystem: "Web", url: SITE.url, offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } },
      ] }} />
      <div className="no-print"><MarketingNav signedIn={signedIn} /></div>
      <main>{children}</main>
      <RefCapture />
      <CookieNotice />
      {aiConfigured() && <MarketingChat />}
      <footer className="no-print mt-24 border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" aria-label="OnboardOps home"><Brand /></Link>
            <p className="mt-3 max-w-xs text-[13px] text-soft">Write it once. Prove it forever. Staff records, discipline and training for shift-based teams. Built in Georgia, USA.</p>
            <div className="mt-4 flex items-center gap-3"><a href={SITE.facebookUrl} target="_blank" rel="noopener noreferrer" aria-label="OnboardOps on Facebook" title="OnboardOps on Facebook" className="inline-flex transition-transform hover:-translate-y-0.5"><FacebookIcon className="h-7 w-7" /></a><a href={SITE.youtubeUrl} target="_blank" rel="noopener noreferrer" aria-label="OnboardOps on YouTube" title="OnboardOps on YouTube" className="inline-flex transition-transform hover:-translate-y-0.5"><YouTubeIcon className="h-7 w-7" /></a></div>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-soft">{c.title}</h3>
              <ul className="space-y-2 text-[13px]">{c.links.map(([l, h]) => <li key={h}>{h.startsWith("http") ? <a href={h} target="_blank" rel="noopener noreferrer" className="link-u text-soft hover:text-ink">{l}</a> : <Link href={h} className="link-u text-soft hover:text-ink">{l}</Link>}</li>)}</ul>
            </div>
          ))}
        </div>
        <div className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs text-soft">
            <span>© 2026 OnboardOps. All rights reserved.</span>
            <span className="flex items-center gap-4"><a href={SITE.facebookUrl} target="_blank" rel="noopener noreferrer" className="link-u hover:text-ink">Facebook</a><a href={SITE.youtubeUrl} target="_blank" rel="noopener noreferrer" className="link-u hover:text-ink">YouTube</a><a href="https://status.onboardops.org" target="_blank" rel="noopener noreferrer" className="link-u hover:text-ink">System status</a><span>Built in Georgia, USA</span></span>
          </div>
        </div>
      </footer>
    </div>
  );
}
