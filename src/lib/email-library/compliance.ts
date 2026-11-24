import { tpl } from "./types";

const C = "Compliance & Data" as const;

export const COMPLIANCE = [
  tpl(C, "dsar-received", "Data request received", "Acknowledge a request about someone's personal data", "verify",
    "We received your data request ({{request_ref}})", "Here is what happens next.",
    undefined, `
Hi {{name}},

Thank you. We have received your request about your personal information, and we are looking into it.

[details]
Reference: {{request_ref}}
Received: {{date}}
Type of request: {{request_type}}
We will respond by: {{deadline}}

## What happens next
1. We confirm it is really you. We may ask you a question or two.
2. We find the information the request covers.
3. We send you our response, or tell you clearly why we cannot do part of it.

## Please note
- If the data you are asking about is held by your employer, they may be the right person to respond. We process it on their behalf and will tell them about your request where required.
- We will not ask for more personal information than we need to confirm who you are.

>! We will never ask for your password. If someone contacts you about this request and asks for it, it is not us.

If you have questions, reply to this email and include the reference above.
`),

  tpl(C, "data-export-ready", "Your data export is ready", "Tell an owner their export can be downloaded", "book",
    "Your OnboardOps data export is ready", "It is available for a short time.",
    ["Download the export", "{{action_url}}"], `
Hi {{name}},

The export you asked for is ready.

[details]
Workspace: {{workspace}}
Created: {{date}}
Includes: {{data_involved}}
Available until: {{deadline}}

## How to download it
1. Select the button above and sign in.
2. Download the file and save it somewhere safe.
3. The link stops working after the date above, for your protection.

>! The export contains personal information about your employees. Store it securely, share it only with people who need it, and delete it when you no longer do.

## If the link does not work
Request a new export from your workspace settings.

## Need help reading it
Reply and tell us what you want to do with it. We will explain how the data is organized.
`),

  tpl(C, "deletion-complete", "Data deletion complete", "Confirm that requested data deletion is finished", "seal",
    "Your data deletion is complete ({{request_ref}})", "A record of what we deleted.",
    undefined, `
Hi {{name}},

We have completed the deletion you asked for.

[details]
Reference: {{request_ref}}
Completed: {{date}}
What was deleted: {{data_involved}}

## What we kept, and why
{{kept}}

## Backups
Deleted data may stay in secure backups for up to {{backup_days}} days, until they are overwritten. It is not used for any other purpose in that time.

## What you can do
- Keep this email as proof that we completed your request.
- If you think something was missed, reply with the reference above, and we will check.

Thank you for your patience while we made sure it was done properly.
`),

  tpl(C, "retention-reminder", "Records scheduled for deletion", "Warn an owner before records are removed", "calendar",
    "Records in {{workspace}} will be deleted on {{date}}", "Export or place a hold if you need them.",
    ["Review the records", "{{action_url}}"], `
Hi {{name}},

Under your retention settings, some records in {{workspace}} are about to be deleted automatically.

[details]
What: {{data_type}}
Will be deleted on: {{date}}
How many: {{record_count}}
Retention period: {{new_period}}

## What you can do before then
1. **Export** anything you want to keep.
2. **Place a legal hold** on records you must keep for an investigation or dispute. Held records are not deleted.
3. **Change your retention period** in Settings, if it is shorter than you need.

>!! Deleted records cannot be recovered. Please act before {{date}} if you are unsure.

## Why we send this
Deleting data after a set time is good practice. We email first so nothing disappears without your knowing.
`),

  tpl(C, "audit-export", "Audit log export", "Deliver an audit log export", "pen",
    "Your audit log export is ready", "A record of activity in your workspace.",
    ["Download the audit log", "{{action_url}}"], `
Hi {{name}},

The audit log export for {{workspace}} is ready.

[details]
Period covered: {{start_date}} to {{end_date}}
Entries: {{record_count}}
Created: {{date}}

## About the audit log
- Every important action is recorded: who did it, what and when.
- Each entry is linked to the one before it, so any change to history is detectable.
- Entries cannot be edited or removed.

## How to use it
Use the export for an audit, an insurer or an internal review. If you need to prove it has not been changed, the file includes the information needed to verify the chain.

>! The log can include names and details of your staff. Keep the file secure and share it only where needed.
`),

  tpl(C, "legal-hold-applied", "Legal hold applied", "Confirm a legal hold on records", "lock",
    "A legal hold was placed on records in {{workspace}}", "These records will not be deleted.",
    ["View held records", "{{action_url}}"], `
Hi {{name}},

A legal hold has been placed on records in {{workspace}}.

[details]
Placed by: {{changed_by}}
Date: {{date}}
Scope: {{scope}}
Reason recorded: {{reason}}

## What it means
- Held records are kept even if your retention settings would normally delete them.
- Held records can still be read by people who are allowed to see them.
- Everything is recorded in the audit log.

## What to do
If this was expected, no action is needed. If it was not, check with the person who placed it, since a hold affects how long data is kept.

>+ A hold stays until someone with permission releases it. We will send another email when that happens.
`),

  tpl(C, "privacy-review", "Annual privacy review reminder", "Remind owners to review their employee privacy practices", "eye",
    "A yearly check: is your employee privacy notice up to date?", "A short checklist.",
    ["Read the Employee Privacy Notice", "{{app_url}}/legal/employee-notice"], `
Hi {{name}},

Once a year, it is worth checking that what you tell your employees about their records still matches what you do. Here is a short checklist.

## Questions to ask
1. Have we added any new kinds of records, such as documents, reviews or credentials?
2. Do our staff know who can see their records?
3. Have our roles changed? Does everyone have the right access?
4. Do we still need to keep older records, or can they be removed?
5. Have we shared the Employee Privacy Notice with new staff?

## What to do next
- Look through your roles and remove access nobody needs.
- Check your retention settings match your policy.
- Share the Employee Privacy Notice again at your next team meeting or in your handbook.

>! This is general information, not legal advice. If you are unsure about your obligations, ask a qualified advisor.

If you would like help finding a setting, reply and tell us what you are trying to do.
`),
];
