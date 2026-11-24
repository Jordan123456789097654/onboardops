import { tpl } from "./types";

const C = "Onboarding & Welcome" as const;

export const WELCOME = [
  tpl(C, "welcome", "Welcome to OnboardOps", "A warm first email for a new workspace owner", "welcome",
    "Welcome to OnboardOps, {{name}}", "Your workspace is ready. Here is how to get going.",
    ["Open my workspace", "{{login_url}}"], `
Hi {{name}},

Welcome, and thank you for choosing OnboardOps. Your workspace is ready, and getting your team set up takes less time than most people expect.

## What OnboardOps helps with
- **Training** that is tracked: lessons, quizzes graded on the server, and certificates.
- **Records** that hold up: infractions with confidential notes, signatures and appeals.
- **Daily operations**: shift checklists, schedules and handoff notes.

## Your first three steps
1. Run the setup wizard to add departments and job roles.
2. Invite a few of your staff.
3. Build or import your first course.

>+ OnboardOps is free during the beta. There is no credit card, no trial clock and no staff limit.

## Where to get help
Our help center has step-by-step guides, and there is a 2-minute video that shows the whole setup. If you get stuck, use the chat on our website and a person will reply.

We are glad you are here. Reply to this email any time and tell us what you are hoping to fix.
`),

  tpl(C, "getting-started", "Your getting started checklist", "A short list of what to do in the first day", "verify",
    "Your OnboardOps getting started checklist", "Seven steps to a working setup.",
    ["Continue setup", "{{login_url}}"], `
Hi {{name}},

Here is a simple checklist for your first day. You do not need to finish it all at once. Each step makes the next one easier.

## The checklist
1. Run the setup wizard, so your departments and job roles exist.
2. Add your own profile and turn on two-step sign-in.
3. Invite your managers and supervisors.
4. Import or add your staff.
5. Build or import one course and assign it.
6. Create one shift checklist, such as opening or closing.
7. Connect Discord, Slack or Teams, so alerts reach your team.

## How long does it take
Most teams get through steps 1 to 5 in under an hour.

## A tip for a smooth start
Start small. One department and one course is enough to learn how it works. Add the rest once you are comfortable.

>! Do not put passwords or sensitive notes in course lessons or checklists. Those are visible to the people who take them.

If a step is unclear, the help center explains each one.
`),

  tpl(C, "invite-staff", "Invite your team", "Encourage the owner to bring staff in", "invite",
    "Bring your team into OnboardOps", "It takes a minute per person.",
    ["Invite staff", "{{action_url}}"], `
Hi {{name}},

OnboardOps works best when your whole team is in it. Inviting people takes a minute.

## How to invite
1. Open the people page.
2. Add a name and an email address.
3. Choose their role and department.
4. Send the invite. They get a link to join.

## Choosing roles
- **Owners and Admins** manage the workspace.
- **Managers** run training and records for their team.
- **Supervisors** verify checklists and help their shift.
- **Employees** see their own training, schedule and records.

## If you have many people
You can bring in your team from a spreadsheet, with one row per person. If a column does not match, the importer asks you to choose where it goes.

## If someone does not get the invite
Ask them to check spam, and use the resend option. It is also fine to share a sign-in link directly.

Start with the people who will use it first, and add the rest in waves.
`),

  tpl(C, "first-course", "Build your first course", "Guide the owner through creating training", "book",
    "Build your first course", "A step-by-step guide to a course people will finish.",
    ["Open the course builder", "{{action_url}}"], `
Hi {{name}},

A good first course is short, specific and ends with a quiz. Here is how to build one that people finish.

## Pick the right topic
Choose something your team already needs to know, such as food safety, opening procedures or how to handle a complaint.

## Build it in four steps
1. Add three or four short lessons. Each should take about two minutes to read.
2. Write five to eight quiz questions. Each has one right answer.
3. Set the pass mark, and how long someone waits before a retake.
4. Publish it, then assign it to a role or a person.

## Make it easy to read
- Use short sentences and plain words.
- Put the most important point first.
- Add a video link if you already have one.

>+ Stuck on a blank page? Paste your existing procedure into the builder, and let it draft the lessons and quiz for you to edit.

## After it is live
Watch the first few people take it. If many miss the same question, look at the lesson. Quiz analytics shows you which one.
`),

  tpl(C, "discipline-setup", "Set up records and discipline", "Explain how to set up infractions the right way", "pen",
    "Set up staff records the right way", "Clear policies make fair records.",
    ["Set up infractions", "{{action_url}}"], `
Hi {{name}},

The infractions ledger helps you keep fair, consistent, well-documented records. A little setup makes it much more useful.

## Before you record anything
1. Write or import your policies, so each case can point to the rule that was broken.
2. Decide your point values and what each level leads to.
3. Make sure managers know to write facts, not opinions.

## How a case works
- The manager records what happened, with the date and the policy.
- The employee reads it and signs to say they have seen it.
- They can add their own response, and appeal if they disagree.
- Manager notes stay confidential.

## Writing a good record
- Describe what was seen or said, not what you assume someone thinks.
- Include the date, the time and any witnesses.
- Keep it neutral. A stranger should be able to read it and understand.

>! OnboardOps keeps records. It does not give legal or HR advice. If you are unsure about a serious case, ask a qualified professional.

An AI helper can rewrite notes to be more neutral. Always read what it suggests before you save.
`),

  tpl(C, "first-week", "Your first week check-in", "A friendly check-in with tips", "chat",
    "How is your first week going?", "A few tips, and a way to tell us.",
    ["Tell us how it's going", "{{support_url}}"], `
Hi {{name}},

It has been a few days since you joined OnboardOps. We wanted to check in and see how it is going.

## What most teams do by now
- Run the setup wizard and invite a first group of staff.
- Build or import one course.
- Try a shift checklist for one shift.

## If you have not got that far
That is fine. Pick one thing from the list above and do it today. One course and a few people is a good start.

## Things people ask about at this point
- **How do I add lots of staff?** Import them from a spreadsheet.
- **How do I connect Discord or Teams?** Add a webhook in Settings.
- **Can I change someone's role?** Yes, from the people page.

## We would like to hear from you
What is working? What is confusing? A one-line reply helps us a lot. If you would like a quick walkthrough with a person, say so and we will arrange it.
`),

  tpl(C, "integration-setup", "Connect your chat app", "Help the owner set up alerts in Discord, Teams or Slack", "chat",
    "Set up alerts in Discord, Teams or Slack", "Five minutes to alerts your team will see.",
    ["Connect now", "{{action_url}}"], `
Hi {{name}},

Alerts only work if they land where people look. Most teams already live in Discord, Slack or Microsoft Teams.

## Five-minute setup
1. In your chat app, open the channel settings and create an incoming webhook.
2. Copy the webhook address it gives you.
3. In OnboardOps, go to Settings and then Integrations.
4. Paste the address, and press the test button.
5. You should see a test message arrive within seconds.

## What to send where
- A private channel for records and discipline, with few people in it.
- A team channel for training wins and checklist reminders.
- A manager channel for incidents and credentials that are about to expire.

>! Anyone with the webhook address can post to the channel, so keep it private.

## If the test does not arrive
Check that you copied the whole address and that the channel still exists. If it still does not work, tell us which app you use and we will help.
`),

  tpl(C, "workspace-ready", "Your workspace is set up", "Celebrate a finished setup and point to next steps", "seal",
    "You're set up. Here's what to do next", "Your workspace is ready for your team.",
    ["Go to the dashboard", "{{login_url}}"], `
Hi {{name}},

Your OnboardOps workspace is set up. That is the hard part done.

>+ People, roles and a first course are in place.

## What to do over the next week
1. Assign your first course and watch the early results.
2. Ask two or three managers to try the checklists.
3. Review the dashboard each morning. It shows what needs your attention.

## What to look at on the dashboard
- Training that is overdue.
- Credentials expiring soon.
- Cases waiting for a signature.
- What the team did recently.

## Keep your records trustworthy
Everything important is recorded in an audit log that cannot be edited. It shows who did what and when. Check it now and then, so you know what it looks like before you need it.

Welcome aboard. We are here if you need us.
`),

  tpl(C, "thirty-days", "Your first 30 days", "A guide for owners after the first month", "calendar",
    "Your first 30 days with OnboardOps", "What the best teams do in the first month.",
    ["Open your dashboard", "{{login_url}}"], `
Hi {{name}},

You have been with OnboardOps for about a month. Here is what teams that get the most out of it usually do next.

## Week 1 to 2: build habits
- Have managers check the dashboard at the start of each shift.
- Assign training the day someone is hired.
- Use checklists for opening or closing.

## Week 3: tidy up
- Archive courses you no longer use.
- Review roles, so each person has the right access.
- Check your policies are up to date, and ask people to sign them.

## Week 4: look back
- Open quiz analytics and find the question most people miss.
- Check which credentials expire in the next 90 days.
- Look at the audit log for anything unexpected.

>+ Teams that review once a month catch problems early and need fewer last-minute fixes.

## Tell us what is missing
You are early in the beta, so your feedback has a lot of weight. What would make OnboardOps more useful to you?
`),

  tpl(C, "migrating", "Moving from another tool", "Help a customer switch from spreadsheets or another system", "magic",
    "Moving to OnboardOps from another tool", "A simple way to bring your records over.",
    ["Read the migration guides", "{{app_url}}/migrate"], `
Hi {{name}},

Moving to a new system is easier when you do it in order. This is the approach that works best for most teams.

## Plan it in four steps
1. **Decide what to bring.** Staff, courses and current policies are usually enough. Old history can stay where it is.
2. **Clean it first.** Remove duplicates and fix names and email addresses before you import.
3. **Import in a small batch.** Bring in one department first and check it looks right.
4. **Switch over on a quiet day.** Tell your team the date and what they will do differently.

## What to expect
- Staff can be imported from a spreadsheet.
- You will rebuild courses, but the builder can draft lessons from your existing documents.
- You can keep paper records alongside for a week while people get used to it.

## Keep a copy
Export everything from your old system before you leave it. Keep the file somewhere safe, in case you need it later.

Tell us what you are moving from, and we will give you specific advice.
`),

  tpl(C, "invite-accepted", "Welcome a teammate", "Welcome a new person who joined a workspace", "team",
    "Welcome to the team on OnboardOps", "Here is what you can do first.",
    ["Open my portal", "{{login_url}}"], `
Hi {{name}},

You have joined {{workspace}} on OnboardOps. This is where you will find your training, your schedule and your records.

## What you can do
- See your shifts and request time off.
- Finish the training assigned to you.
- Read and sign company policies.
- Complete checklists for your shift.
- See your own records.

## Your first steps
1. Open My Portal.
2. Check whether any training is waiting for you, and start it.
3. Read any policy you are asked to sign.

>+ Your records are private. You can only see your own, and the people who manage your team can see what their role allows.

## Need help
Ask your manager first. If you are stuck signing in, use the "Forgot password" link on the sign-in page.

We hope your first days go well.
`),

  tpl(C, "employee-welcome", "Welcome for new employees", "A friendly message for new hires at a customer's business", "welcome",
    "Welcome to {{workspace}}, {{name}}", "Here is how to find your training and schedule.",
    ["Sign in", "{{login_url}}"], `
Hi {{name}},

Welcome to {{workspace}}. Your team uses OnboardOps to share training, schedules and policies, and your account is ready.

## What to do first
1. Select the button above and sign in.
2. Set a password you will remember, and turn on two-step sign-in if you are asked to.
3. Open the Training tab and start the course your manager assigned.
4. Check your shifts on the Schedule tab.

## What you will find
- **Training:** short lessons and a quiz. You get a certificate when you pass.
- **Schedule:** your shifts, and a way to ask for time off.
- **Policies:** what your workplace expects, and a place to sign that you have read them.
- **Checklists:** the tasks for your shift.

## A few tips
- If you do not pass a quiz the first time, you can try again after a short wait.
- You can ask the AI helper about a lesson if something is unclear.
- Your manager can answer anything that is not covered.

We are glad you are on the team.
`),
];
