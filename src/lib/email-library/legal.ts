import { tpl } from "./types";

const C = "Legal & Policy" as const;

export const LEGAL = [
  tpl(C, "privacy-update", "Privacy Policy update", "Tell people the Privacy Policy changed and when it takes effect", "pen",
    "We are updating our Privacy Policy (effective {{date}})", "A summary of what is changing and why.",
    ["Read the Privacy Policy", "{{privacy_url}}"], `
Hi {{name}},

We are updating the OnboardOps Privacy Policy. The new version takes effect on {{date}}. This email explains what is changing in plain words so you do not have to read the whole document to find out.

## What is changing
- {{change_one}}
- {{change_two}}
- {{change_three}}

## Why we are making these changes
{{reason}}

## What it means for you
{{impact}}

## What you need to do
>+ Nothing, unless you object. If you keep using OnboardOps after {{date}}, the updated policy applies.

If you do not agree with the changes, you can export your data and close your workspace before the effective date. Contact us at {{support_url}} and we will help.

The full policy, with the date of each version, is always available at {{privacy_url}}.
`),

  tpl(C, "terms-update", "Terms of Service update", "Notice of changes to the Terms of Service", "pen",
    "Changes to the OnboardOps Terms of Service ({{date}})", "Here is what is changing in the Terms.",
    ["Read the updated Terms", "{{terms_url}}"], `
Hi {{name}},

We are making changes to the OnboardOps Terms of Service. They take effect on {{date}}.

## Summary of changes
- {{change_one}}
- {{change_two}}
- {{change_three}}

## Why
{{reason}}

## Your options
1. Do nothing. Continuing to use OnboardOps after {{date}} means you accept the updated Terms.
2. Read the full text at {{terms_url}} and tell us if something concerns you.
3. If you do not accept the changes, you can stop using the service and export your data first.

>! Workspace Owners and Admins: please share this notice with anyone in your team who manages the account.

If you have a signed agreement with us that differs from the standard Terms, it continues to apply where it says so.
`),

  tpl(C, "dpa-update", "Data Processing Addendum update", "Tell customers the DPA was updated", "seal",
    "Updated Data Processing Addendum (effective {{date}})", "What changed in the DPA and what to do.",
    ["Read the Data Processing Addendum", "{{app_url}}/legal/data-processing"], `
Hi {{name}},

We have updated the OnboardOps Data Processing Addendum (DPA), which describes how we handle personal information on your behalf. The update takes effect on {{date}}.

## What changed
- {{change_one}}
- {{change_two}}

## Why it matters
Employers who use OnboardOps are the ones responsible for their employees' information, and we process it for you. The DPA is where we put in writing what we will and will not do with it.

## What we ask of you
{{customer_action}}

[details]
Effective date: {{date}}
Applies to: All workspaces on the standard DPA
Version: {{version}}

If you need a signed copy for your records or a review by your own legal advisor, reply to this email.
`),

  tpl(C, "subprocessor-added", "New subprocessor (advance notice)", "Give notice before a new subprocessor handles customer data", "eye",
    "Advance notice: new subprocessor {{provider}} (effective {{date}})", "You have time to review and object before this takes effect.",
    ["See the subprocessor list", "{{app_url}}/legal/data-processing"], `
Hi {{name}},

Our Data Processing Addendum says we will tell you before we add a new subprocessor, a company that handles personal information on our behalf. This is that notice.

[details]
Subprocessor: {{provider}}
What they do for us: {{purpose}}
What information they receive: {{data_involved}}
Where they process it: {{location}}
Takes effect: {{date}}

## Why we are adding them
{{reason}}

## How to object
>! You have 14 days from the date of this email to object. If you have a reasonable concern about how this provider handles personal information, reply to this email and tell us why.

## What happens if you object
We will work with you to find a solution. If we cannot, you may end your use of the service and export your data.

Our current list of subprocessors is always on the Data Processing Addendum page.
`),

  tpl(C, "subprocessor-removed", "Subprocessor removed", "Tell customers a provider no longer handles their data", "seal",
    "We no longer use {{provider}} for OnboardOps", "A change to our list of subprocessors.",
    undefined, `
Hi {{name}},

We have stopped using {{provider}} as a subprocessor for OnboardOps. This email is to keep our subprocessor list and your records accurate.

[details]
Provider: {{provider}}
Stopped on: {{date}}
What they did for us: {{purpose}}

## What happened to the data they held
{{data_involved}}

## What replaced them
{{replacement}}

>+ This change reduces, and does not add to, the places your data is processed.

The updated list is on the Data Processing Addendum page. No action is needed from you.
`),

  tpl(C, "cookie-update", "Cookie Policy update", "Notice of a change to cookies or similar technology", "eye",
    "Update to our Cookie Policy", "What we use in your browser and what changed.",
    ["Read the Cookie Policy", "{{app_url}}/legal/cookies"], `
Hi {{name}},

We are updating our Cookie Policy, which explains the cookies and similar technology OnboardOps uses in your browser.

## What is changing
{{what_changed}}

## What we use today
- Cookies that keep you signed in and remember your workspace. The app does not work without them.
- Local storage for preferences such as your theme.

## What we do not use
We do not use advertising cookies, cross-site tracking or social media tracking pixels.

## Your choices
>+ If this change needs your consent, we will ask before we set anything new. You can change your browser settings at any time to block or delete cookies, although parts of the app may stop working.

The full policy is at the link above and lists every cookie by name and purpose.
`),

  tpl(C, "aup-update", "Acceptable Use Policy update", "Notice of changes to the Acceptable Use Policy", "pen",
    "Changes to the OnboardOps Acceptable Use Policy", "What is and is not allowed is being clarified.",
    ["Read the Acceptable Use Policy", "{{action_url}}"], `
Hi {{name}},

We are updating the Acceptable Use Policy, which sets out how OnboardOps can and cannot be used. The changes take effect on {{date}}.

## What is changing
- {{change_one}}
- {{change_two}}

## Examples of what the policy is for
- Keeping the service safe and available for everyone.
- Stopping the use of OnboardOps to harass or unfairly target people.
- Keeping out content that is illegal or that you do not have the right to share.

## What this means for most customers
>+ Nothing changes in how you use OnboardOps day to day. The policy exists to handle problems, and most teams will never notice it.

If you have a use case you are unsure about, ask us before you start. We would rather answer a question than deal with a problem.
`),

  tpl(C, "beta-terms-update", "Beta Program Terms update", "Update the terms that apply to the beta", "pen",
    "Update to the OnboardOps Beta Program Terms", "How the beta works is being clarified.",
    ["Read the Beta Program Terms", "{{app_url}}/legal/beta-terms"], `
Hi {{name}},

You are using OnboardOps during our beta. The Beta Program Terms explain what that means, and we are updating them as the product grows. The new version takes effect on {{date}}.

## What is changing
- {{change_one}}
- {{change_two}}

## What has not changed
- OnboardOps is free during the beta. If we introduce paid plans later, we will announce them in our changelog first.
- There is no uptime guarantee during the beta, though we work hard to keep the service reliable.
- You keep ownership of your data, and you can export it.

## Why we are updating them
{{reason}}

Your feedback shapes what we build. Reply to this email with anything you would like us to change in the product or in these terms.
`),

  tpl(C, "employee-notice-update", "Employee Privacy Notice update", "Prompt employers to update what they tell their staff", "team",
    "Updated Employee Privacy Notice for your team", "Please share this with your staff.",
    ["Read the Employee Privacy Notice", "{{app_url}}/legal/employee-notice"], `
Hi {{name}},

We have updated our Employee Privacy Notice. It is written for the people whose records are kept in OnboardOps, your staff, and explains what is stored and who can see it.

## Why this matters to you as an employer
In many places, employers must tell employees what information they keep about them and why. We wrote this notice so you have a clear, plain-language document to point to.

## What changed
- {{change_one}}
- {{change_two}}

## What we suggest you do
1. Read the notice and check it matches how you actually use OnboardOps.
2. Share the link with your team, for example in your handbook or onboarding pack.
3. If your location has specific notice rules, add anything extra you need.

>! This notice is general information, not legal advice. Check your own obligations with a qualified advisor.
`),

  tpl(C, "retention-update", "Data retention update", "Change in how long we keep records", "calendar",
    "Change to how long we keep data", "New retention periods take effect {{date}}.",
    ["See the retention policy", "{{action_url}}"], `
Hi {{name}},

We are changing how long OnboardOps keeps certain kinds of data. The new periods take effect on {{date}}.

[details]
Data type: {{data_type}}
Old period: {{old_period}}
New period: {{new_period}}
Takes effect: {{date}}

## Why we are making the change
{{reason}}

## What happens to existing data
{{impact}}

## What you can do
- Export anything you want to keep before {{date}}.
- Use the legal hold feature if you must keep records for a dispute or investigation. Held records are not deleted.
- Ask us if you need a longer period for your own records.

The retention policy is at the link above and always shows the current periods.
`),

  tpl(C, "ai-notice", "AI features notice", "Tell customers about AI features and how data is handled", "magic",
    "About the AI features in OnboardOps", "What they do, what is sent, and how to turn them off.",
    ["Read how AI is handled", "{{privacy_url}}"], `
Hi {{name}},

OnboardOps includes AI helpers, such as drafting a course from a procedure you paste in. We want you to know how they work and how to stay in control.

## What the AI does
- Writes drafts for you to read and edit. Nothing is saved until you save it.
- Helps with wording, translation, quizzes and summaries.
- Never makes a decision about an employee and never changes a record on its own.

## What is sent to our AI provider
Only what you give it for that task, such as the text you paste in. For tools that read case or employee text, names, emails and phone numbers are removed first. We do not store the text you send or the draft you receive.

## Your controls
1. Owners and Admins can turn AI features off in Settings.
2. Tools that read case or employee text can be switched off separately.
3. Use of AI is counted and recorded in your audit log, without the text.

>! AI can be wrong. Always read what it writes before you use it.

The Privacy Policy and Data Processing Addendum list our AI provider and what it receives.
`),

  tpl(C, "effective-reminder", "Policy takes effect soon (reminder)", "A reminder before changes take effect", "clock",
    "Reminder: our updated {{document}} takes effect on {{date}}", "A final reminder before the change.",
    ["Read the update", "{{action_url}}"], `
Hi {{name}},

This is a reminder that the updated {{document}} takes effect on {{date}}, in {{days}} days.

## A quick recap
{{what_changed}}

## What you need to do
>+ If you are happy to continue, nothing. If you have questions or objections, tell us before {{date}} so we can address them in time.

## Need more time or a copy for your records?
Reply to this email. We are happy to send a copy, answer questions, or arrange a call with someone who can explain the change.

Thank you for taking the time to read these updates. We know they are not the most exciting emails, and we try to send as few as possible.
`),

  tpl(C, "legal-process-notice", "Legal request for your data (notice)", "Tell a customer we received a legal request about their data", "alert",
    "Notice: we received a legal request involving your data", "What was requested and what we did.",
    undefined, `
Hi {{name}},

We received a legal request that involves information in your OnboardOps workspace "{{workspace}}". Where the law allows, we tell customers so they can respond themselves.

[details]
Received: {{date}}
Type of request: {{request_type}}
From: {{requester}}
Scope: {{scope}}

## What we did
- Reviewed the request with legal counsel to check it was valid and proper.
- Limited any response to the specific information the request covers.
- Kept a record of what was disclosed.

## What you can do
{{customer_action}}

>! Some requests come with a legal order that stops us from telling you. If you receive this email, we were able to tell you.

If you want to challenge the request, speak to your own legal advisor promptly. We can give them a copy of the request on your behalf.
`),

  tpl(C, "entity-change", "Company or address change", "Notice that our legal entity or contact details changed", "pen",
    "Notice of a change to our company details", "Update your records if you keep them.",
    ["See our contact details", "{{support_url}}"], `
Hi {{name}},

This is a notice that some of our company details have changed. We are telling you because your agreement with us refers to them.

[details]
What changed: {{what_changed}}
Takes effect: {{date}}
Previous details: {{old_details}}
New details: {{new_details}}

## Does this affect your agreement
>+ No. Your rights and ours stay the same. Only the name or address on the paperwork changes.

## What you might need to do
- Update your vendor records if you keep a list of suppliers.
- If you need a letter confirming the change for your accounting or legal team, reply and we will provide one.

You can always find our current details in the legal pages on our website.
`),
];
