import Link from "next/link";
import { PageShell } from "@/components/page-shell";

export const metadata = { title: "Account suspended", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <PageShell narrow title="Your account is suspended">
      <p className="text-[15px] text-soft">You can&apos;t sign in while this suspension is in place. We emailed you the reason. If you think it was a mistake, you can <Link className="text-accent underline" href="/appeal">appeal this decision</Link>.</p>
    </PageShell>
  );
}
