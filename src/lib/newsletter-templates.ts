export const NEWS_CATEGORIES = ["Update", "Incident", "Release", "Tips", "Company"] as const;

export type NewsTemplate = { id: string; title: string; category: (typeof NEWS_CATEGORIES)[number]; summary: string; body: string; /** Used as the issue title when loaded. */ issueTitle: string };

/** Starting points for a new issue. Body uses the same markup as the email composer, plus [links](https://…) and **bold**. */
export const NEWS_TEMPLATES: NewsTemplate[] = [
  {
    id: "incident-dns-2026-11-24",
    title: "Incident summary: DNS outage (Nov 24, 2026)",
    category: "Incident",
    issueTitle: "Post-incident summary: DNS outage, November 24, 2026",
    summary: "A mistake in a DNS change made OnboardOps unreachable for many people for about 23 minutes. No data was affected. Here is what happened and what we are changing.",
    body: `
**In short:** a mistake in a DNS change made OnboardOps unreachable for many people for about 23 minutes. No data was affected.

>+ Your data was not affected. Our servers and database ran normally the whole time, nothing was lost, accessed or changed, and this was not a security incident.

[details]
Started: 4:21 PM ET, November 24, 2026
Resolved: 4:44 PM ET (monitoring confirmed full recovery)
Duration: about 23 minutes
Affected: Website, sign-in, public API and the status page

## What you may have seen
The website, sign-in, the public API and the status page failed to load, usually with a "site can't be reached" message. In the app, you may have seen the "You are offline" screen. People whose DNS service doesn't check signatures may not have noticed anything. Some of our emails (sign-in links, verification and notifications) may have been delayed or not delivered during the window.

## What happened
We were adding extra protection against traffic attacks, which involved moving our domain's DNS to another provider. Our domain uses DNSSEC, a signature that lets DNS services confirm an answer is genuine. During the move, the signature records held by our domain registry stopped matching the ones our DNS was serving. DNS services that check those signatures treated our domain as untrustworthy and returned nothing. That includes Google Public DNS, which is why it affected so many people.

## What did not happen
This was not an attack and not a security incident. The problem was in how the internet found us, not in what we store.

## What we did to fix it
1. **Found the cause.** We tested our domain against several large DNS services. Google and Cloudflare's lookup services both reported the same error: the signature record at our registry didn't match any key our DNS was serving. That pointed us straight to the DNSSEC mismatch, and ruled out our servers and database.
2. **Rolled back the DNS change.** We pointed the domain back to its previous DNS provider, which still held every record exactly as it was (website, API, email and the status page).
3. **Restored signing.** We turned DNSSEC signing back on at the previous provider, which created fresh signing keys.
4. **Fixed the registry record.** The registry still held the signature record for the old keys, so we had the correct one published for the new keys. The stale record was cleared.
5. **Checked the result.** We confirmed that the signature record at the registry matched the keys being served, and tested the site, sign-in and email records from Google, Cloudflare, Quad9 and OpenDNS.
6. **Watched recovery.** DNS services refreshed their cached answers as time passed. Our monitoring confirmed full recovery at 4:44 PM ET, and we kept checking until the slower services caught up.

We made no changes to our servers, the database or anyone's data at any point, because none were involved.

## Why it took as long as it did
The registry's signature records are cached by DNS services, in some cases for up to an hour. Our correction was in place before recovery was complete everywhere, but each service had to wait for its cached copy to expire.

## What we're changing
1. **A written checklist for DNS changes,** with the DNSSEC step handled first, and a rule that we don't switch DNS providers without a rollback plan.
2. **Testing against several DNS services** (Google, Cloudflare, Quad9 and OpenDNS) before and after any DNS change.
3. **Changes outside busy hours,** and never several at once.
4. **We plan to move our status page to a separate domain,** so it stays reachable if our main domain has a DNS problem.

## What you need to do
Nothing, in most cases. If you tried to sign in, sign up or verify an email during the outage and it didn't work, please try again. If you still see problems, contact us from the [help center](https://www.onboardops.org/support) and tell us roughly when you tried.

We're sorry. You depend on OnboardOps to run your shifts and keep your records, and being unreachable falls short of that.
`.trim(),
  },
  {
    id: "release-roundup",
    title: "What's new: release roundup",
    category: "Release",
    issueTitle: "What's new in OnboardOps",
    summary: "The features and fixes we shipped recently, and what is coming next.",
    body: `
Here is what we shipped recently. Every release is also listed on the [changelog](https://www.onboardops.org/changelog).

## New
- **{{feature one}}:** what it does and why it helps.
- **{{feature two}}:** what it does and why it helps.

## Improved
- {{improvement one}}
- {{improvement two}}

## Fixed
- {{fix one}}
- {{fix two}}

## Coming next
We're working on {{next one}} and {{next two}}. You can follow progress on the [roadmap](https://www.onboardops.org/roadmap).

>+ OnboardOps is free during the beta. Tell us what you'd like to see next using the feedback button in the app.
`.trim(),
  },
  {
    id: "tips-issue",
    title: "Tips: get more from OnboardOps",
    category: "Tips",
    issueTitle: "Tip of the month: {{topic}}",
    summary: "One practical tip to save your team time.",
    body: `
This month's tip: **{{one-line tip}}**.

## Why it helps
Explain the problem this solves in two or three sentences.

## How to do it
1. Open {{where}}.
2. {{step two}}
3. {{step three}}

>! A short warning or common mistake to avoid.

## Want a hand?
Our [help center](https://www.onboardops.org/support) has step-by-step guides, and the chat on our website can connect you with a person.
`.trim(),
  },
  {
    id: "company-note",
    title: "A note from the team",
    category: "Company",
    issueTitle: "A note from the OnboardOps team",
    summary: "A short update on where we are and what we're focused on.",
    body: `
A short, honest update on where we are.

## Where we are
Two or three sentences about progress, in plain words.

## What we're focused on
- {{focus one}}
- {{focus two}}

## What we learned
Share one thing that surprised you, or something a customer taught you.

## Thank you
Thank the people who gave feedback, and tell them how to reach you.
`.trim(),
  },
];
