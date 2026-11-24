import { tpl } from "./types";

const ACC = "Account & Access" as const;
const CMP = "Compliance & Data" as const;
const LEG = "Legal & Policy" as const;
const SEC = "Security & Incidents" as const;
const OUT = "Outages & Maintenance" as const;

export const MORE_ACCOUNT = [
  tpl(ACC, "invite-reminder", "Invitation reminder", "Remind someone their invitation is still waiting", "invite",
    "Your invitation to {{workspace}} is still waiting", "It expires on {{deadline}}.",
    ["Accept the invitation", "{{action_url}}"], `
Hi {{name}},

{{inviter}} invited you to join {{workspace}} on OnboardOps. The invitation has not been accepted yet and it expires on {{deadline}}.

Accepting takes about a minute. You choose your own password, and you will see only what your role allows.

If you were not expecting this, you can ignore the email and nothing will happen.
`),

  tpl(ACC, "invite-expired", "Invitation expired", "Tell someone their invitation lapsed and how to get a new one", "clock",
    "Your invitation to {{workspace}} has expired", "Ask for a new one and you will be set.",
    undefined, `
Hi {{name}},

The invitation to {{workspace}} expired on {{date}}. Invitations only last a short time to keep accounts safe.

Ask {{inviter}} to send a new one from Staff Accounts, and you will get a fresh link right away. Nothing else is needed from you.
`),

  tpl(ACC, "owner-gone", "Workspace needs an owner", "A workspace has no active owner", "alert",
    "{{workspace}} needs an active owner", "We could not reach the person who owns it.",
    ["Claim ownership", "{{action_url}}"], `
Hi {{name}},

The owner of {{workspace}}, {{previous_owner}}, no longer has active access, and nobody else currently has the authority to change billing, security or ownership.

## What we can do
Ownership can be handed to an admin of the workspace. For that we need written confirmation from your organization, and we will check it before making any change.

>! We never transfer ownership because of a request from someone who cannot prove they act for the organization.

Reply with the name of the person who should be the owner and how we can reach your organization to confirm.
`),

  tpl(ACC, "access-changed", "Role or access changed", "Tell someone their access changed", "eye",
    "Your access to {{workspace}} has changed", "Your role is now {{role}}.",
    undefined, `
Hi {{name}},

Your role in {{workspace}} was changed to {{role}} by {{changed_by}} on {{date}}.

## What this means
{{what_changed}}

If you did not expect this change, tell {{changed_by}} or reply to this email. Role changes are recorded in the workspace audit log.
`),

  tpl(ACC, "domain-live", "Custom domain connected", "A custom domain is verified and live", "verify",
    "{{domain}} is now connected", "Your workspace is available at your own address.",
    ["Open my workspace", "{{action_url}}"], `
Hi {{name}},

Your custom domain {{domain}} is verified and live for {{workspace}}.

## What to know
- Staff can now sign in at {{domain}}.
- The old workspace address keeps working.
- The security certificate is issued automatically and renewed for you.

Do not remove the DNS records we asked you to add, or the domain will stop working.
`),

  tpl(ACC, "domain-problem", "Custom domain needs attention", "A custom domain stopped verifying", "alert",
    "A problem with {{domain}}", "Your own address is not working right now.",
    ["Check the domain settings", "{{action_url}}"], `
Hi {{name}},

We cannot verify {{domain}} for {{workspace}}, so visitors may see an error on that address.

## What we found
{{what_happened}}

## How to fix it
1. Open the DNS settings with the company that manages your domain.
2. Make sure the records match the ones shown in Settings, Domains.
3. Wait up to an hour for changes to spread, then check again.

>+ Your workspace still works at its original OnboardOps address in the meantime.
`),

  tpl(ACC, "signin-help", "Help signing in", "Reply to someone who cannot sign in", "key",
    "Getting you signed in", "A few steps that fix most sign-in problems.",
    ["Reset my password", "{{action_url}}"], `
Hi {{name}},

Sorry you are locked out. These fix most cases.

## Try these first
1. Reset your password with the button below. The link is valid for a short time.
2. If you use two-step sign-in and lost your phone, use a backup code.
3. If you signed up with Google or GitHub, use that button instead of a password.
4. After five wrong passwords, an account locks for a short while. Wait and try again.

If none of that works, reply from the email address on the account and tell us what you see. We will check the details before changing anything, so that nobody else can take over your account.
`),
];

export const MORE_COMPLIANCE = [
  tpl(CMP, "security-questionnaire", "Security questionnaire reply", "Reply to a customer's security review", "shield",
    "Your security questionnaire for {{workspace}}", "Answers and the documents you asked for.",
    ["Open our security summary", "{{security_url}}"], `
Hi {{name}},

Thank you for the security review. We have answered your questionnaire and attached it.

## Where to find more
- Our security page describes how we protect data.
- The data processing addendum, subprocessor list and retention policy are on the legal page.
- Anything not covered, send as a list and we will answer in writing.

We only state what is true today. Where a question is about something we do not do yet, we say so instead of guessing.
`),

  tpl(CMP, "dpa-copy", "Signed data processing addendum", "Send a customer a copy of the DPA", "pen",
    "A copy of the data processing addendum for {{workspace}}", "As you asked.",
    undefined, `
Hi {{name}},

You asked for a copy of the data processing addendum for {{workspace}}. It is attached.

It applies to your use of OnboardOps as described in the terms, and it lists the subprocessors we use and what each one does. We tell you in advance when a subprocessor is added, so you have time to object.

If your legal team needs a change, send it as a list and we will review it.
`),

  tpl(CMP, "verify-request", "Confirm it is you before we send data", "Verify a requester before a privacy request is fulfilled", "lock",
    "Please confirm your request", "We check who you are before sharing personal data.",
    ["Confirm my request", "{{action_url}}"], `
Hi {{name}},

We received your request ({{request_ref}}) to {{request_type}}. Before we act on it, we need to be sure that it is really you. Sharing personal information with the wrong person is worse than a short delay.

## What to do
Confirm using the button below, from the email address on the account. If you cannot, reply and tell us what you can show.

We will not ask for a password, a government ID number or payment details.
`),

  tpl(CMP, "request-extended", "More time needed for a request", "Tell a requester that you need more time", "clock",
    "We need more time for request {{request_ref}}", "Here is why, and the new date.",
    undefined, `
Hi {{name}},

We are working on your request ({{request_ref}}) but need more time than we first expected.

[details]
Reason: {{reason}}
New date: {{deadline}}

We will write to you again by then. If you need anything urgently, reply and tell us what.
`),

  tpl(CMP, "request-partial", "Part of a request cannot be fulfilled", "Explain what could not be done and why", "alert",
    "An update on request {{request_ref}}", "We completed most of it, with one exception.",
    undefined, `
Hi {{name}},

We have finished your request ({{request_ref}}). Most of it is done, but one part we could not do.

## What we did
{{what_done}}

## What we could not do, and why
{{what_not_done}}

You have the right to complain to your local data protection authority, and you can reply to us to ask for a review first.
`),

  tpl(CMP, "forward-employee-request", "Employee request forwarded to the employer", "Pass an employee's data request to the customer who controls the data", "invite",
    "A data request about someone in {{workspace}}", "This request needs a decision from you.",
    ["Open the privacy request", "{{action_url}}"], `
Hi {{name}},

A person asked us for their data, or to change or delete it. The records are controlled by {{workspace}}, so the decision is yours, not ours.

[details]
Reference: {{request_ref}}
Type: {{request_type}}
Received: {{date}}

## What we ask of you
1. Review the request in your workspace.
2. Reply to the person within the time the law requires, which is often 30 days.
3. Tell us if you need us to export or delete anything for you.

We have told the person that their employer will respond, and we have not shared anything with them.
`),

  tpl(CMP, "deletion-request-help", "How to delete one person's records", "Answer an employer asking how to remove an employee's data", "lock",
    "Removing one person's records from {{workspace}}", "What you can delete yourself, and what needs us.",
    undefined, `
Hi {{name}},

You asked how to remove {{person}} from {{workspace}}. Here is how it works.

## What you can do yourself
- Remove or close the person's profile in the staff directory.
- Export their records first if you need a copy.

## What may remain
Some records must be kept for a set time by law or by your own policy, for example records of disciplinary action, injury logs and payroll. The audit log is append-only by design, so it keeps a record that something happened.

## When you need us
If a record must be deleted before its normal date, reply with the reason and we will review it with you.
`),
];

export const MORE_LEGAL = [
  tpl(LEG, "aup-warning", "Notice about your use of OnboardOps", "A warning about a policy violation, before any suspension", "alert",
    "A notice about {{workspace}}", "Please read this and reply by {{deadline}}.",
    undefined, `
Hi {{name}},

We are writing about activity in {{workspace}} that goes against our acceptable use policy.

## What we saw
{{what_happened}}

## What we ask
Please stop and reply by {{deadline}}. If we do not hear from you or the activity continues, we may limit or suspend the workspace. We would much rather resolve this with you.

>! If the activity puts other customers or the service at risk, we can act immediately and explain afterwards.

If we have misunderstood, tell us. We will look again.
`),

  tpl(LEG, "brand-use", "Using our name and logo", "Reply to someone using the brand in a way we do not allow", "pen",
    "About using the OnboardOps name and logo", "A friendly note and a link to our brand rules.",
    ["Read the brand page", "{{action_url}}"], `
Hi {{name}},

Thanks for sharing OnboardOps. We noticed the name or logo is used in a way that could suggest we run or endorse {{thing}}.

Please change it as described on our brand page. The page also lists what you are free to do, and that is a lot: writing about us, linking to us and saying you use us are all fine.

Reply if you would like to ask about something specific.
`),

  tpl(LEG, "signed-agreement", "Your signed agreement", "Send a copy of an agreement after it is signed", "seal",
    "Your signed agreement with OnboardOps", "A copy for your records.",
    undefined, `
Hi {{name}},

Your signed copy of the {{document}} is attached. It took effect on {{date}}.

Please keep it with your records. If your organization changes its legal name or address, tell us so we can update it.
`),
];

export const MORE_SECURITY = [
  tpl(SEC, "report-received", "Security report received", "Acknowledge a vulnerability report", "shield",
    "We received your security report", "Thank you. Here is what happens next.",
    undefined, `
Hi {{name}},

Thank you for reporting this to us. We take reports seriously, and your reference is {{request_ref}}.

## What happens next
1. We will confirm whether we can reproduce it, usually within a few working days.
2. If it is real, we will fix it and tell you when it is done.
3. We ask that you do not share details publicly until it is fixed.

Please do not access data that is not yours, and do not run tests that could disrupt the service. We will not take action against anyone who follows those rules and reports in good faith.
`),

  tpl(SEC, "report-fixed", "Reported vulnerability fixed", "Tell a researcher the report is fixed", "verify",
    "The issue you reported is fixed", "Thank you for helping keep customers safe.",
    undefined, `
Hi {{name}},

The vulnerability you reported ({{request_ref}}) is fixed as of {{date}}. You can check it from your side.

We appreciate you taking the time. If you would like to be credited in our changelog, tell us how you would like your name to appear. If you prefer to stay anonymous, we will respect that.
`),

  tpl(SEC, "report-not-valid", "Report is not a vulnerability", "Politely decline a report that is not a security issue", "shield",
    "About your security report", "We looked closely and here is our reasoning.",
    undefined, `
Hi {{name}},

Thank you for your report ({{request_ref}}). We looked closely at it.

## Our conclusion
We do not consider this a vulnerability because {{reason}}.

If you think we have missed something, reply with the steps you followed and what you saw, and we will take another look. We would rather be corrected than wrong.
`),
];

export const MORE_OUTAGES = [
  tpl(OUT, "status-subscribed", "Status subscription confirmed", "Confirm a status page subscription", "verify",
    "You are subscribed to OnboardOps status updates", "We will email you about incidents and maintenance.",
    ["View the status page", "{{status_url}}"], `
Hi {{name}},

You are subscribed to updates from the OnboardOps status page. We will email you when there is an incident or planned maintenance, and when it ends. We do not send anything else to this list.

You can unsubscribe at any time from the link at the bottom of any message.
`),

  tpl(OUT, "outage-personal", "Personal follow-up after an outage", "A direct note to a customer who was affected", "chat",
    "About the outage on {{date}}", "A personal note from us.",
    undefined, `
Hi {{name}},

I wanted to write to you directly about the outage on {{date}}, because I know it affected {{workspace}}.

## What happened
{{what_happened}}

## What we changed
{{what_changed}}

If it caused you a real problem, such as a missed deadline or a shift that could not be recorded, tell me and I will help put it right. You do not need to make a case for it.
`),

  tpl(OUT, "restore-complete", "Restore from backup completed", "Tell a customer their requested restore is done", "verify",
    "Your restore for {{workspace}} is complete", "Here is exactly what was restored.",
    undefined, `
Hi {{name}},

The restore you requested for {{workspace}} is done.

[details]
Restored to: {{restore_point}}
Completed: {{date}}
Reference: {{request_ref}}

## What this means
Anything entered after {{restore_point}} is not in the restored data. We have kept a copy of the pre-restore data for {{days}} days in case you need something from it.

Please check the records you care about and tell us if anything looks wrong.
`),
];
