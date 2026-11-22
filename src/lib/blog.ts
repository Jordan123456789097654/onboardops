export type Post = { slug: string; title: string; description: string; date: string; readMins: number; body: { h?: string; p?: string[]; ul?: string[] }[] };

const DISCLAIMER = "This article is general information, not legal advice. Employment law differs by state and situation, so check with an employment attorney before acting on a serious case.";

export const posts: Post[] = [
  {
    slug: "how-to-document-an-employee-warning",
    title: "How to document an employee warning",
    description: "A plain, step-by-step way to write up a verbal or written warning so it is fair, factual and holds up later.",
    date: "2026-11-21",
    readMins: 5,
    body: [
      { p: ["A warning is only as useful as its record. Months later, a manager, an employee or a lawyer may read it and ask what happened, who knew the rule, and whether the person had a chance to respond. Good documentation answers those questions in advance."] },
      { h: "Write down facts, not opinions", p: ["Say what you saw or what the records show. \"Arrived at 9:22 on March 3, 22 minutes after a 9:00 start, third late arrival in 30 days\" is a fact. \"Has a bad attitude about timekeeping\" is an opinion, and it invites a dispute you cannot settle."] },
      { h: "Include the pieces every record needs", ul: ["The date, time and place of the event, and the date you wrote the record.", "The specific policy or expectation that was not met, with its name or number.", "What the employee said when you spoke with them, in their words where you can.", "Any earlier conversations, coaching or warnings on the same issue.", "What happens next: the expected change, the date you will check, and the consequence if it continues."] },
      { h: "Let the employee respond and sign", p: ["Give the employee a copy and a chance to add their side. A signature should mean \"I received this\", not \"I agree\". Say so on the form so nobody feels tricked into signing. If they refuse, note the refusal and who witnessed it."] },
      { h: "Keep confidential notes separate", p: ["Your own thoughts, comparisons to other employees and sensitive details belong in a restricted note, not in the copy the employee receives. OnboardOps keeps confidential manager notes hidden from employees and supervisors for exactly this reason."] },
      { h: "Be consistent", p: ["The same behavior should lead to the same step for different people. If you skip a step for one person, write down why. Uneven enforcement is the easiest thing for a reviewer to find."] },
      { p: [DISCLAIMER] },
    ],
  },
  {
    slug: "progressive-discipline-guide",
    title: "Progressive discipline: a practical guide",
    description: "How to build a ladder from coaching to termination that employees understand and managers apply the same way.",
    date: "2026-11-21",
    readMins: 5,
    body: [
      { p: ["Progressive discipline means responding to a problem with steps that get more serious only if the problem continues. Done well, it gives people a fair chance to fix things and gives the company a clear record."] },
      { h: "A common ladder", ul: ["Coaching conversation: informal, written down privately, no penalty.", "Verbal warning: a formal conversation, recorded.", "Written warning: a signed document that names the policy and the expected change.", "Final warning or suspension: a last step before ending employment.", "Termination: when the problem continues or the behavior is serious enough to skip steps."] },
      { h: "Decide in advance what can skip steps", p: ["Some conduct, such as violence, theft or serious safety violations, may justify going straight to a final step. Write those categories down before you need them so nobody improvises."] },
      { h: "Use a time window", p: ["Say how long a warning counts. A late arrival from 18 months ago should not weigh the same as one last week. Many teams let points or warnings expire after 6 to 12 months of clean record. OnboardOps supports a rolling strike-decay window for this."] },
      { h: "Let people appeal", p: ["An appeal reviewed by someone who did not issue the warning catches mistakes and shows employees the process is fair. Set a deadline, such as 5 working days, and record the outcome."] },
      { h: "Train the managers who apply it", p: ["The ladder only works if supervisors use it the same way. Walk through two or three real examples, and review a sample of cases each quarter for consistency across departments and managers."] },
      { p: [DISCLAIMER] },
    ],
  },
  {
    slug: "new-hire-onboarding-checklist",
    title: "A new-hire onboarding checklist for shift-based teams",
    description: "What to do before day one, on day one, in week one and in the first 90 days, so new people become safe and productive faster.",
    date: "2026-11-21",
    readMins: 4,
    body: [
      { p: ["The first days set habits and expectations. A short, repeatable checklist keeps important steps from depending on who happens to be on shift."] },
      { h: "Before day one", ul: ["Send the schedule, address, parking and who to ask for.", "Collect required forms, such as tax and work-authorization paperwork, through a secure channel.", "Create their account and assign required training.", "Tell the team who is starting and who will show them around."] },
      { h: "Day one", ul: ["Walk the site: exits, first aid, restrooms, break area.", "Review the handbook and have them sign the policies that apply.", "Cover safety rules before any equipment is touched.", "Pair them with a named buddy for the shift."] },
      { h: "Week one", ul: ["Finish role training and quizzes, and record the results.", "Shadow, then do tasks with a supervisor watching.", "Check in at the end of the week: what is unclear, what is missing."] },
      { h: "First 90 days", ul: ["Confirm required certifications are complete before solo work.", "Hold a 30-day and a 90-day conversation and write short notes.", "Set one or two goals for the next quarter."] },
      { p: ["Keep the checklist in one place, track who completed each step, and review it whenever a new hire says something was confusing. Those comments are the best source of improvements."] },
    ],
  },
  {
    slug: "writing-policies-employees-read",
    title: "Writing policies employees will actually read",
    description: "Shorter, clearer policies and a sign-off process that proves people received them.",
    date: "2026-11-21",
    readMins: 4,
    body: [
      { p: ["A policy nobody reads protects nobody. The goal is a document a new hire can understand in one sitting and a manager can point to with confidence."] },
      { h: "Keep each policy to one topic", p: ["Attendance, phones, safety and time off should be separate documents. Short policies are easier to read, update and sign, and a change to one does not force everyone to re-read everything."] },
      { h: "Start with why and who", p: ["Open with what the policy is for and who it applies to. Then state the rule in plain words, give one or two examples, and say what happens if it is not followed."] },
      { h: "Use plain language", ul: ["Prefer \"you must arrive on time\" to \"punctuality is expected\".", "Define any term a new hire might not know.", "Avoid stacking exceptions inside one sentence."] },
      { h: "Version and re-sign", p: ["When a policy changes, give it a new version, say what changed, and collect signatures again. A sign-off sheet showing who signed which version is strong evidence that the rule was communicated."] },
      { h: "Review on a schedule", p: ["Put a yearly review on the calendar. Laws change, and so does how your team works."] },
      { p: [DISCLAIMER] },
    ],
  },
  {
    slug: "handling-employee-appeals-fairly",
    title: "Handling employee appeals fairly",
    description: "How to review a disputed warning without taking sides too early, and how to record the decision.",
    date: "2026-11-21",
    readMins: 4,
    body: [
      { p: ["When an employee disagrees with a warning, the way you respond matters as much as the outcome. A fair process builds trust even when the decision is not what the employee hoped for."] },
      { h: "Separate the reviewer from the issuer", p: ["The person who gave the warning should not decide the appeal. Choose a manager or HR contact who was not involved, and tell the employee who it will be."] },
      { h: "Collect both sides", ul: ["Read the original record and any evidence attached.", "Ask the employee for their account in writing or in a meeting.", "Talk to witnesses if there are any, and record what they say.", "Check whether similar cases were handled the same way."] },
      { h: "Decide and explain", p: ["Uphold, change or overturn the warning, and write a short explanation in plain language. If a warning is overturned, remove its effect, such as strike points, and say so in the record."] },
      { h: "Set a timeline", p: ["Promise a response within a set number of working days and keep to it. Delay feels like dismissal."] },
      { h: "Watch the pattern", p: ["If many appeals succeed against one manager or one policy, the problem is probably the process or the rule, not the employees. Review appeal outcomes quarterly."] },
      { p: [DISCLAIMER] },
    ],
  },
];

export const postBySlug = (slug: string) => posts.find((p) => p.slug === slug);
