import { tpl } from "./types";

const C = "Outages & Maintenance" as const;

export const OUTAGES = [
  tpl(C, "maint-scheduled", "Scheduled maintenance notice", "Advance notice of planned maintenance", "calendar",
    "Scheduled maintenance: {{date}}, {{start_time}} to {{end_time}}", "Plan ahead. Some features will be unavailable.",
    ["See live status", "{{status_url}}"], `
Hi {{name}},

We have scheduled maintenance on OnboardOps. Here is exactly when it happens and what you should expect.

[details]
Date: {{date}}
Start: {{start_time}} ({{timezone}})
Expected end: {{end_time}} ({{timezone}})
Affected: {{affected}}

## What we are doing
{{what_changed}}

## What you will notice
- {{affected}} will be unavailable or read-only during the window.
- You may be asked to sign in again afterwards.
- Anything you saved before the window starts is safe.

## How to prepare
1. Finish and save any work in progress before {{start_time}}.
2. If your team does shift checklists or clocks in during that time, use paper for the short window and enter it afterwards.
3. Let your team know, especially anyone working at that time.

>+ Your data is not touched by this maintenance. We take a backup first.

You will see a notice in the app before it starts. We will email again when it is done.
`),

  tpl(C, "maint-reminder", "Maintenance starts in 24 hours", "A reminder the day before planned maintenance", "clock",
    "Reminder: maintenance tomorrow at {{start_time}}", "A short reminder with the times.",
    ["Check status", "{{status_url}}"], `
Hi {{name}},

A quick reminder that we have maintenance planned tomorrow.

[details]
Start: {{date}} at {{start_time}} ({{timezone}})
Expected end: {{end_time}}
Affected: {{affected}}

## Before it starts
- Save any work in progress.
- Tell your team if anyone relies on {{affected}} during that time.

That is all. We will email you again as soon as everything is back.
`),

  tpl(C, "maint-started", "Maintenance has started", "Confirm that planned work is now under way", "clock",
    "Maintenance has started", "Some features are unavailable until {{end_time}}.",
    ["Follow progress", "{{status_url}}"], `
Hi {{name}},

Our planned maintenance started at {{start_time}} on {{date}}. {{affected}} is unavailable for now.

>! Expected back by {{end_time}} ({{timezone}}).

## What is happening
{{what_changed}}

## What you can do while you wait
- Check {{status_url}} for live updates. It does not depend on OnboardOps, so it stays up.
- Hold off on entering new data if you can. If you cannot, write it down and add it when we are back.

We will tell you the moment it is finished.
`),

  tpl(C, "maint-complete", "Maintenance complete", "Planned work finished and the service is back", "seal",
    "Maintenance complete: OnboardOps is back", "Everything is working again.",
    ["Open OnboardOps", "{{login_url}}"], `
Hi {{name}},

The planned maintenance is finished and OnboardOps is working normally again. Thank you for your patience.

>+ Completed at {{end_time}} on {{date}}.

## What changed
{{what_changed}}

## What you might notice
- {{change_one}}
- You may need to sign in again.

## If something looks wrong
Reload the page first. If a problem remains, tell us at {{support_url}} and include what you were doing. We will look at it straight away.

Thank you for bearing with us.
`),

  tpl(C, "maint-extended", "Maintenance is taking longer", "Update that planned work will run past the window", "alert",
    "Update: maintenance is running longer than planned", "New expected finish time inside.",
    ["Check live status", "{{status_url}}"], `
Hi {{name}},

Our maintenance is taking longer than we planned, and we want you to know as soon as we do.

[details]
Original end: {{old_end_time}}
New expected end: {{end_time}} ({{timezone}})
Status: {{status}}

## Why
{{reason}}

## What this means for you
{{affected}} stays unavailable until the new time. Your data is safe, and nothing has been lost.

We are sorry for the extra wait. Updates are on {{status_url}}, and we will email you once we are back.
`),

  tpl(C, "inc-investigating", "Incident: we are investigating", "First message when something is wrong", "alert",
    "We are investigating a problem with OnboardOps", "Some people may have trouble. We are on it.",
    ["Follow the incident", "{{status_url}}"], `
Hi {{name}},

We are investigating a problem with OnboardOps that started around {{start_time}} on {{date}}.

>! Status: investigating. Reference {{incident_id}}.

## What you may notice
{{symptoms}}

## What we know so far
{{what_happened}}

## What you can do now
- Try again in a few minutes. Many problems clear by themselves.
- Do not repeat actions over and over, such as clicking submit many times.
- Follow {{status_url}} for live updates. We will post there first.

We will send another update within {{next_update}}.
`),

  tpl(C, "inc-identified", "Incident: cause identified", "Tell customers we found the cause", "eye",
    "Update: we have found the cause of the issue", "A fix is being put in place.",
    ["Follow the incident", "{{status_url}}"], `
Hi {{name}},

Here is an update on the problem we told you about earlier (reference {{incident_id}}).

>! Status: identified. A fix is being applied.

## What we found
{{what_happened}}

## What happens next
- We are applying the fix now. We expect it to be in place by {{end_time}}.
- We will watch the service closely after it goes in.
- You do not need to do anything.

## While you wait
Follow {{status_url}} for live updates. We are sorry for the trouble.
`),

  tpl(C, "inc-monitoring", "Incident: fix applied, monitoring", "A fix is in and we are watching", "eye",
    "Update: a fix is in place and we are monitoring", "Things should be working again.",
    ["Check status", "{{status_url}}"], `
Hi {{name}},

We applied a fix for the problem we reported (reference {{incident_id}}). Things should now be working normally.

>+ Status: monitoring. Fix applied at {{time}} on {{date}}.

## What to do
- Reload the page if something still looks wrong.
- If you saw errors earlier, repeat the action once it loads.

## What we are doing now
We are watching the service for the next {{duration}} to be sure the fix holds. If it does, we will close the incident and send you a final summary.

If you still have trouble, please tell us at {{support_url}} with what you saw.
`),

  tpl(C, "inc-resolved", "Incident resolved", "Close the incident with a short summary", "seal",
    "Resolved: OnboardOps is working normally", "The incident is over. Here is a short summary.",
    ["Read the summary", "{{status_url}}"], `
Hi {{name}},

The incident we reported (reference {{incident_id}}) is resolved, and OnboardOps is working normally.

[details]
Started: {{start_time}} on {{date}}
Resolved: {{end_time}}
Total duration: {{duration}}
Affected: {{affected}}

## What happened
{{what_happened}}

## Was any data lost
{{data_involved}}

## What we are doing to prevent it
We will share a fuller review within a few days. In the meantime, we have {{change_one}}.

Thank you for your patience, and we are sorry for the disruption.
`),

  tpl(C, "major-outage", "Major outage", "A serious outage with wide impact", "alert",
    "OnboardOps is currently unavailable", "We are working on it and will update you often.",
    ["Follow live updates", "{{status_url}}"], `
Hi {{name}},

OnboardOps is currently unavailable, and we know your teams depend on it. All of us are working on it now.

>!! Outage began at {{start_time}} on {{date}}. Reference {{incident_id}}.

## What this means
- You cannot sign in or use the app until we restore service.
- Data that was saved before the outage is safe.
- Anything you were in the middle of when it began may not have saved.

## What to do while we fix it
1. Use your fallback process for now, such as paper checklists or a notebook for shift notes.
2. Write down who was working, anything that happened, and any training you wanted to record. You can enter it afterwards.
3. Follow {{status_url}}. It is hosted separately and shows live progress.

## What we are doing
{{what_happened}}

We will email you as soon as we are back and again with a full explanation. We are very sorry.
`),

  tpl(C, "degraded", "Degraded performance", "Slowness without a full outage", "clock",
    "OnboardOps may be running slowly", "We are working on speeding things up.",
    ["Check status", "{{status_url}}"], `
Hi {{name}},

Some people are experiencing slow pages or occasional timeouts in OnboardOps. The service is up, but not as fast as it should be.

[details]
Started: {{start_time}} on {{date}}
Affected: {{affected}}
Status: {{status}}

## What you can do
- Try again, or wait a minute and reload.
- Avoid very large exports or imports until things are back to normal.
- If something fails to save, you will see an error. Please repeat it once the page is responsive.

## What we are doing
{{what_happened}}

We will tell you when performance is back to normal.
`),

  tpl(C, "email-delay", "Email delivery delays", "Notifications may arrive late", "chat",
    "Some OnboardOps emails may be delayed", "Reminders and notices are arriving late.",
    ["Check status", "{{status_url}}"], `
Hi {{name}},

We are seeing delays in how quickly emails from OnboardOps reach people. This includes sign-in links, course reminders and policy requests.

## What is affected
{{affected}}

## What you can do
- If you are waiting for a sign-in link, request one more and wait a few minutes before trying again. Using the newest one is best.
- Everything that an email would tell you is also shown inside the app, so you can check there.
- Check your spam folder, since delayed emails can be filtered more aggressively.

## What we are doing
{{what_happened}}

>+ No email is being lost. Delayed messages will arrive once the delay clears.
`),

  tpl(C, "db-migration", "Database upgrade notice", "Planned upgrade that may briefly affect saving", "calendar",
    "Planned database upgrade on {{date}}", "A short period where saving may be unavailable.",
    ["See the schedule", "{{status_url}}"], `
Hi {{name}},

We are upgrading the database that holds your records. This makes OnboardOps faster and more reliable.

[details]
Date: {{date}}
Window: {{start_time}} to {{end_time}} ({{timezone}})
Expected impact: {{affected}}

## Before we begin
- We take a full backup and check that it can be restored.
- We run the upgrade on a copy first, to make sure it works.

## During the window
You can read your records, but saving changes may be unavailable for a few minutes at a time.

## After
We check that every record is intact and tell you when it is complete.

>+ No data is deleted by this upgrade. If anything goes wrong, we restore from the backup we just took.
`),

  tpl(C, "read-only", "Read-only mode", "Tell people they can view but not change data for a while", "lock",
    "OnboardOps is temporarily read-only", "You can view records, but changes are paused.",
    ["Check status", "{{status_url}}"], `
Hi {{name}},

For the next little while, OnboardOps is in read-only mode. You can look at records, courses and schedules, but you cannot add or change anything.

[details]
Started: {{start_time}} on {{date}}
Expected until: {{end_time}}
Reason: {{reason}}

## Why we do this
Read-only mode protects your data while we work on something delicate. It is much safer than letting changes through while we are in the middle of a repair.

## What you can do
- Look up anything you need.
- Keep a note of changes you wanted to make, and enter them when we are back.
- Use paper for shift checklists in the meantime.

We will email you the moment full access is restored.
`),

  tpl(C, "provider-outage", "Outage at our hosting provider", "A problem at an upstream provider", "alert",
    "An outage at our hosting provider is affecting OnboardOps", "Not our code, but we are working around it.",
    ["Follow live updates", "{{status_url}}"], `
Hi {{name}},

A provider that hosts part of OnboardOps, {{provider}}, is having an outage. It is affecting our service as well.

[details]
Provider: {{provider}}
Started: {{start_time}} on {{date}}
Affected: {{affected}}

## What this means
{{symptoms}}

## What we are doing
- Following the provider's status updates closely.
- Working on a way to restore service sooner if their recovery takes long.
- Preparing a review of how we depend on them.

## What you can do
Follow {{status_url}} for our updates. Your data is safe and will be there when service returns. We are sorry that this is outside our direct control, and we take responsibility for the effect on you.
`),

  tpl(C, "postmortem", "Post-incident review", "A fuller explanation after an outage is over", "book",
    "Post-incident review for {{incident_id}}", "What happened, why, and what we changed.",
    ["Read the review", "{{action_url}}"], `
Hi {{name}},

You deserve to know not only that something was fixed, but why it broke. Here is our review of the incident on {{date}}.

[details]
Reference: {{incident_id}}
Duration: {{duration}}
Affected: {{affected}}

## Summary
{{what_happened}}

## Timeline
1. {{start_time}}: the problem began.
2. {{time}}: we detected it.
3. {{end_time}}: service was restored.

## Root cause
{{root_cause}}

## What went well
- {{good_one}}

## What did not go well
- {{bad_one}}

## What we are changing
- {{change_one}}
- {{change_two}}
- {{change_three}}

We are sorry for the disruption. If this review leaves questions, reply and we will answer them honestly.
`),
];
