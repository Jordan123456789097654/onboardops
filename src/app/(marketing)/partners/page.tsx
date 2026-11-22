import { CtaBand, PageShell } from "@/components/page-shell";

export const metadata = { title: "Partners and badge", description: "Consultants, agencies and customers can show a Powered by OnboardOps badge and get a referral link.", alternates: { canonical: "/partners" } };

const snippet = (variant: "" | "-light") => `<a href="https://onboardops.org/?ref=YOURCODE" rel="noopener"><img src="https://onboardops.org/badges/powered-by-onboardops${variant}.svg" alt="Powered by OnboardOps" width="200" height="40"></a>`;

export default function Partners() {
  return (
    <PageShell narrow eyebrow="Partners" title="Show you use OnboardOps" intro="Customers, consultants and agencies can add a small badge to their site. If you have a referral code, signups through your link are counted.">
      <h2 className="text-lg font-semibold">The badge</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {([["Dark", ""], ["Light", "-light"]] as const).map(([l, v]) => (
          <div key={l} className="rounded-lg border border-line p-4">
            <div className="mb-2 text-xs text-soft">{l}</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/badges/powered-by-onboardops${v}.svg`} alt="Powered by OnboardOps" width={200} height={40} />
            <pre className="mono mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-md border border-line bg-muted p-2 text-[11px] select-all">{snippet(v)}</pre>
          </div>
        ))}
      </div>
      <h2 className="mt-10 text-lg font-semibold">Referral links</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-soft">Ask for a code through the contact form and tell us who you are. We will create one for you and replace <span className="mono">YOURCODE</span> in the snippet. Anyone who creates a workspace after visiting your link is counted for you. There is no reward program yet, and we will tell you before one starts.</p>
      <h2 className="mt-10 text-lg font-semibold">Badge rules</h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[13px] text-soft">
        <li>Use the badge as given. Do not change its colors, proportions or wording.</li>
        <li>Use it only if you actually use OnboardOps. Do not imply that we endorse your products or services.</li>
        <li>We may ask you to remove it if it is misused.</li>
      </ul>
      <CtaBand />
    </PageShell>
  );
}
