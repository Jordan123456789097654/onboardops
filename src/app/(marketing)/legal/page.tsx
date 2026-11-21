import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { legalPages } from "@/lib/site";
import { legalDocs } from "./content";

export const metadata = { title: "Legal" };

export default function LegalIndex() {
  return (
    <PageShell narrow eyebrow="Legal" title="Terms and policies" intro="OnboardOps is based in Georgia, USA. These documents are governed by Georgia law.">
      <div className="card divide-y divide-line">
        {legalPages.map((l) => (
          <Link key={l.href} href={l.href} className="block p-4 hover:bg-muted"><div className="text-sm font-medium">{l.label}</div><div className="text-[13px] text-soft">{legalDocs[l.href.split("/").pop()!]?.summary}</div></Link>
        ))}
      </div>
    </PageShell>
  );
}
