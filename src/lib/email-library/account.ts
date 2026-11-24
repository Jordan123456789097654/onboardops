import { tpl } from "./types";

const C = "Account & Access" as const;

export const ACCOUNT = [
  tpl(C, "password-changed", "Password changed", "Confirm a password change", "key",
    "Your OnboardOps password was changed", "If this was not you, act now.",
    ["Secure my account", "{{action_url}}"], `
Hi {{name}},

The password for your OnboardOps account was changed on {{date}} at {{time}}.

## If this was you
Nothing more to do. You can ignore this email.

## If this was not you
>!! Someone else may have access to your account. Act now.

1. Select the button above to reset your password.
2. Turn on two-step sign-in.
3. Review recent activity on your account page.
4. Tell us, so we can look at the account as well.

## Tips for a strong password
- Use a passphrase of several unrelated words.
- Use a different password for every website.
- Keep it in a password manager, not in a note on your phone.

We will never ask for your password by email, phone or chat.
`),

  tpl(C, "new-device", "Sign-in from a new device", "Notify a user of a login from a device they have not used", "eye",
    "New sign-in to your OnboardOps account", "Was this you?",
    ["Review my sessions", "{{action_url}}"], `
Hi {{name}},

Your account was just used to sign in from a device we have not seen before.

[details]
When: {{date}} at {{time}}
Device: {{device}}
Approximate place: {{location}}

## If this was you
No action is needed.

## If this was not you
1. Change your password straight away.
2. Check that two-step sign-in is on.
3. Sign out of any session you do not recognize.

>! We cannot see your password, so we cannot tell if someone else knows it. Changing it is the safest step.
`),

  tpl(C, "two-step-required", "Two-step sign-in now required", "Tell people their workspace requires two-step sign-in", "lock",
    "Your workspace now requires two-step sign-in", "Set it up in about two minutes.",
    ["Set up two-step sign-in", "{{action_url}}"], `
Hi {{name}},

An Owner of {{workspace}} has turned on a requirement for two-step sign-in. From {{date}}, you will need it to use OnboardOps.

## What it is
Two-step sign-in asks for a second thing besides your password, usually a code from an app on your phone. Even if someone learns your password, they cannot get in without it.

## How to set it up
1. Select the button above and open your account security page.
2. Choose "Turn on two-step sign-in".
3. Scan the code with an authenticator app, such as one you already use.
4. Enter the six-digit code to confirm.
5. Save your backup codes somewhere safe.

>! Backup codes are the way back in if you lose your phone. Each can be used once.

## If you need help
Ask the workspace Owner first. If you get locked out, contact us and we will help you recover your account.
`),

  tpl(C, "backup-codes", "Save your backup codes", "Remind users to keep their recovery codes safe", "key",
    "Have you saved your backup codes?", "They are the way back in if you lose your phone.",
    ["Review my security settings", "{{action_url}}"], `
Hi {{name}},

You turned on two-step sign-in for your account, which is great. This is a reminder to keep your backup codes safe.

## What they are
A short list of one-time codes. If you lose your phone or cannot use your authenticator app, one of them gets you back in.

## How to keep them safe
- Store them in a password manager, or print them and put them somewhere secure.
- Do not keep them in an email or a note called "passwords".
- Each code works once. Make a new set when you run low.

## If you have lost them
Sign in, open your security settings and create a new set. The old ones stop working.

>! We cannot give you your codes, and we cannot sign you in without them. This protects you if someone tries to impersonate you.
`),

  tpl(C, "account-locked", "Account locked", "Explain a temporary lock after repeated failed attempts", "lock",
    "Your account was temporarily locked", "Too many unsuccessful sign-in attempts.",
    ["Reset my password", "{{action_url}}"], `
Hi {{name}},

For your protection, we temporarily locked your OnboardOps account after several sign-in attempts did not succeed.

[details]
Locked at: {{time}} on {{date}}
Unlocks: {{unlock_time}}

## What to do
- Wait until it unlocks and try again with the right password.
- Or reset your password now. That also unlocks the account.

## If you did not try to sign in
Someone may have been guessing your password. Reset it and turn on two-step sign-in. The lock stopped them from getting in.

## Still stuck
Contact us from the help center and tell us the email on the account. We will check that it is really you before we help.
`),

  tpl(C, "email-change", "Confirm your new email", "Verify a new email address on an account", "verify",
    "Confirm the email address on your OnboardOps account", "One more step to finish the change.",
    ["Confirm this address", "{{action_url}}"], `
Hi {{name}},

A request was made to add or change the email address on your OnboardOps account to {{new_email}}.

## To confirm it
Select the button above. The link works for a limited time.

## What happens once you confirm
You can use this address to sign in and to receive notices. We will send a short note to your old address too, so you always know when this changes.

>! If you did not ask for this, do not select the link. Change your password, and tell us.

## Why we ask
Confirming an address proves it belongs to you. It stops someone from adding an address that is not theirs.
`),

  tpl(C, "ownership-transfer", "Workspace ownership transfer", "Confirm that workspace ownership is changing", "key",
    "Ownership of {{workspace}} is being transferred", "Please confirm this change.",
    ["Review the transfer", "{{action_url}}"], `
Hi {{name}},

A request was made to transfer ownership of {{workspace}} to {{new_owner}}.

[details]
Current Owner: {{old_owner}}
New Owner: {{new_owner}}
Requested: {{date}}

## What the Owner can do
Owners control the whole workspace, including billing, security, data export and deleting the workspace. That is why we ask for confirmation.

## What happens
- Once confirmed, the new Owner has full control.
- The previous Owner keeps access at the level they choose, or none.
- The change is recorded in the audit log.

>!! If you did not expect this, do not confirm it. Contact us immediately.

## Before you transfer
Make sure the new Owner has two-step sign-in turned on and understands what the role involves.
`),

  tpl(C, "sso-enabled", "Single sign-on turned on", "Tell members their workspace now uses SSO", "lock",
    "{{workspace}} now uses single sign-on", "How signing in is changing.",
    ["Sign in with SSO", "{{login_url}}"], `
Hi {{name}},

An administrator has turned on single sign-on for {{workspace}}. From {{date}}, you can sign in with your company login instead of a separate OnboardOps password.

## What changes
- You will see a "Sign in with your company" option.
- Your company login handles your password and any two-step checks.
- Your records and settings are unchanged.

## What to do
1. Select the button above and use the company sign-in option.
2. If you are asked, link it to your existing account.

## If you cannot sign in
- Check that you are signed in to your company account first.
- Ask your IT contact whether your account has been given access to OnboardOps.
- A workspace Owner can still use a fallback sign-in, in case something goes wrong.

If you have questions, ask your administrator first.
`),

  tpl(C, "scim", "Accounts managed by your company", "Explain automatic provisioning", "team",
    "Your OnboardOps account is now managed by your company", "Accounts are added and removed automatically.",
    undefined, `
Hi {{name}},

{{workspace}} now manages OnboardOps accounts through your company's identity system. This is a change in how accounts are created and removed, not in how you work.

## What this means
- New people get an account automatically when they are added in your company system.
- Accounts are turned off automatically when someone leaves.
- Name, email and department can be kept up to date from the same place.

## What does not change
Your records, training and history stay in OnboardOps. The change affects how accounts are set up, not what is stored.

## What to do
Nothing. If your details look wrong, ask the person who manages your company accounts, since that is now where they are controlled.

>+ This helps keep access tidy: people who leave lose access quickly, without anyone having to remember.
`),

  tpl(C, "workspace-suspended", "Workspace suspended", "Notify an owner that their workspace was locked", "alert",
    "Your workspace {{workspace}} has been suspended", "Here is why, and how to resolve it.",
    ["Contact support", "{{support_url}}"], `
Hi {{name}},

We have suspended {{workspace}}. We know that is disruptive, so we want to explain clearly.

[details]
Suspended on: {{date}}
Reason: {{reason}}
Reference: {{incident_id}}

## What this means
- Members cannot use the workspace until the suspension is lifted.
- Your data is safe and has not been deleted.
- You can still contact us, and an Owner can request an export.

## What you can do
1. Read the reason above.
2. Reply with anything we should know, or the steps you have taken.
3. We will review it and tell you what we need.

>! We do not suspend workspaces lightly. We would much rather resolve this with you quickly.

We will respond within one business day.
`),

  tpl(C, "workspace-reactivated", "Workspace reactivated", "Confirm that a suspension has ended", "unlock",
    "{{workspace}} is active again", "Your team can sign in.",
    ["Open the workspace", "{{login_url}}"], `
Hi {{name}},

Good news. We have lifted the suspension on {{workspace}}, and your team can use it again.

>+ Reactivated on {{date}}. Everything is as you left it.

## What was resolved
{{what_changed}}

## What to do
- Sign in and check that things look right.
- Tell your team they can use it again.
- If anything looks wrong, let us know straight away.

## Thank you
Thank you for working with us to sort this out. We know the interruption was frustrating.
`),

  tpl(C, "account-deleted", "Account deletion confirmation", "Confirm account or data deletion", "seal",
    "Your OnboardOps account has been deleted", "A record of what was removed.",
    undefined, `
Hi {{name}},

As you asked, we have deleted your OnboardOps account and the data connected to it.

[details]
Deleted on: {{date}}
What was removed: {{data_involved}}
What we keep and why: {{kept}}

## What this means
- You can no longer sign in.
- The data we deleted cannot be recovered.
- Some records, such as billing and legal records, may be kept for as long as the law requires.

## Backups
Deleted data may remain in secure backups for a short time before they are overwritten. Those backups are not used for anything else.

## If you would like to come back
You are welcome to create a new account at any time.

Thank you for having used OnboardOps. If you would tell us why you left, we would be grateful.
`),
];
