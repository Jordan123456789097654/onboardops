import { MarketingNav } from "@/components/marketing-nav";
import { getSessionUserId } from "@/lib/auth";
import { SITE } from "@/lib/site";
import { JsonLd } from "@/components/json-ld";
import { CookieNotice } from "@/components/cookie-notice";
import { RefCapture } from "@/components/ref-capture";
import { SiteFooter } from "@/components/site-footer";
import { NewsletterAnnouncement } from "@/components/newsletter-announcement";
import { prisma } from "@/lib/prisma";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const signedIn = !!(await getSessionUserId(false));
  const latest = await prisma.newsletterPost
    .findFirst({ where: { status: "PUBLISHED", publishedAt: { gte: new Date(Date.now() - 30 * 86400_000) } }, orderBy: { publishedAt: "desc" }, select: { slug: true, title: true, summary: true, category: true } })
    .catch(() => null);
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
      <NewsletterAnnouncement issue={latest} />
      <SiteFooter />
    </div>
  );
}
