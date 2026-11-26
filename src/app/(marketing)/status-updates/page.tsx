import type { Metadata } from "next";
import { StatusUpdatesForm } from "./status-updates-form";

export const metadata: Metadata = {
  title: "Status updates by email",
  description: "Get an email when OnboardOps has an incident or an update. Confirm once; unsubscribe any time.",
};

const MESSAGES: Record<string, string> = {
  confirmed: "You're subscribed. We'll email you when there's an incident or an update.",
  unsubscribed: "You've been unsubscribed. You won't get any more status emails.",
  "bad-link": "That link has expired or isn't valid. Enter your email below to get a new one.",
};

export default function StatusUpdatesPage({ searchParams }: { searchParams: { state?: string } }) {
  const notice = searchParams.state ? MESSAGES[searchParams.state] : null;
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Status updates by email</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-soft">
        Get an email when OnboardOps has an incident, when we post an update, and when it's resolved. You'll confirm your address first, and every email has a link to stop.
        You can also follow the live status at <a className="underline" href="https://status.onboardops.org">status.onboardops.org</a>.
      </p>
      {notice && <p className="mt-6 rounded-lg border border-line bg-muted px-4 py-3 text-sm">{notice}</p>}
      <StatusUpdatesForm />
    </main>
  );
}
