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
      <h2 className="mt-10 text-lg font-semibold">Rules</h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[13px] text-soft">
        <li>Write the name as <strong className="text-ink">OnboardOps</strong>, one word, capital O twice.</li>
        <li>Leave clear space around the logo at least the height of the check mark.</li>
        <li>Do not stretch, recolor, rotate, add effects to or redraw the logo.</li>
        <li>Do not use our name or logo in a way that suggests we make, sponsor or endorse your product or service.</li>
        <li>Customers and partners may show the Powered by badge. See <a className="text-accent" href="/partners">Partners</a>.</li>
        <li>Screenshots of the product may be used to review or write about OnboardOps. Do not alter them to mislead.</li>
      </ul>
      <p className="mt-6 text-[13px] text-soft">Need something else, such as a larger logo or a press quote? Use the <a className="text-accent" href="/contact">contact form</a>.</p>
      <CtaBand />
    </PageShell>
  );
}
