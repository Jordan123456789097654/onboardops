import { tpl } from "./types";

const C = "Customer Success" as const;

export const SUCCESS = [
  tpl(C, "inactive", "We haven't seen you in a while", "Re-engage a workspace that has gone quiet", "chat",
    "Is everything okay with your OnboardOps workspace?", "We noticed it has been quiet. Can we help?",
    ["Pick up where you left off", "{{login_url}}"], `
Hi {{name}},

We noticed that no one has signed in to {{workspace}} for {{days}} days. We do not mind, and we do not want to nag. We just want to check that you have what you need.

## Common reasons teams go quiet
- It got busy, and setup slipped down the list.
- Something was confusing, and nobody had time to ask.
- It did not do something you needed.

## A way back in
1. Sign in. Your records and settings are exactly as you left them.
2. Pick one small thing: assign a course, or try one checklist.
3. If you are stuck, reply and we will help directly.

## We would like to know
If OnboardOps is not right for you, we would value hearing why. It is the most useful thing a customer can tell us.

Either way, thank you for trying it.
`),

  tpl(C, "no-courses", "Build your first course", "Nudge a workspace that has no courses yet", "book",
    "Your workspace has no courses yet", "A quick way to get your first one built.",
    ["Open the course builder", "{{action_url}}"], `
Hi {{name}},

You have set up {{workspace}}, but there are no courses in it yet. Training is where most teams see the first real benefit, so here is the fastest way in.

## The 10-minute way
1. Take a procedure you already use. A document, an email or even a few notes will do.
2. Open the course builder and paste it into the draft tool.
3. Read what it produces, and fix anything that is not right.
4. Publish and assign it to one person.

## What makes a course people finish
- Short lessons, about two minutes each.
- A quiz with five to eight questions.
- A clear reason why it matters.

>+ You do not need to be a trainer. Most teams start by writing down what they already tell new hires out loud.

If you would like a hand, reply with the topic and we will suggest an outline.
`),

  tpl(C, "unassigned-staff", "Staff without training", "Tell managers some people have no courses assigned", "team",
    "{{count}} people in your workspace have no training assigned", "Make sure everyone has what they need.",
    ["See who", "{{action_url}}"], `
Hi {{name}},

We noticed that {{count}} active people in {{workspace}} have no courses assigned to them. That may be on purpose, but it is worth a look.

## Why it matters
If someone has no training on record, you cannot show they were trained. That is a gap if anything goes wrong.

## How to fix it
1. Open the training page and look at your roles.
2. Link each course to the job roles that need it.
3. People in those roles get it automatically, including new hires.
4. For one-off needs, assign a course to a person directly.

## A tip
Link the most important course, such as safety, to every role first. That gives everyone a baseline.

If some people really do not need training, no action is needed.
`),

  tpl(C, "overdue-tips", "Training is overdue: how to catch up", "Help managers deal with overdue training", "clock",
    "{{count}} training items are overdue: here's how to catch up", "A practical plan.",
    ["See what's overdue", "{{action_url}}"], `
Hi {{name}},

{{count}} courses in {{workspace}} are past their due date. Do not worry. It is common, and it is fixable.

## Why training goes overdue
- People do not know it is assigned.
- There is no time during a shift.
- The due date was too short.

## A catch-up plan
1. Open the overdue list and look at who has the most.
2. Give people paid time to finish, such as ten minutes at the start of a shift.
3. Extend due dates that were not realistic.
4. Turn on reminders so people are told before it is late.

## Stop it happening again
- Set sensible default due dates on each course.
- Review the dashboard at the start of each week.
- Recognize people who finish early.

>+ Overdue training is easiest to fix when it is small. A few items today beat a long list in a month.
`),

  tpl(C, "cert-expiring", "Certificates about to expire", "Remind managers about upcoming renewals", "calendar",
    "{{count}} certificates expire in the next 30 days", "Plan the renewals now.",
    ["See what expires", "{{action_url}}"], `
Hi {{name}},

{{count}} training certificates and credentials in {{workspace}} expire within the next 30 days.

## What happens when they expire
- Courses with a validity period assign themselves again.
- Employees are warned 30 and 7 days before.
- Credentials such as licenses are flagged on your dashboard.

## What to do now
1. Open the list and sort by date.
2. Tell the people involved, and give them time to renew.
3. For licenses, record the new date as soon as they have it.
4. Check anything critical, such as forklift or food handler certificates, first.

>! An expired license can stop someone from working a certain task. Do not leave it to the last day.

You can also have alerts sent to your manager channel in Discord, Slack or Teams.
`),

  tpl(C, "feedback-request", "How are we doing?", "Ask customers for feedback", "chat",
    "Two minutes of your time? Tell us how we are doing", "Your feedback shapes what we build.",
    ["Give feedback", "{{action_url}}"], `
Hi {{name}},

You have been using OnboardOps for a while, and we would like to know how it is going for you.

## Three quick questions
1. What is the one thing OnboardOps does best for you?
2. What is the most frustrating thing?
3. If you could change one thing, what would it be?

## How to answer
Reply to this email in a few lines, or use the feedback button inside the app. Short and honest is better than polished.

## What we do with it
We read every response. Common themes go on the roadmap, and we tell people when something they asked for ships.

Thank you. Feedback from real teams is how we make this better.
`),

  tpl(C, "nps", "Would you recommend us?", "A simple recommendation survey", "chat",
    "How likely are you to recommend OnboardOps?", "One question, ten seconds.",
    ["Answer in 10 seconds", "{{action_url}}"], `
Hi {{name}},

One question: **how likely are you to recommend OnboardOps to a friend or colleague who runs a team?**

Pick a number from 0 (not at all) to 10 (definitely). The button above takes you to a page where you can choose it.

## Why we ask
It is a simple way to see whether we are getting better. It is not a sales tool.

## Tell us why
If you are happy to, add a sentence about the number you picked. A reason is worth more than the score.

## Anonymous?
Your answer is linked to your account so we can follow up if you want us to. Tell us if you would rather it was not.

Thank you for helping us improve.
`),

  tpl(C, "case-study", "Share your story", "Ask a happy customer for a testimonial or case study", "pen",
    "Would you share how OnboardOps helps your team?", "We would love to tell your story, with your approval.",
    ["Tell us your story", "{{action_url}}"], `
Hi {{name}},

You have been getting real results from OnboardOps, and we would love to share your story, if you are happy to.

## What it would involve
- A short conversation, about 20 minutes, or a few written answers.
- We write it up and send you a draft.
- Nothing is published until you approve it, and you can change or remove it at any time.

## What it would look like
A short case study or a quote on our website, with your name and business name only if you want them there.

## What you get
- Visibility for your business.
- A say in how we describe you.
- Our thanks, and a hand shaping the product.

>+ If you would rather stay private, that is completely fine. Just let us know and we will not ask again.
`),

  tpl(C, "office-hours", "Join our office hours", "Invite customers to a live Q&A", "calendar",
    "Join our live office hours on {{date}}", "Bring your questions. We will answer them live.",
    ["Reserve a spot", "{{action_url}}"], `
Hi {{name}},

We are hosting a live session where you can ask us anything about OnboardOps, and see how other teams set it up.

[details]
Date: {{date}}
Time: {{start_time}} ({{timezone}})
Length: {{duration}}
Where: {{location}}

## What we will cover
- A walkthrough of {{topic}}.
- Questions from you, in the order they come in.
- A look at what is coming next.

## How to get the most from it
1. Send us your questions beforehand by replying to this email.
2. Bring a real scenario, such as a course you want to build or a process you want to fix.
3. Invite a colleague.

If you cannot attend, we will share a recording and the answers afterwards.
`),

  tpl(C, "referral", "Know a team that could use us?", "Invite customers to refer others", "invite",
    "Know a business that could use OnboardOps?", "We would be grateful for an introduction.",
    ["Share OnboardOps", "{{action_url}}"], `
Hi {{name}},

If OnboardOps is helping you, you probably know someone else who runs a team and would find it useful. A friendly introduction means a lot to us.

## How to share it
1. Forward them the link above, or send them to onboardops.org.
2. Tell them in a sentence what it did for you.
3. Let us know, and we will reach out gently.

## Who it is a good fit for
Teams with shifts and real paperwork: restaurants, retail, warehouses, healthcare, home services and similar.

## What we offer
{{referral_offer}}

There is no pressure at all. Thank you for the support you have already shown us.
`),

  tpl(C, "roadmap-vote", "Help us choose what to build next", "Ask customers to vote on priorities", "chat",
    "Help us decide what to build next", "Vote on what matters most to you.",
    ["Vote now", "{{action_url}}"], `
Hi {{name}},

We cannot build everything at once, so we would like your help choosing what comes next.

## The shortlist
1. {{option_one}}
2. {{option_two}}
3. {{option_three}}
4. {{option_four}}

## How to vote
Reply with your top two, in order, and a line on why they matter to you. The "why" is the most helpful part.

## What happens next
We will count the replies, and tell you what we chose and why. The public roadmap will show it.

>+ We read every answer, and we are not only counting votes. A good reason from one customer can outweigh a pile of clicks.

Thank you for helping us build the right things.
`),

  tpl(C, "writeups-guide", "Writing fair records", "A best-practice guide to documenting incidents", "book",
    "How to write records that are fair and hold up", "Practical advice from what we see across teams.",
    ["Open the records guide", "{{support_url}}"], `
Hi {{name}},

A good record protects your team and your business. A poor one can cause problems for both. Here is what works.

## Write facts, not opinions
- Weak: "He has a bad attitude."
- Better: "On 12 March at 9:15, he told a customer to 'figure it out yourself' in front of two other staff."

## Always include
- The date, time and place.
- What was seen or said, in plain words.
- The policy it relates to.
- Who else saw it.
- What was explained to the employee afterwards.

## Be consistent
Apply the same rule in the same way to everyone. Records that treat similar cases differently are hard to defend.

## Let the employee respond
They can add their side and appeal. It makes the process fairer and your records stronger.

>! OnboardOps keeps records. It does not give legal or HR advice. For serious matters, speak with a qualified professional.
`),

  tpl(C, "health-check", "Your quarterly health check", "A summary and suggestions for the quarter", "eye",
    "Your OnboardOps quarterly check-up", "How your workspace is doing, and ideas to improve it.",
    ["Open your dashboard", "{{login_url}}"], `
Hi {{name}},

Here is a short check-up on {{workspace}} for the last quarter.

[details]
People: {{people}}
Courses published: {{courses}}
Passed this quarter: {{passed}}
Overdue now: {{overdue}}
Credentials expiring in 90 days: {{expiring}}

## What is going well
{{good_one}}

## What to look at next
- {{focus_one}}
- {{focus_two}}

## Ideas
1. Review roles so new hires get the right courses automatically.
2. Look at quiz analytics for any question below 70%.
3. Turn on alerts in your chat app if you have not already.

We are happy to look at it with you. Reply if you would like a walkthrough.
`),

  tpl(C, "holiday-hours", "Support holiday hours", "Tell customers about reduced support hours", "calendar",
    "Our support hours over {{holiday}}", "When we will and will not be available.",
    ["Check status", "{{status_url}}"], `
Hi {{name}},

Our team is taking some time off for {{holiday}}, so our support hours will be different.

[details]
Closed: {{start_date}} to {{end_date}}
Back: {{date}}
Normal hours: Monday to Friday, 9am to 5pm Eastern

## What this means
- Messages you send are saved, and we reply when we are back.
- The chat bubble will tell you we are away.
- The service itself is monitored throughout, and live status stays on {{status_url}}.

## If it is urgent
For a security concern, tell us as clearly as you can in a message, and we will see it first when we return.

## A tip
If you plan to make big changes, such as importing lots of staff, do it before we go. We would love to help you through it.

Enjoy the break, and thank you for your patience.
`),
];
