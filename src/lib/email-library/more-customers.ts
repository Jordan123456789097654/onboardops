import { tpl } from "./types";

const ONB = "Onboarding & Welcome" as const;
const CS = "Customer Success" as const;
const BIL = "Billing & Plans" as const;
const PRD = "Product Updates" as const;

export const MORE_ONBOARDING = [
  tpl(ONB, "demo-followup", "Follow-up after a demo", "Sent after a live demo or call, with the next steps", "chat",
    "Following up on our conversation, {{name}}", "A short recap and what to do next.",
    ["Create your workspace", "{{action_url}}"], `
Hi {{name}},

Thank you for the time on {{date}}. Here is a short recap so you do not have to dig through notes.

## What we talked about
- {{topic_one}}
- {{topic_two}}

## What we suggest as a next step
1. Create a workspace. It takes a few minutes and it is free during the beta.
2. Add one department and invite two or three people.
3. Assign one course so you can see the whole loop, from training to certificate.

If a question came up that I did not answer well, reply to this email and I will get you a straight answer.
`),

  tpl(ONB, "call-booked", "Onboarding call booked", "Confirms a call and tells them what to prepare", "calendar",
    "Your OnboardOps call is booked for {{date}}", "Here is what to have ready.",
    ["Add to calendar", "{{action_url}}"], `
Hi {{name}},

Your call is booked.

[details]
When: {{date}} at {{time}} {{timezone}}
Length: {{duration}}
Where: {{location}}

## To make the most of it
- Have a rough list of your departments and job roles.
- Think about the first course you would want every new hire to take.
- Bring any questions about records, discipline or privacy.

If the time stops working, reply with a better one and we will move it. You do not need to apologize.
`),

  tpl(ONB, "import-help", "Help moving your staff list in", "Offer to guide a CSV import when someone is stuck", "invite",
    "Want help getting your staff list into OnboardOps?", "Most imports take about ten minutes with a little guidance.",
    ["Open the import page", "{{action_url}}"], `
Hi {{name}},

We noticed you started setting up {{workspace}} but have not added your staff yet. Importing a spreadsheet is the step people get stuck on most, so here is the short version.

## How the import works
1. Save your list as a CSV file. A name and an email for each person is enough to start.
2. Upload it on the import page. You will see a preview before anything is saved.
3. Match your columns to ours if the headings differ. Rows that cannot be imported are listed with the reason, so nothing disappears quietly.

>+ Send us the file or a sample with the names removed and we will tell you exactly how to arrange it.

Just reply to this email if you would like us to look.
`),

  tpl(ONB, "setup-stalled", "Setup stalled", "A kind nudge when setup stopped partway", "clock",
    "You are nearly set up, {{name}}", "A few steps left for {{workspace}}.",
    ["Continue setup", "{{login_url}}"], `
Hi {{name}},

{{workspace}} is set up through {{last_step}}. Two things are left:

1. {{next_one}}
2. {{next_two}}

Most teams finish in about fifteen minutes. If a step was unclear, tell us which one and we will help or fix the wording.
`),

  tpl(ONB, "beta-invite", "Invitation to the beta", "Invite someone from a waitlist or a referral", "welcome",
    "You are invited to try OnboardOps", "Free during the beta, with no credit card.",
    ["Create your free workspace", "{{action_url}}"], `
Hi {{name}},

You asked to hear when OnboardOps was ready, and it is. We are inviting people in gradually, and you are in this group.

## What you get
- Training with graded quizzes and certificates.
- Infraction records with confidential notes and appeals.
- Shift checklists, scheduling and handoff notes.

>+ The beta is free. There is no credit card, no trial clock and no limit on staff.

## What we ask in return
Tell us what is confusing or missing. Every reply is read by the person who builds it.
`),

  tpl(ONB, "waitlist-ready", "Waitlist spot is ready", "Tell a waitlisted person they can start", "welcome",
    "Your spot is ready, {{name}}", "You can create your workspace now.",
    ["Create my workspace", "{{action_url}}"], `
Hi {{name}},

Thanks for waiting. Your spot on the OnboardOps waitlist is ready, and you can create your workspace now.

This link is just for you and stays active until {{deadline}}. After that you can still sign up from our website, so nothing is lost.

If you have questions before you start, reply to this email.
`),

  tpl(ONB, "manager-training", "Offer to train your managers", "Offer a short session for managers", "team",
    "A short session for your managers", "Thirty minutes so they can use records and training with confidence.",
    ["Pick a time", "{{action_url}}"], `
Hi {{name}},

Managers are the people who use OnboardOps most, and they are often the last to get a walkthrough. We can run a short live session for yours at no cost.

## What we would cover
- Writing a fair, factual record, and when not to write one up.
- Assigning training and reading the results.
- What employees can see, so there are no surprises.

Pick a time that suits your team. A recording is available if some cannot attend.
`),
];

export const MORE_SUCCESS = [
  tpl(CS, "usage-summary", "Monthly summary", "A short account of what the workspace did this month", "book",
    "Your {{period}} summary for {{workspace}}", "A quick look at what your team did.",
    ["Open the reports page", "{{action_url}}"], `
Hi {{name}},

Here is how {{workspace}} did in {{period}}.

[details]
Courses completed: {{count}}
Overdue training: {{overdue}}
Credentials expiring soon: {{expiring}}

## Worth a look
- {{note_one}}
- {{note_two}}

The full numbers, with charts, are on the reports page.
`),

  tpl(CS, "milestone", "Milestone reached", "Celebrate a real milestone", "welcome",
    "{{workspace}} just hit a milestone", "Thank you for building this with us.",
    undefined, `
Hi {{name}},

A small thing worth celebrating: {{milestone}}.

Most of that is your team doing the work, not us. If there is something that would make the next stretch easier, tell us. We would rather build what you actually need.
`),

  tpl(CS, "unused-feature", "A feature your team has not tried", "Point out one feature that fits how they already use the product", "magic",
    "Have you tried {{feature}}?", "It fits what your team already does.",
    ["Take a look", "{{action_url}}"], `
Hi {{name}},

Your team uses OnboardOps for {{current_use}}. Based on that, you may like {{feature}}.

## What it does
{{what_it_does}}

## How to start
1. {{step_one}}
2. {{step_two}}

It is optional, and you can switch it off in Settings, Features if it is not for you.
`),

  tpl(CS, "bug-acknowledged", "Bug report received", "Acknowledge a reported problem and set expectations", "alert",
    "We got your report, {{name}}", "We can reproduce it and are looking into it.",
    undefined, `
Hi {{name}},

Thank you for reporting this: {{issue}}.

## Where it stands
We have reproduced the problem and it is being worked on. Your reference is {{request_ref}}.

## What you can do meanwhile
{{workaround}}

We will email you again when it is fixed. If it starts to cost you real time, tell us and we will move it up.
`),

  tpl(CS, "bug-fixed", "Bug you reported is fixed", "Close the loop on a reported problem", "verify",
    "Fixed: {{issue}}", "The problem you reported is resolved.",
    undefined, `
Hi {{name}},

The problem you reported is fixed: {{issue}}.

[details]
Reference: {{request_ref}}
Fixed on: {{date}}

You may need to refresh the page for the fix to apply. If you still see it, reply and we will take another look right away.

Thank you for taking the time to report it.
`),

  tpl(CS, "feedback-thanks", "Thanks for your feedback", "A real reply to feedback, not an auto-response", "chat",
    "Thank you for your feedback", "It was read, and here is what happens next.",
    undefined, `
Hi {{name}},

Thank you for telling us {{topic}}. It was read by the person who builds the product.

## What happens next
{{outcome}}

You can follow and vote on what we build on the public roadmap. We write down who asked for what, and we tell people when it ships.
`),

  tpl(CS, "churn-survey", "Before you go", "One question to someone who has left or is leaving", "chat",
    "One question before you go", "Thirty seconds, and it really helps us.",
    ["Share your reason", "{{app_url}}/goodbye"], `
Hi {{name}},

Sorry to see {{workspace}} go. You do not owe us a reason, and this is not a sales pitch.

If you are willing, what was the main reason you stopped? One sentence is plenty. Reply here or use the button. It goes straight to the person who decides what we build.

Your records stay available to export for {{days}} days.
`),

  tpl(CS, "winback", "Come back, here is what is new", "Re-engage a former customer with real changes", "welcome",
    "We fixed what you told us about, {{name}}", "A few things that may have been missing for you.",
    ["See what is new", "{{changelog_url}}"], `
Hi {{name}},

When you left, you told us {{old_reason}}. Since then we have shipped:

- {{change_one}}
- {{change_two}}
- {{change_three}}

If that was the thing holding you back, it may be worth another look. Your old workspace is {{workspace_state}}.

If the answer is still no, that is fine. Telling us why still helps.
`),

  tpl(CS, "review-request", "Review request", "Ask a happy customer for a review", "chat",
    "Would you share a few words about OnboardOps?", "A short review helps other teams decide.",
    ["Write a short review", "{{action_url}}"], `
Hi {{name}},

You have been using OnboardOps for {{period}}, and we hope it has been useful. If it has, would you share a few words about your experience?

Two or three honest sentences are plenty, including what we could do better. We never ask for a rating in exchange for anything.
`),
];

export const MORE_BILLING = [
  tpl(BIL, "invoice-available", "Invoice available", "An invoice is ready to download", "book",
    "Invoice {{invoice_number}} is ready", "Your invoice for {{period}}.",
    ["View invoice", "{{action_url}}"], `
Hi {{name}},

Your invoice for {{period}} is ready.

[details]
Invoice: {{invoice_number}}
Amount: {{amount}}
Due: {{date}}

You can download it from the billing page. If anything on it looks wrong, reply and we will correct it.
`),

  tpl(BIL, "card-expiring", "Card expiring soon", "Warn before a payment method expires", "alert",
    "The card on file for {{workspace}} expires soon", "Update it to avoid an interruption.",
    ["Update payment method", "{{action_url}}"], `
Hi {{name}},

The card ending in {{last_four}} expires on {{date}}. If it is not updated, the next payment on {{renewal_date}} may fail.

Update it from the billing page. It takes about a minute.

>! If a payment fails, we will try again and email you before anything changes in your workspace.
`),

  tpl(BIL, "downgrade-confirm", "Downgrade confirmation", "Confirm a plan downgrade and what changes", "verify",
    "Your plan is changing to {{plan}}", "Here is what changes and when.",
    undefined, `
Hi {{name}},

We have changed {{workspace}} to the {{plan}} plan. This takes effect on {{date}}.

## What changes
- {{change_one}}
- {{change_two}}

## What does not change
Your records, courses and history are not deleted. If your workspace is over a limit on the new plan, nothing is removed. Some features simply become read-only until you are back within it.

You can switch back at any time from the billing page.
`),

  tpl(BIL, "cancellation-confirm", "Cancellation confirmation", "Confirm a cancellation and what happens to the data", "verify",
    "Your cancellation is confirmed", "Here is what happens to your workspace.",
    ["Export your data", "{{action_url}}"], `
Hi {{name}},

We have cancelled {{workspace}}. You will not be charged again.

## What happens next
1. Your workspace stays available until {{date}}.
2. You can export everything from Settings until then.
3. After that, records are deleted on the schedule in our retention policy. Anything we are legally required to keep is kept only for that purpose.

If this was a mistake, reply before {{date}} and we will restore it.
`),

  tpl(BIL, "annual-offer", "Annual plan offer", "Offer a real annual option when one exists", "calendar",
    "Pay once a year and save", "An annual option for {{workspace}}.",
    ["See the annual plan", "{{action_url}}"], `
Hi {{name}},

You can now pay for {{plan}} once a year instead of monthly.

[details]
Monthly: {{monthly_price}}
Annual: {{annual_price}}
You save: {{savings}}

The change applies at your next renewal on {{renewal_date}}. You can switch back to monthly any time. If you leave early, we refund the unused months.
`),

  tpl(BIL, "tax-details", "Add your tax details", "Ask for a tax ID or billing address", "pen",
    "We need your tax details for invoicing", "A quick update on the billing page.",
    ["Update billing details", "{{action_url}}"], `
Hi {{name}},

To issue correct invoices for {{workspace}}, we need your {{required_info}}. You can add it on the billing page.

Invoices already issued can be reissued with the new details if you ask. Only people with billing access can see or change this information.
`),

  tpl(BIL, "service-credit", "Service credit after an outage", "Apply a credit when we missed our commitment", "verify",
    "A credit for the outage on {{date}}", "We have applied it to your account.",
    undefined, `
Hi {{name}},

The outage on {{date}} lasted {{duration}}, and that is not the service we want to give you.

We have applied a credit of {{amount}} to {{workspace}}. It will appear on your next invoice, and you do not need to do anything.

You can read exactly what happened in our post-incident review: {{status_url}}.

Thank you for your patience, and tell us if the outage caused you a problem we should know about.
`),

  tpl(BIL, "quote", "Custom quote", "Send a quote for a larger or unusual setup", "book",
    "Your OnboardOps quote, {{name}}", "Pricing for {{workspace}}, valid until {{deadline}}.",
    ["Review and accept", "{{action_url}}"], `
Hi {{name}},

Here is the quote we discussed.

[details]
Plan: {{plan}}
Price: {{amount}}
Term: {{period}}
Valid until: {{deadline}}

## What is included
- {{included_one}}
- {{included_two}}

If you need a purchase order, a security review or changes to the contract terms, tell us now and we will get them ready.
`),
];

export const MORE_PRODUCT = [
  tpl(PRD, "early-access", "Early access to a feature", "Invite chosen customers to try something before launch", "magic",
    "Try {{feature}} before everyone else", "Early access, and we would like your feedback.",
    ["Turn it on", "{{action_url}}"], `
Hi {{name}},

We are about to release {{feature}} and would like you to try it first.

## What it does
{{what_it_does}}

## What to expect
It is still being tested, so you may find rough edges. Turn it on in Settings, Features, and turn it off the same way if it gets in your way.

>! Please do not use it for anything you cannot redo until it is released.

Tell us what works and what does not. You will shape the final version.
`),

  tpl(PRD, "live-demo", "Invitation to a live demo", "Invite customers to a scheduled session", "calendar",
    "Join our live walkthrough on {{date}}", "A short session with time for your questions.",
    ["Save my seat", "{{action_url}}"], `
Hi {{name}},

We are running a live walkthrough of {{topic}} on {{date}} at {{time}} {{timezone}}.

## What we will cover
- {{item_one}}
- {{item_two}}

It lasts about {{duration}}, with time at the end for your questions. A recording will be sent to everyone who registers.
`),

  tpl(PRD, "newsletter-issue", "New newsletter issue", "Short email pointing to an issue on the website", "book",
    "{{issue_title}}", "A new issue of the OnboardOps newsletter.",
    ["Read this on the website", "{{action_url}}"], `
Hi {{name}},

A new issue is up: {{issue_title}}.

{{issue_summary}}

Every issue is posted on the website, and we only email the bigger ones. You can unsubscribe at the bottom of this email.
`),
];
