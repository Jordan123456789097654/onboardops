import { CtaBand, PageShell } from "@/components/page-shell";

export const metadata = { title: "Brand and logo", description: "OnboardOps logo files, colors and rules for using our name and badge.", alternates: { canonical: "/brand" } };

const colors: [string, string][] = [["Accent blue", "#1D4ED8"], ["Ink (dark)", "#0B1220"], ["Surface (light)", "#F8FAFC"], ["Muted text", "#64748B"]];

export default function Brand() {
  return (
    <PageShell narrow eyebrow="Brand" title="Our name, logo and badge" intro="If you write about OnboardOps or show that you use it, please follow these simple rules.">
      <h2 className="text-lg font-semibold">Logo files</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        {[["Icon", "/brand/onboardops-icon.svg", "#FFFFFF"], ["Badge, dark", "/badges/powered-by-onboardops.svg", "#E2E8F0"], ["Badge, light", "/badges/powered-by-onboardops-light.svg", "#0B1220"]].map(([l, src, bg]) => (
          <div key={l} className="rounded-lg border border-line p-4">
            <div className="flex h-24 items-center justify-center rounded-md" style={{ background: bg }}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={src} alt={`${l} logo`} className="max-h-16" /></div>
            <div className="mt-2 flex items-center justify-between text-[13px]"><span>{l}</span><a className="text-accent" href={src} download>Download SVG</a></div>
          </div>
        ))}
      </div>
      <h2 className="mt-10 text-lg font-semibold">Colors</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{colors.map(([n, c]) => <div key={n} className="rounded-lg border border-line p-3 text-[13px]"><div className="h-10 rounded" style={{ background: c }} /><div className="mt-2 font-medium">{n}</div><div className="mono text-xs text-soft">{c}</div></div>)}</div>
      <h2 className="mt-10 text-lg font-semibold">Strict usage rules</h2>
      <p className="mt-2 text-[13px] text-soft">The OnboardOps name, logo and badge are our trademarks. Use is permitted only as described here. Anything not listed needs our written permission first.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-line p-4">
          <h3 className="text-sm font-semibold text-emerald-700">Allowed</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[13px] text-soft">
            <li>Write the name exactly as <strong className="text-ink">OnboardOps</strong>: one word, capital O twice. Never &quot;Onboard Ops&quot;, &quot;onboardops&quot; or &quot;OnboardOps.com&quot; in running text.</li>
            <li>Use only the unmodified files downloaded from this page.</li>
            <li>Customers and partners may show the unaltered Powered by badge, linked to onboardops.org. See <a className="text-accent" href="/partners">Partners</a>.</li>
            <li>Factual references such as &quot;we use OnboardOps for staff training&quot;.</li>
            <li>Unaltered screenshots for reviews or articles, with the product named correctly.</li>
          </ul>
        </div>
        <div className="rounded-lg border border-line p-4">
          <h3 className="text-sm font-semibold text-red-700">Not allowed</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[13px] text-soft">
            <li>Stretching, recoloring, rotating, outlining, shadowing, animating, cropping or redrawing the logo.</li>
            <li>Changing the badge text or colors, or placing the logo on a busy or low-contrast background.</li>
            <li>Making the logo smaller than 16 px tall (icon) or 100 px wide (badge), or placing other marks closer than the height of the check mark.</li>
            <li>Using our name or logo in your own company name, product name, domain, social handle or app name.</li>
            <li>Suggesting we make, sponsor, certify or endorse your product, or that you are an official partner without a signed agreement.</li>
            <li>Implying compliance, legal or audit approval by us. The badge does not certify anything.</li>
            <li>Using the logo in ads, merchandise or paid placements, or altering screenshots to mislead.</li>
          </ul>
        </div>
      </div>
      <h2 className="mt-10 text-lg font-semibold">Clear space and size</h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[13px] text-soft">
        <li>Keep clear space on all sides equal to at least the height of the check mark in the icon.</li>
        <li>Minimum size: icon 16 px tall, badge 100 px wide, print 12 mm wide.</li>
        <li>Dark badge on light backgrounds, light badge on dark backgrounds. No other combinations.</li>
      </ul>
      <h2 className="mt-10 text-lg font-semibold">Enforcement</h2>
      <p className="mt-2 text-[13px] text-soft">We may ask you to correct or remove misuse, and we may withdraw permission to use the badge at any time. Report misuse or ask for permission through the <a className="text-accent" href="/contact">contact form</a>.</p>      <CtaBand />
    </PageShell>
  );
}
