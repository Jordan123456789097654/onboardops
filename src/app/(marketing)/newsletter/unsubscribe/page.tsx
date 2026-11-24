import { PageShell } from "@/components/page-shell";
import { UnsubscribeButton } from "./unsubscribe-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };

/** A confirmation step, so email scanners that open links can't unsubscribe anyone by accident. */
export default function Unsubscribe({ searchParams }: { searchParams: { token?: string } }) {
  return (
    <PageShell narrow title="Unsubscribe from the newsletter" intro="You'll stop getting the newsletter by email. Every issue is still on our website whenever you want it.">
      <UnsubscribeButton token={searchParams.token ?? ""} />
    </PageShell>
  );
}
