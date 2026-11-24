import { tpl } from "./types";

const C = "Security & Incidents" as const;

export const SECURITY = [
  tpl(C, "data-breach", "Critical data breach notice", "Important security incident affecting your workspace data", "shield",
    "Important: security incident affecting your OnboardOps data ({{incident_id}})", "We are writing to tell you about a security incident and what you should do.",
    ["Review what happened", "{{action_url}}"], `
Hi {{name}},

We are writing to tell you about a security incident that affected data held in your OnboardOps workspace. We know this is serious, so we want you to hear it from us directly, with the facts we have confirmed so far and what you can do right now.

>!! Reference {{incident_id}}. Discovered on {{date}}. Please read the whole message.

## What happened
{{what_happened}}

## What information was involved
{{data_involved}}

## What we have done
- Stopped the activity and closed the access path that was used.
- Rotated the credentials and keys that could have been exposed.
- Started a full review of access logs covering the affected period.
- Notified the people who needed to know inside our team and begun work on a written report.

## What you should do now
1. Sign in and change your password, then check that two-step sign-in is turned on.
2. Review the audit log in your workspace for activity you do not recognize.
3. If employee records were involved, decide whether your own legal or notification duties apply. We can give you a record of what was affected to help with that.
4. Watch for emails or messages that pretend to come from us. We will never ask for your password.

[details]
Incident reference: {{incident_id}}
Date discovered: {{date}}
Status: {{status}}

## How to reach us
Reply to this email or use the help center at {{support_url}}. We are sorry this happened, and we will keep updating you until it is fully closed.

Thank you for trusting us with your team's records.
`),

  tpl(C, "unauthorized-access", "Unauthorized access to a workspace", "Someone who should not have had access viewed or changed records", "alert",
    "Unauthorized access detected in your workspace ({{incident_id}})", "We found access to your workspace that was not authorized.",
    ["Review recent activity", "{{action_url}}"], `
Hi {{name}},

Our monitoring found access to your workspace "{{workspace}}" that did not come from an authorized member. We have blocked it and want you to know exactly what we found.

>! Time of access: {{date}}. Reference: {{incident_id}}.

## What we know
{{what_happened}}

## What the access could see or change
{{data_involved}}

## What we did
- Ended the session and signed the account out everywhere.
- Locked the affected login until its owner confirms their identity.
- Saved the evidence, including the audit log entries that show what was touched.

## What we recommend
1. Open the audit log and look at the entries from {{date}} onward.
2. Reset passwords for any member who signs in from a shared computer.
3. Ask every Owner and Admin to turn on two-step sign-in.
4. Tell us if anything in the log looks wrong, so we can help you undo it.

The audit log in OnboardOps cannot be edited, so what you see there is a trustworthy record.
`),

  tpl(C, "suspicious-login", "Suspicious sign-in on your account", "A sign-in from an unusual place or device", "eye",
    "We noticed an unusual sign-in to your OnboardOps account", "If this was not you, secure your account now.",
    ["Secure my account", "{{action_url}}"], `
Hi {{name}},

We noticed a sign-in to your OnboardOps account that looked different from your usual activity.

[details]
When: {{date}} at {{time}}
Approximate place: {{location}}
Device: {{device}}

## If this was you
You do not need to do anything. You can ignore this email.

## If this was not you
1. Select the button above and change your password right away.
2. Turn on two-step sign-in if it is not already on.
3. Sign out of other sessions from your account page.
4. Tell us, so we can look at the account too.

>! We will never ask you for your password or a sign-in code by email, phone or chat.
`),

  tpl(C, "credential-exposure", "Exposed key or credential revoked", "We found a key or token that was exposed and turned it off", "key",
    "Action needed: an exposed credential was revoked ({{incident_id}})", "We revoked a key that may have been exposed.",
    ["Create a new key", "{{action_url}}"], `
Hi {{name}},

We found a credential connected to your workspace in a place where it could be read by other people, and we have revoked it so it cannot be misused.

[details]
What was exposed: {{credential}}
Where it was found: {{where_found}}
Revoked on: {{date}}
Reference: {{incident_id}}

## What this means for you
Anything that used this credential will stop working until you replace it. This can include webhook connections or scheduled exports.

## What to do
1. Create a replacement from your workspace settings.
2. Update the system that used the old one.
3. Check the audit log for use of the old credential between its creation and {{date}}.
4. Store new keys only in a password manager or a secrets vault, never in a document, chat or code repository.

Nothing in your records was changed by us. We only turned the credential off.
`),

  tpl(C, "phishing-advisory", "Phishing advisory", "Warn customers about fake emails that look like ours", "alert",
    "Be careful: fake emails pretending to be OnboardOps", "How to spot them and what to do.",
    ["See how we contact you", "{{security_url}}"], `
Hi {{name}},

We have learned that fake emails are going around that pretend to come from OnboardOps. They try to get people to enter a password or sign-in code on a copycat website.

## How to spot them
- They create urgency: "your account will be closed in 24 hours".
- They ask you to sign in through a link, or ask for a code or password.
- The sender address does not end in onboardops.org, or the link goes somewhere other than onboardops.org.
- They ask you to pay, or to download an attachment.

## How we actually contact you
- Real emails come from notifications@onboardops.org.
- We never ask for your password, backup codes or sign-in codes.
- When in doubt, type onboardops.org into your browser yourself instead of using a link.

>! If you already entered your details on a suspicious page, change your password immediately and tell us.

## What to do with a fake email
Do not reply or click anything. Forward it to us from the help center at {{support_url}} and then delete it. Please also warn your team, since staff members are targeted too.
`),

  tpl(C, "vulnerability-disclosure", "Vulnerability fixed (disclosure)", "Tell customers about a security issue after it was fixed", "shield",
    "Security update: we fixed an issue reported to us", "A fixed issue, who it could have affected and what you need to do.",
    ["Read the details", "{{action_url}}"], `
Hi {{name}},

A security researcher reported a vulnerability in OnboardOps. We have fixed it, and we are telling you openly what it was and what it meant for you.

[details]
Reported: {{date}}
Fixed: {{fixed_date}}
Area: {{area}}
Reference: {{incident_id}}

## What the issue was
{{what_happened}}

## Was anyone affected
{{data_involved}}

## What we did
- Fixed the cause and tested the fix.
- Checked our logs for signs the issue had been used before it was reported.
- Added a check so a similar mistake is caught before release in the future.

## What you need to do
{{customer_action}}

We thank the person who reported this to us responsibly. If you find a security problem, please tell us through {{support_url}} and keep the details private until we have fixed it.
`),

  tpl(C, "security-patch", "Security update applied (no action needed)", "Routine security patching completed", "shield",
    "Security update applied to OnboardOps", "No action is needed on your part.",
    undefined, `
Hi {{name}},

This is a short note to let you know that we applied a security update to OnboardOps on {{date}}.

>+ No action is needed from you. Your data was not affected and there was no downtime.

## What changed
{{what_changed}}

## Why we are telling you
We prefer to over-communicate about security. Keeping software patched is one of the most important things we do, and we want you to see that it happens regularly.

## More information
You can read how we protect your data on our security page at {{security_url}}. If you have a question about this update, reply to this email.
`),

  tpl(C, "sessions-reset", "All sessions signed out", "We signed everyone out as a precaution", "lock",
    "Precaution: we signed you out of OnboardOps", "You need to sign in again.",
    ["Sign in again", "{{login_url}}"], `
Hi {{name}},

As a precaution, we signed everyone out of OnboardOps on {{date}}. You will need to sign in again the next time you open the app.

## Why we did this
{{reason}}

## What this means
- Your records and settings were not changed or deleted.
- Anything you were typing and had not saved may have been lost.
- Two-step sign-in and your password still work as before.

## What to do
1. Select the button above and sign in.
2. If you use a shared computer, make sure it is signed out when you finish.
3. If you notice anything unusual after signing in, tell us right away.

We are sorry for the interruption. Protecting your team's records comes first.
`),

  tpl(C, "forced-reset", "Password reset required", "A password change is required after an incident", "key",
    "Please reset your OnboardOps password", "We need you to choose a new password.",
    ["Reset my password", "{{action_url}}"], `
Hi {{name}},

We need you to choose a new password for your OnboardOps account. This is a precaution following {{reason}}.

>! Your old password has been turned off, so you will not be able to sign in with it.

## How to reset it
1. Select the button above. It works for a limited time.
2. Choose a new, unique password. A passphrase of several words is a good choice.
3. Do not reuse a password from another website.
4. Sign in and check that two-step sign-in is on.

## If the link has expired
Go to {{login_url}} and choose "Forgot password" to get a fresh one.

We will never ask you for your password, so please do not send it to anyone, including us.
`),

  tpl(C, "provider-incident", "Incident at a service provider", "A company we rely on had a security incident", "alert",
    "A service provider we use reported a security incident", "What it means for your data and what we are doing.",
    ["Read our update", "{{status_url}}"], `
Hi {{name}},

A company that provides part of our service, {{provider}}, has told us about a security incident on their side. We are sharing what we know about how it may affect you.

[details]
Provider: {{provider}}
Reported to us: {{date}}
Our reference: {{incident_id}}

## What they told us
{{what_happened}}

## Is your data affected
{{data_involved}}

## What we are doing
- Reviewing exactly what data we share with this provider.
- Asking them for a full written report and checking what they changed.
- Deciding whether to change how we use them.

## What you should do
{{customer_action}}

We will update you as soon as we know more. Live status is always on {{status_url}}.
`),

  tpl(C, "incident-update", "Security incident update", "A progress update on an ongoing investigation", "clock",
    "Update on security incident {{incident_id}}", "Here is where the investigation stands.",
    ["See the latest status", "{{status_url}}"], `
Hi {{name}},

Here is an update on the security incident we told you about earlier (reference {{incident_id}}).

[details]
Current status: {{status}}
Last updated: {{date}} at {{time}}

## What we have learned since the last update
{{update}}

## What we are doing next
{{next_steps}}

## What you need to do
{{customer_action}}

We will send the next update by {{next_update}}, or sooner if anything important changes.
`),

  tpl(C, "incident-resolved", "Security incident resolved", "Close out an incident with a plain summary", "seal",
    "Resolved: security incident {{incident_id}}", "The incident is closed. Here is the summary.",
    ["Read the summary", "{{action_url}}"], `
Hi {{name}},

The security incident we told you about (reference {{incident_id}}) is now resolved.

>+ Resolved on {{date}}. The access path is closed and monitoring continues.

## Summary
{{what_happened}}

## What was affected
{{data_involved}}

## What we changed so it does not happen again
- {{change_one}}
- {{change_two}}
- {{change_three}}

## What you may still want to do
{{customer_action}}

Thank you for your patience. If you have questions about the summary, reply to this email and a person will answer.
`),

  tpl(C, "traffic-attack", "Attack traffic mitigated", "We handled unusual or hostile traffic", "shield",
    "We mitigated unusual traffic against OnboardOps", "You may have noticed slowness. Here is what happened.",
    ["Check service status", "{{status_url}}"], `
Hi {{name}},

Between {{start_time}} and {{end_time}} on {{date}}, OnboardOps received a large amount of unusual traffic. Some people may have seen slow pages or errors.

## What happened
{{what_happened}}

## Your data
>+ Your records were not accessed, changed or deleted. This kind of traffic tries to overload a service rather than steal from it.

## What we did
- Filtered the traffic and put extra protection in front of the app.
- Watched error rates until they returned to normal.
- Reviewed the logs to confirm nothing else was going on behind the noise.

If you had trouble during that window, please try again. Anything you saved and received a confirmation for was saved correctly.
`),

  tpl(C, "limited-exposure", "Limited exposure of specific records", "A small set of records was exposed to the wrong people", "eye",
    "Notice: some records were visible to the wrong people", "A limited issue we found and fixed.",
    ["See which records", "{{action_url}}"], `
Hi {{name}},

We found a problem that made a limited set of records in your workspace visible to people who should not have been able to see them. It is fixed, and we want you to know the details.

[details]
Records affected: {{record_count}}
Who could see them: {{who_could_see}}
Time window: {{start_time}} to {{end_time}} on {{date}}
Reference: {{incident_id}}

## What caused it
{{what_happened}}

## What we did
- Fixed the permission problem and verified it with tests.
- Checked the audit log to see whether anyone actually opened the records.
- Contacted you first, before anyone else, so you can decide what to do.

## Our findings
{{findings}}

## What we suggest
If these records include sensitive information about employees, consider whether you should tell the people involved. We can export the relevant audit entries for you.
`),

  tpl(C, "support-access", "Our staff accessed your workspace", "Explain a support access session we started at your request", "eye",
    "Support access to your workspace: what we did", "A record of a read-only support session.",
    ["View it in your audit log", "{{action_url}}"], `
Hi {{name}},

A member of our support team opened a read-only support session in your workspace "{{workspace}}". Here is a summary so you have a full record.

[details]
Opened by: {{staff_name}}
Reason you were shown: {{reason}}
Date: {{date}}
Length: {{duration}}

## What support access means
- It is read-only. We cannot change, delete or add records.
- Confidential manager notes, documents and reviews are not visible to us.
- It lasts for a limited time and then ends by itself.
- It appears in your audit log, which cannot be edited.

## Why it happened
{{what_happened}}

If you did not expect this, or you would like us to explain further, reply to this email and we will go through it with you.
`),

  tpl(C, "security-summary", "Security summary available", "Share how you protect customer data", "seal",
    "Our security summary for your review", "A printable summary you can share with your team or auditors.",
    ["Open the security page", "{{security_url}}"], `
Hi {{name}},

Many customers ask us how we protect their data, so we keep a plain-language summary that is easy to share with owners, managers and anyone who reviews vendors for you.

## What it covers
- How data is encrypted when stored and when it moves.
- Who can see what, including roles and the confidential notes controls.
- The tamper-evident audit log.
- Sign-in protection, including two-step sign-in and single sign-on.
- How we handle incidents and tell you about them.

## What it does not claim
>! We are open about what we have not done yet. The summary lists it, because no system can be guaranteed 100% secure. We do not claim certifications we do not hold.

You can print the summary or save it as a PDF from the security page. If your reviewer needs a detail that is not there, reply and we will find the answer.
`),
];
