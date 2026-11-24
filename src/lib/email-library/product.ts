import { tpl } from "./types";

const C = "Product Updates" as const;

export const PRODUCT = [
  tpl(C, "new-feature", "New feature announcement", "Introduce a new feature and how to use it", "magic",
    "New in OnboardOps: {{feature}}", "Here is what it does and how to try it today.",
    ["Try {{feature}}", "{{action_url}}"], `
Hi {{name}},

We just released {{feature}}, and we think it will save your team time.

## Why we built it
{{reason}}

## What it does
- {{change_one}}
- {{change_two}}
- {{change_three}}

## How to get started
1. Sign in and open {{where_to_find}}.
2. Follow the short prompts on screen.
3. Tell your team, since it works best when everyone knows about it.

>+ It is available now to every workspace at no extra cost during the beta.

## Tell us what you think
This feature started as a request from someone like you. If it is missing something, reply to this email. We read every reply.
`),

  tpl(C, "release-notes", "Monthly release notes", "A tidy summary of what shipped this month", "book",
    "What's new in OnboardOps: {{month}}", "New features, improvements and fixes from the last month.",
    ["See the full changelog", "{{changelog_url}}"], `
Hi {{name}},

Here is what we shipped in {{month}}.

## New
- {{change_one}}
- {{change_two}}

## Improved
- {{improved_one}}
- {{improved_two}}

## Fixed
- {{fixed_one}}
- {{fixed_two}}

## Coming next
We are working on {{next_one}} and {{next_two}}. You can follow progress on the public roadmap.

## Want the details?
Every release, with the date it shipped, is listed on the changelog. If something here affects how your team works, we have put a note under it explaining what to do.

Thank you for using OnboardOps and for the feedback that shapes it.
`),

  tpl(C, "ai-course-builder", "Spotlight: AI course builder", "Show managers how to draft a course from a procedure", "magic",
    "Turn a procedure into a course in minutes", "Paste it in, review the draft, save it.",
    ["Open the course builder", "{{action_url}}"], `
Hi {{name}},

Writing training from scratch is slow. The course builder can draft one for you from a procedure you already have.

## How it works
1. Open the course builder and choose to draft a course.
2. Paste in your procedure, policy or checklist.
3. Review the draft lessons and quiz questions it writes.
4. Edit anything you want, then save.

## What it can also do
- Write more quiz questions, or better wrong answers.
- Simplify the wording for new workers.
- Translate the course into another language.
- Check your lessons for parts that are unclear or contradict each other.

>! AI can be wrong. Nothing is saved until you save it, so read each lesson and answer before you assign the course.

## Your controls
Owners and Admins can turn AI features off in Settings. The text you paste is sent only to produce the draft, and we do not keep it.

Try it with one procedure your team already follows, and see how much editing it needs.
`),

  tpl(C, "certificates", "Printable certificates with verification", "Announce certificate PDFs, QR codes and the verify page", "seal",
    "Certificates you can print, download and verify", "Every certificate now has a PDF, a QR code and a verification code.",
    ["See a certificate", "{{action_url}}"], `
Hi {{name}},

When someone passes a course, the certificate they earn should look professional and be easy to check. We have improved it.

## What is new
- A designed certificate you can print or download as a PDF.
- A unique certificate number on every certificate.
- A QR code that opens our verify page, so anyone can confirm it is real.
- Your company name, the course, the score and the dates, with a place for a signature.

## For managers
You can find any employee's certificates on their record, and employees find their own in their portal. Downloading gives you a file you can email, or attach to an audit or insurance request.

## For anyone checking a certificate
They enter the number or scan the code at onboardops.org/verify. It confirms that the certificate was issued through OnboardOps. It does not say whether the person is currently qualified, so that still needs to be checked with the employer.

[details]
Where to find it: Employee record, then Training
Format: Printable page and PDF
Verification: Certificate number and QR code

Owners can choose in Settings whether the verify page shows the employee's name.
`),

  tpl(C, "ai-helpers", "AI helpers for managers and employees", "Introduce the AI assistants across the product", "magic",
    "New AI helpers in OnboardOps", "Ask your data, plan a huddle, and help employees find answers.",
    ["See what's new", "{{changelog_url}}"], `
Hi {{name}},

We have added AI helpers that save time on the questions that come up every day.

## For managers
- Ask your data in plain words, such as "who has training past due?". The numbers come straight from your records.
- Plan a short team huddle from your live numbers.
- Turn rough shift notes into a clear handoff.
- Get a plain-language explanation of where people struggle on a quiz.

## For employees
- Ask a question about company policies and get an answer from the policy text.
- See a summary of your week: shifts, training and anything to sign.
- Get help writing a polite message to a manager.
- Ask about a lesson in simpler words, and have it read aloud.

## How we keep it safe
- The AI does not make decisions about people and cannot change a record.
- Reports run with the viewer's own access, so nobody sees more than before.
- Names are hidden from the AI for anything that reads staff text.

>! AI can be wrong. Treat what it says as a draft or a starting point.

Owners and Admins can switch AI features off in Settings at any time.
`),

  tpl(C, "support-chat", "Help center and live support chat", "Announce the new support experience", "chat",
    "Faster help: our new support chat", "Ask a question and get an answer, or reach a person.",
    ["Try the chat", "{{support_url}}"], `
Hi {{name}},

Getting help should be quick. We have upgraded support to make it easier to get an answer.

## What is new
- A chat bubble on every page of our website. Ask a question and get an answer from our documentation.
- If it cannot help, you can talk to a person. Your conversation continues in the chat, and we send a copy by email.
- You can attach a screenshot, and see when our team has read your message.
- If you come back later, you can find past conversations with a code we email you.

## Our support hours
Monday to Friday, 9am to 5pm Eastern. Outside those hours your message is saved and we reply when we are back.

## Tips for a fast answer
1. Tell us what you were trying to do, and what happened instead.
2. Add a screenshot if you can, but please cover anything private.
3. Never send passwords or confidential employee records.

The help center has step-by-step guides for setup, roles, training, discipline and integrations.
`),

  tpl(C, "checklists", "Shift checklists update", "Tell managers about checklist improvements", "verify",
    "Shift checklists: what's improved", "Better checklists and easier supervisor sign-off.",
    ["Open checklists", "{{action_url}}"], `
Hi {{name}},

Shift checklists are one of the most used parts of OnboardOps, so we have been making them better.

## What is new
- {{change_one}}
- {{change_two}}
- {{change_three}}

## Why checklists matter
A checklist that is filled in and verified is evidence that the work was done. It protects your team when something goes wrong, and it helps new people know what "done" means.

## A good way to roll them out
1. Start with one checklist for one shift, such as opening or closing.
2. Mark the items that truly must be done as required.
3. Have a supervisor verify the first week, then review what gets skipped.
4. Add an alert to Discord, Slack or Teams for anything left incomplete.

If you want a template for a common checklist, tell us what your business does and we will point you to one.
`),

  tpl(C, "scheduling", "Scheduling and time tracking update", "Improvements to shifts, swaps and timesheets", "calendar",
    "Scheduling and timesheets: new improvements", "Shifts, swaps and time-off are easier to manage.",
    ["Open the schedule", "{{action_url}}"], `
Hi {{name}},

We have made improvements to how shifts, swaps and time tracking work.

## What is new
- {{change_one}}
- {{change_two}}
- {{change_three}}

## What this means for your team
- Employees see their shifts and approved time off in their portal and can add them to their phone calendar.
- Shift swaps go through approval, so managers stay in control.
- Timesheets show what was worked, ready for review before you export.

## Tips
1. Publish the schedule early. Staff plan their week around it.
2. Turn on reminders so nobody misses a shift.
3. Review timesheets weekly, so mistakes are caught while people still remember.

>+ Everything works on a phone browser, so people can use it on the floor, not just at a desk.
`),

  tpl(C, "integrations", "Slack, Teams and Discord alerts", "Remind customers they can get alerts in chat apps", "chat",
    "Get OnboardOps alerts where your team already talks", "Set up in a few minutes.",
    ["Set up alerts", "{{action_url}}"], `
Hi {{name}},

You do not have to remember to check OnboardOps. It can post to the chat app your team already uses.

## What it can tell you
- Someone passed or failed a course.
- A new infraction needs a signature.
- A credential is about to expire.
- A checklist was missed.
- An incident report came in.

## How to set it up
1. Create a webhook in Slack, Microsoft Teams or Discord. Each has a short guide.
2. In OnboardOps, open Settings and then Integrations.
3. Paste the webhook address and choose what to send.
4. Press the test button to see it arrive.

>! Treat a webhook address like a password, since anyone who has it can post to that channel.

## A tip
Use a private channel for anything about people's records, and a general channel for training wins and checklists.
`),

  tpl(C, "enterprise-sso", "Single sign-on and user provisioning", "Announce SAML SSO, SCIM and stronger sign-in", "lock",
    "Single sign-on, SCIM and stronger sign-in controls", "For teams that manage sign-in through an identity provider.",
    ["See the setup guide", "{{action_url}}"], `
Hi {{name}},

If your company manages sign-in through an identity provider, OnboardOps now fits in better.

## What is available
- **SAML single sign-on.** People sign in with their company login.
- **SCIM provisioning.** Add and remove people in one place, and the change follows into OnboardOps.
- **Stronger two-step sign-in options**, including a push-based method.
- **Audit log streaming**, so your security team can see activity in their own tools.
- **Retention controls and legal hold**, so records you must keep are not deleted.

## Who it is for
Teams with an IT or security owner, and anyone who needs to show how access is controlled. If you are a small team, you do not need any of it, and nothing changes for you.

## Getting started
1. Ask your IT owner to open the setup guide.
2. Set up a test connection first, with a small group.
3. Keep a fallback sign-in for an Owner while you test.

If you want help, reply and we will go through it with you.
`),

  tpl(C, "pwa-mobile", "Using OnboardOps on a phone", "Tips for staff who work on the floor", "welcome",
    "Using OnboardOps on your phone", "Staff can do most things from a phone browser.",
    ["Open My Portal", "{{login_url}}"], `
Hi {{name}},

Most of your team will use OnboardOps on a phone, not a computer. A few tips help it work smoothly.

## What staff can do from a phone
- See their shifts and request time off.
- Clock in and out.
- Finish training and take quizzes.
- Complete a shift checklist.
- Read and sign policies.

## Make it quick to open
1. Open My Portal in the phone's browser.
2. Add it to the home screen from the browser menu.
3. After that it opens like an app.

## A few reminders
- Keep the phone's browser up to date.
- If your connection drops, the app will tell you, and some actions are held until you are back online.
- Use a private phone lock. Records are protected by a login, and a lock keeps them safe if a phone is lost.

If someone loses a phone, ask them to change their password right away, and tell us if you need help.
`),

  tpl(C, "quiz-analytics", "Quiz analytics", "Show managers where people struggle", "eye",
    "See which quiz questions people miss", "Spot the lessons that need to be clearer.",
    ["Open quiz analytics", "{{action_url}}"], `
Hi {{name}},

If everyone misses the same question, the question or the lesson is usually the problem, not the people. Quiz analytics shows you that.

## What it shows
- Which questions are missed most, hardest first.
- Which wrong answer people choose most often.
- The pass rate and average score for each course.

## How to use it
1. Open the course you care about.
2. Look at the questions below 70% correct.
3. Read the most common wrong answer. It tells you what people misunderstood.
4. Clarify the lesson, then check the numbers again next month.

>+ Numbers are about questions, never about ranking people.

There is also an AI summary that reads the statistics and suggests what to coach in your next huddle.
`),

  tpl(C, "roadmap-update", "Roadmap update", "Share what is coming and what was decided", "calendar",
    "Our roadmap: what's coming and what we decided", "What we are working on, and why.",
    ["See the roadmap", "{{app_url}}/roadmap"], `
Hi {{name}},

You asked where OnboardOps is heading, so here is an honest update.

## Shipped since the last update
- {{change_one}}
- {{change_two}}

## In progress
- {{next_one}}
- {{next_two}}

## Under consideration
- {{idea_one}}
- {{idea_two}}

## Things we decided not to build
{{not_building}}

>+ Roadmap items are plans, not promises. Dates move, and we will tell you when they do.

## Shape it with us
The public roadmap shows what is planned. If something matters to you, tell us why. Understanding the problem behind a request helps us build the right thing.
`),

  tpl(C, "deprecation", "Feature change or retirement", "Give notice before removing or changing a feature", "alert",
    "Notice: changes to {{feature}} on {{date}}", "What is changing and what you should do.",
    ["Read the details", "{{action_url}}"], `
Hi {{name}},

We are changing how {{feature}} works. We want to give you plenty of notice.

[details]
What is changing: {{what_changed}}
Takes effect: {{date}}
Affects: {{affected}}

## Why
{{reason}}

## What you need to do
{{customer_action}}

## What stays the same
Your data is not deleted by this change, and everything you built remains available.

## What if this causes a problem for you
Tell us. If this change breaks something important, we want to know before {{date}}, so we can help or adjust.
`),

  tpl(C, "you-asked", "You asked, we built it", "Thank beta users and show how their feedback shipped", "welcome",
    "You asked, we built it", "Here is what your feedback changed.",
    ["See what changed", "{{changelog_url}}"], `
Hi {{name}},

Every week we read the feedback that comes in. This email is a thank you, and a record of what it changed.

## What you asked for, and what we shipped
- You asked for {{request_one}}. We built {{change_one}}.
- You asked for {{request_two}}. We built {{change_two}}.
- You asked for {{request_three}}. We built {{change_three}}.

## What is still on our list
{{next_one}}, and {{next_two}}.

## Keep it coming
The feedback button inside the app reaches us directly. The best feedback says what you were trying to do and what got in the way. It does not need to be polished.

Thank you for being part of the beta. It really does shape the product.
`),

  tpl(C, "api-webhook-change", "Integration or webhook change", "Notice about changes to webhooks or exports", "key",
    "Change to webhooks and integrations on {{date}}", "Check that your integrations will keep working.",
    ["See what changes", "{{action_url}}"], `
Hi {{name}},

We are changing how part of our integrations work. If you use webhooks or exports from OnboardOps, please read this.

[details]
What is changing: {{what_changed}}
Takes effect: {{date}}
Who it affects: {{affected}}

## What you need to do
1. Open Settings and look at your integrations.
2. {{customer_action}}
3. Use the test button to confirm messages still arrive.

## If you do nothing
{{impact}}

## Need a hand?
Reply with a description of how you use the integration and we will tell you if you are affected.
`),
];
