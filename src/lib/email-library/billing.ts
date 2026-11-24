import { tpl } from "./types";

const C = "Billing & Plans" as const;

export const BILLING = [
  tpl(C, "beta-continues", "The free beta continues", "Reassure customers that nothing is changing yet", "seal",
    "Good news: OnboardOps stays free during the beta", "No change to your plan.",
    ["See what's new", "{{changelog_url}}"], `
Hi {{name}},

Some customers have asked whether anything is changing about price. This is a short note to say clearly where we stand.

>+ OnboardOps is free during the beta. There is no credit card, no trial clock and no limit on staff.

## What this means
- You do not need to do anything.
- You will not be charged unless you choose to move to a paid plan, if one is introduced.
- Your records and settings stay as they are.

## If that changes
If we introduce paid plans, we will announce them in our changelog first, and we will email you well in advance. Nothing will switch on without notice.

## Why we are telling you
We would rather you hear it from us than wonder. If you have a question about cost, reply to this email and a person will answer.

Thank you for being part of the beta.
`),

  tpl(C, "paid-plans", "Paid plans announced (advance notice)", "Announce paid plans well before they begin", "calendar",
    "Advance notice: paid plans for OnboardOps", "What is changing, when, and your options.",
    ["See the plans", "{{action_url}}"], `
Hi {{name}},

We are introducing paid plans for OnboardOps. We are telling you early so you can plan, and so you can tell us what you think.

[details]
Announced: {{date}}
Paid plans start: {{effective_date}}
Your current plan: {{plan}}
What you pay until then: Nothing

## What is changing
{{what_changed}}

## What you can expect
- At least {{notice_days}} days before anything is charged, we will tell you exactly what your plan costs.
- You will choose whether to continue. We will never charge you without asking first.
- You can export all your data at any time, whatever you decide.

## Why we are doing this
{{reason}}

## Questions
Reply to this email. We would rather talk it through than have you guess.
`),

  tpl(C, "plan-change", "Plan change confirmation", "Confirm that a plan was changed", "verify",
    "Your OnboardOps plan has changed", "Here is what changed and when.",
    ["View my plan", "{{action_url}}"], `
Hi {{name}},

This confirms a change to your plan for {{workspace}}.

[details]
Previous plan: {{old_plan}}
New plan: {{plan}}
Takes effect: {{date}}
Billing: {{amount}} per {{period}}

## What changes for you
{{what_changed}}

## What stays the same
Your data, your settings and your team's access are not affected by a plan change.

## Not what you expected
If you did not ask for this, or something looks wrong, reply to this email right away and we will put it right.
`),

  tpl(C, "price-change", "Price change notice", "Give notice before a price changes", "alert",
    "Notice: a change to your price from {{date}}", "Your new price and what you can do.",
    ["Review your plan", "{{action_url}}"], `
Hi {{name}},

We are writing to let you know that the price of your plan will change.

[details]
Current price: {{old_amount}} per {{period}}
New price: {{amount}} per {{period}}
Takes effect: {{date}}
Applies to: {{workspace}}

## Why the price is changing
{{reason}}

## What you can do
1. Do nothing. The new price applies from {{date}}.
2. Choose a different plan before then, if one suits you better.
3. Cancel before {{date}} and export your data. You will not be charged the new price.

>! You will not be charged the new price before {{date}}.

## Questions
If this is a hardship for your team, tell us. We want to find something that works.
`),

  tpl(C, "receipt", "Payment receipt", "A clear receipt after a payment", "seal",
    "Receipt for your OnboardOps payment ({{invoice_number}})", "Thank you. Here is your receipt.",
    ["View the invoice", "{{action_url}}"], `
Hi {{name}},

Thank you for your payment. This is your receipt.

[details]
Invoice: {{invoice_number}}
Date: {{date}}
Plan: {{plan}}
Amount: {{amount}}
Payment method: {{payment_method}}
Workspace: {{workspace}}

## Keep it for your records
You can print or save this email. A copy of the invoice is available from your workspace settings.

## If something looks wrong
Check that the amount and plan are what you expect. If not, reply to this email with the invoice number and we will look into it.

Thank you for choosing OnboardOps.
`),

  tpl(C, "payment-failed", "Payment failed", "Ask the customer to update a failed payment", "alert",
    "Action needed: your payment did not go through", "Update your payment details to keep your plan.",
    ["Update payment details", "{{action_url}}"], `
Hi {{name}},

We could not take payment for {{workspace}}, and we do not want you to lose access by accident.

[details]
Amount: {{amount}}
Attempted: {{date}}
Reason given: {{reason}}

## What to do
1. Select the button above.
2. Check that your card details are correct and have not expired.
3. Make sure your bank is not blocking the payment.
4. Try again.

>! We will try again on {{retry_date}}. If it still does not work, your workspace may move to {{fallback}}.

## Your data is safe
Nothing is deleted if a payment fails. You can export your data at any time.

If you think the payment should have worked, reply and we will check from our side.
`),

  tpl(C, "renewal-reminder", "Upcoming renewal reminder", "Remind customers before a renewal", "clock",
    "Your OnboardOps plan renews on {{date}}", "No action is needed unless you want to change something.",
    ["Manage my plan", "{{action_url}}"], `
Hi {{name}},

A reminder that your plan renews soon.

[details]
Renews on: {{date}}
Plan: {{plan}}
Amount: {{amount}}
Payment method: {{payment_method}}

## What you need to do
>+ Nothing, if you want to continue. Your plan renews automatically.

## If you want to change something
- To change plan or payment method, open your plan settings before {{date}}.
- To stop the renewal, cancel before {{date}}. You will keep access until the end of the period you paid for.

Export your data first if you plan to leave. If you have a question about the amount, reply to this email.
`),

  tpl(C, "beta-ending", "The beta is ending", "Give notice that the beta period closes", "calendar",
    "The OnboardOps beta ends on {{date}}", "What happens next and your options.",
    ["See your options", "{{action_url}}"], `
Hi {{name}},

Our beta period is ending on {{date}}. Thank you for being one of the teams that helped shape OnboardOps. Here is what happens next.

[details]
Beta ends: {{date}}
Your workspace: {{workspace}}
What changes: {{what_changed}}

## Your options
1. Continue on a paid plan and keep everything as it is.
2. Move to a free plan, if we offer one, with {{limits}}.
3. Export your data and leave. Everything is yours.

## What happens if you do nothing
{{impact}}

## Thank you
Beta users get {{thank_you}}. We could not have built this without you.

We will remind you again before the date. Questions are welcome at any time.
`),

  tpl(C, "refund", "Refund processed", "Confirm that a refund has been sent", "seal",
    "Your OnboardOps refund has been processed", "The money is on its way back to you.",
    undefined, `
Hi {{name}},

We have processed your refund.

[details]
Amount refunded: {{amount}}
Original payment: {{invoice_number}}
Refunded to: {{payment_method}}
Processed: {{date}}

## When you will see it
Refunds usually appear within {{refund_days}} business days, depending on your bank or card provider. If it has not arrived after that time, contact your bank first, then tell us.

## About your account
{{what_changed}}

We are sorry we could not meet your needs this time. If you would tell us what was missing, it would help us improve.
`),

  tpl(C, "billing-contact", "Billing contact updated", "Confirm a change of billing contact", "verify",
    "Your billing contact has been updated", "Check that this is correct.",
    ["Review billing settings", "{{action_url}}"], `
Hi {{name}},

The billing contact for {{workspace}} was changed.

[details]
New contact: {{contact_email}}
Changed by: {{changed_by}}
Date: {{date}}

## What this means
Invoices, receipts and payment notices will now be sent to the new contact.

>! If you did not make this change, contact us right away and secure the account. Billing contacts can see invoices and payment details.

## If this was you
No action is needed. Thank you for keeping your details up to date.
`),
];
