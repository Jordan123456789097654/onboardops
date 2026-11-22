import Link from "next/link";
import { LifeBuoy, PlayCircle } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { SupportSearch } from "@/components/support-search";
import { articles, categories } from "@/lib/docs";

export const metadata = { title: "Help center", description: "Guides for setting up and using OnboardOps." };

export default function Support() {
  return (
    <PageShell eyebrow="Help center" title="How can we help?" intro="Step-by-step guides for setting up your workspace and running training, discipline and checklists.">
      <Link href="/tutorial" className="card mb-8 flex flex-wrap items-center justify-between gap-4 p-5 transition-colors hover:bg-muted">
        <div className="flex items-start gap-3"><PlayCircle className="mt-0.5 h-5 w-5 text-accent" /><div><h2 className="text-base font-semibold">New here? Watch the setup tutorial</h2><p className="mt-1 text-[13px] text-soft">A two minute video: the setup wizard, inviting staff, your first course, discipline rules, alerts, features and roles.</p></div></div>
        <span className="btn !h-9 !text-sm">Watch the video</span>
      </Link>
      <SupportSearch articles={articles.map(({ slug, title, cat, summary }) => ({ slug, title, cat, summary }))} categories={categories} />
      <div className="card mt-14 flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="flex items-start gap-3"><LifeBuoy className="mt-0.5 h-5 w-5 text-accent" /><div><h2 className="text-base font-semibold">Can&apos;t find an answer?</h2><p className="mt-1 text-[13px] text-soft">Send us a message. We reply within 2 business days during the beta. <Link className="text-accent underline" href="/support/support-policy">Support policy</Link></p></div></div>
        <Link href="/contact" className="btn-primary !h-10 !px-5 !text-sm">Contact support</Link>
      </div>
    </PageShell>
  );
}
