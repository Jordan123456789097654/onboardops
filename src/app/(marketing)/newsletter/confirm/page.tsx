import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { confirmByToken } from "@/lib/newsletter-db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Confirm your subscription", robots: { index: false, follow: false } };

export default async function Confirm({ searchParams }: { searchParams: { token?: string } }) {
  const ok = await confirmByToken(searchParams.token ?? "").catch(() => false);
  return (
    <PageShell narrow title={ok ? "You're subscribed" : "That link didn't work"}>
      {ok ? (
        <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /><p className="text-[15px] text-soft">Thanks for confirming. Every issue is posted on the <Link className="text-accent underline" href="/newsletter">newsletter page</Link>, and we&apos;ll email you the bigger ones. You can unsubscribe from any email.</p></div>
      ) : (
        <div className="flex items-start gap-3"><XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" /><p className="text-[15px] text-soft">This confirmation link is invalid or has already been used. You can <Link className="text-accent underline" href="/newsletter">subscribe again</Link> to get a fresh one.</p></div>
      )}
    </PageShell>
  );
}
