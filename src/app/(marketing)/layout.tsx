import { MarketingNav } from "@/components/marketing-nav";
import { getSessionUserId } from "@/lib/auth";
import { SITE } from "@/lib/site";
import { JsonLd } from "@/components/json-ld";
import { CookieNotice } from "@/components/cookie-notice";
import { MarketingChat } from "@/components/marketing-chat";
import { RefCapture } from "@/components/ref-capture";
import { SiteFooter } from "@/components/site-footer";
import { aiConfigured } from "@/lib/ai/groq";

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
      <SiteFooter />
    </div>
  );
}
