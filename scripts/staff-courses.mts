// Training content for the OnboardOps staff workspace. Passing a course issues a certificate; validityDays makes it expire so it must be renewed.
export type StaffCourse = {
  title: string; description: string; category: string; passingScore: number; validityDays: number | null; prerequisiteTitles?: string[];
  lessons: { title: string; md: string; secs: number }[];
  questions: { prompt: string; options: string[]; correct: number; explanation: string }[];
};

const q = (prompt: string, options: string[], correct: number, explanation: string) => ({ prompt, options, correct, explanation });

export const STAFF_COURSES: StaffCourse[] = [
  {
    title: "Incident Response Fundamentals",
    description: "Certificate: Incident Response Certified. What an incident is, how to rate it, and what to do in the first 15 minutes.",
    category: "Incident Response", passingScore: 85, validityDays: 365,
    lessons: [
      { title: "What counts as an incident", secs: 90, md: "An incident is anything that harms, or could harm, the **availability**, **integrity** or **confidentiality** of OnboardOps or our customers' data.\n\nExamples: the site is down, sign-in fails, email stops arriving, a key is leaked, a customer sees another customer's data, an attacker is active, or a vendor we rely on fails.\n\nGolden rules:\n- Protect people and data first, restore service second, find the cause third.\n- One person leads. The other supports.\n- Tell customers early, plainly and honestly.\n- Write everything down as it happens.\n- Reviews are blameless: we fix systems, not people." },
      { title: "Severity levels", secs: 90, md: "We rate every incident from 1 to 4.\n\n- **SEV 1 Critical:** whole service down, confirmed data exposure, or an active attacker. Respond immediately at any hour. Customer update within 30 minutes.\n- **SEV 2 Major:** a major feature is broken or many customers are affected. Respond within 30 minutes in waking hours. Customer update within 1 hour.\n- **SEV 3 Minor:** limited impact and a workaround exists. Same business day.\n- **SEV 4 Low:** no customer impact. Next working day.\n\nWhen in doubt, rate it one level higher. You can lower it later." },
      { title: "The first 15 minutes", secs: 120, md: "1. **Acknowledge** the alert and tell the other person you have it.\n2. **Open the log** and write the time and what you see.\n3. **Rate** the severity.\n4. **Assign roles:** lead, technical, communications, scribe.\n5. **Contain before you cure** if data may be exposed or an attacker is active.\n6. **Post a holding message** for SEV 1 and 2.\n7. **Set the next update time** and keep to it.\n\nThen diagnose from the outside in: vendor status pages first, then what changed recently (deploy, key, DNS, schema). If a deploy is the likely cause, **roll back first**, investigate after." },
    ],
    questions: [
      q("Which of these is an incident?", ["A customer asks how to add a course", "Customers cannot sign in", "A new feature idea", "A typo in a help article"], 1, "Sign-in failing affects availability for customers."),
      q("The whole site is down. What severity?", ["SEV 4", "SEV 3", "SEV 2", "SEV 1"], 3, "A whole-service outage is SEV 1."),
      q("You are not sure whether it is SEV 2 or SEV 3. What do you do?", ["Rate it lower to avoid panic", "Rate it one level higher and lower it later", "Wait until a customer complains", "Ask the customer to choose"], 1, "When in doubt, rate higher."),
      q("A bad deploy is the likely cause. First move?", ["Debug it live for an hour", "Roll back to the last good deployment", "Delete the database", "Tell customers it will fix itself"], 1, "Roll back first, investigate after."),
      q("What is the right order of priorities?", ["Fix quickly, then find cause, then protect data", "Protect people and data, restore service, find the cause", "Find who is to blame first", "Write the review first"], 1, "Protect first, restore second, learn third."),
      q("When should you start the incident log?", ["After it is fixed", "As soon as you acknowledge the problem", "Only for SEV 1", "Next week"], 1, "Write it down as it happens."),
    ],
  },
  {
    title: "Incident Commander Certification",
    description: "Certificate: Incident Commander. For the person who leads an incident: decisions, communication, security events and the review.",
    category: "Incident Response", passingScore: 90, validityDays: 365, prerequisiteTitles: ["Incident Response Fundamentals"],
    lessons: [
      { title: "Leading an incident", secs: 120, md: "The incident lead decides, assigns and keeps the clock. The lead does **not** type every command.\n\n- Name the roles out loud: technical, communications, scribe.\n- Never allow two people to change the same system at once.\n- Make decisions and say why; the scribe records them.\n- Check in every 15 to 30 minutes: what do we know, what are we doing, what changed.\n- Hand over clearly if you are tired: say what is known, what is tried, what is next.\n- Declare it over only when service is verified, monitoring is green for 30 minutes, customers are told and the cause is understood." },
      { title: "Communicating under pressure", secs: 120, md: "Be early, specific, honest and plain.\n\nEvery update says: **what is affected, what we know, what we are doing, when the next update is.**\n\nDo not promise a fix time you cannot keep. Promise the next update.\n\nDo not blame people or vendors, and do not guess about the cause. Do not share internal detail or post publicly before customers hear from us directly.\n\nThe resolution message says what was affected, when it ended, one plain sentence on the cause, any action customers should take, and that a fuller explanation will follow." },
      { title: "Security events and the law", secs: 150, md: "For a suspected breach: **contain, preserve, assess, notify.**\n\n- Contain: revoke sessions, rotate exposed keys, disable the feature, suspend the source.\n- Preserve: keep logs and evidence; note times in UTC.\n- Assess: what data, whose, how many, how long, still happening, how did they get in.\n- Fix the way in before you declare it over.\n- Notify: **contact a lawyer promptly.** Duties and deadlines depend on location, data type and contracts, and some are as short as 72 hours. Do not guess.\n\nA leaked key is rotated first, investigated second." },
      { title: "The blameless review", secs: 90, md: "Hold the review within 3 working days for SEV 1 and 2.\n\nCover: summary and impact, timeline, root and contributing causes (ask why five times), what went well, what went badly, where we were lucky, and actions with owners and dates.\n\nBlameless means we ask **how the system allowed it**, not **who did it**. People who admit mistakes early make us safer; never punish that." },
    ],
    questions: [
      q("What should the incident lead mostly do?", ["Run every command personally", "Decide, assign and keep the clock", "Write the code fix", "Stay silent until the end"], 1, "The lead coordinates; others do the hands-on work."),
      q("What must every customer update include?", ["The name of who caused it", "What is affected, what we know, what we are doing, the next update time", "A promise of when it will be fixed", "A technical stack trace"], 1, "Those four things, and a time for the next update."),
      q("You do not know when it will be fixed. What do you promise?", ["A fix time anyway", "The time of the next update", "Nothing", "Compensation"], 1, "Promise the next update, not a fix time."),
      q("You suspect customer data was exposed. What is the right first sequence?", ["Notify press, then investigate", "Contain, preserve evidence, assess, then notify with legal advice", "Delete the logs", "Wait to see if anyone notices"], 1, "Contain, preserve, assess, notify."),
      q("An API key was pasted in a chat. What first?", ["Ignore if no one used it", "Rotate it, then investigate", "Edit the chat message", "Wait for the quarterly review"], 1, "Rotate first, investigate second."),
      q("When is an incident over?", ["When the alert stops", "When service is verified, monitoring is green for 30 minutes, customers told and cause understood", "When the lead is tired", "When a customer says thanks"], 1, "All of the closing conditions must be met."),
      q("What is the purpose of a blameless review?", ["Find who to discipline", "Find how the system allowed the failure and fix it", "Satisfy customers", "Shorten the log"], 1, "We fix systems, not people."),
    ],
  },
  {
    title: "Support Excellence",
    description: "Certificate: Support Certified. Writing replies, verifying identity, protecting data and knowing when to escalate.",
    category: "Support", passingScore: 85, validityDays: 365,
    lessons: [
      { title: "Replies that help", secs: 90, md: "Customers are busy business owners, not technical experts.\n\n- Greet by name and show you understood in one line.\n- Give the answer or what you are doing **first**.\n- Use numbered steps if they need to act.\n- Say what happens next and when.\n- Keep it short and warm. No jargon, no blame, no empty promises.\n\nNever leave a ticket without an owner or a next step. If it is stalled, tell the customer why and when you will update." },
      { title: "Verifying before you change anything", secs: 120, md: "Match the check to the risk.\n\n- **No check:** general questions.\n- **Light:** the email comes from the account address (status and explanations).\n- **Strong:** two-factor reset, email change, ownership transfer, deleting data, granting staff access, lifting a ban. Do **at least two** of: reply from the account email, the workspace owner confirms, they answer something only they would know, or the owner approves in the product.\n\nIf you are not sure, do not act. Slow is cheaper than fooled.\n\nNever ask for a password, a full card number or an ID document by any channel." },
      { title: "Protecting data and escalating", secs: 120, md: "- Look only at what you need. Write a real reason for every access.\n- Never sign in as a customer. Never copy customer data into chat tools or unapproved AI.\n- Employees asking about their employer's records are pointed to the employer, who controls that data.\n\nEscalate to the incident lead when two or more customers report the same serious problem, data may have been seen by the wrong person, there is an attack or threat, the product is down, or a regulator, lawyer or the press contacts us.\n\nMessage the other staff member with what, who, since when, and ticket links." },
    ],
    questions: [
      q("What goes first in a good reply?", ["A long apology", "The answer or what you are doing", "Company history", "A link to the terms"], 1, "Lead with the answer or the action."),
      q("Someone emails asking to reset two-factor on an account. What do you do?", ["Reset it, they sound urgent", "Use strong verification with at least two checks first", "Ask for their password", "Ignore it"], 1, "Two-factor resets need strong verification."),
      q("May you ask a customer to email their password?", ["Yes if urgent", "Yes if they are the owner", "Never", "Only by phone"], 2, "Never ask for a password by any channel."),
      q("An employee asks to delete their employer's training records. Who decides?", ["Support alone", "The employer, who controls that data", "The employee", "A coin flip"], 1, "The employer controls workspace data."),
      q("Two customers report the same sign-in failure. What now?", ["Reply to each and wait", "Escalate to the incident lead", "Close both tickets", "Post on social media"], 1, "Multiple reports of a serious issue is an incident."),
      q("Why write a reason when you view a customer's workspace?", ["It is optional", "It is recorded and reviewed, and keeps access accountable", "To impress customers", "It is only for billing"], 1, "Access is logged and reviewed."),
    ],
  },
  {
    title: "Security and Access Basics",
    description: "Certificate: Security Basics. Passwords, passkeys, two-factor, secrets and spotting phishing.",
    category: "Security", passingScore: 85, validityDays: 365,
    lessons: [
      { title: "Sign-in and accounts", secs: 90, md: "- Every person has their own named account. **No shared logins.**\n- Use a password manager with long, unique, generated passwords.\n- Turn on **two-factor sign-in everywhere**. Prefer passkeys, then an authenticator app. Never rely on text messages alone.\n- Keep recovery codes in the password manager and a printed copy somewhere safe.\n- Lock your screen. Encrypt your disk. Keep software updated." },
      { title: "Secrets", secs: 90, md: "A secret is any key, token, password, recovery code or private link.\n\n- Production secrets live only in the hosting settings and the password manager.\n- **Never paste a secret into chat, email, tickets, screenshots, code, documents or an AI tool.**\n- If one is exposed, treat it as leaked: **rotate first**, investigate second.\n- Rotate yearly, when someone with access leaves, and whenever a leak is possible.\n- Use test keys and local data on test machines, never production credentials." },
      { title: "Phishing and social engineering", secs: 90, md: "Be suspicious of urgency, requests for money, passwords or codes, unexpected attachments, and 'the boss needs this now'.\n\n- Check the real sender address and the real link target.\n- Go to a service by typing its address, not by clicking.\n- No one at OnboardOps or any vendor will ask for your password or code.\n- Account changes follow our verification rules, however urgent the request sounds.\n- Report suspected phishing immediately, even if you clicked. Reporting is never punished." },
    ],
    questions: [
      q("Which sign-in method is strongest?", ["Password only", "Password and text message", "Passkey", "A shared team password"], 2, "Passkeys resist phishing and count as two factors."),
      q("A key was pasted into a group chat. What first?", ["Delete the message and carry on", "Rotate the key", "Wait and see", "Tell no one"], 1, "Treat it as leaked: rotate first."),
      q("Is it fine to share one login between two staff for convenience?", ["Yes", "Only for email", "No, everyone has their own account", "Only at weekends"], 2, "No shared logins."),
      q("An email says 'send me the code you just got, it is urgent'. What do you do?", ["Send it", "Refuse and report it", "Send half of it", "Forward it to a customer"], 1, "Nobody legitimate asks for your codes."),
      q("Where may production secrets be stored?", ["In chat history", "In a document everyone can edit", "In the hosting settings and the password manager", "In the code"], 2, "Only the hosting settings and password manager."),
      q("You clicked a suspicious link. What now?", ["Hide it", "Tell the other staff member immediately", "Wait a week", "Delete your account"], 1, "Report at once; it is never punished."),
    ],
  },
  {
    title: "Data Protection and Privacy",
    description: "Certificate: Data Protection Certified. Customer data, requests from individuals, AI tools and what to do when asked to hand data over.",
    category: "Privacy", passingScore: 85, validityDays: 365,
    lessons: [
      { title: "Whose data is it", secs: 90, md: "**Customer data** (a workspace's employees, records, policies, results, notes) belongs to the customer. We process it on their behalf. **Our own data** (account details, billing, our website visitors, our outreach contacts) we are responsible for directly.\n\nRules for everyone:\n- Collect and keep only what we need.\n- Use data only for the reason it was given.\n- Never sell customer data or use it for our own marketing.\n- Never move customer data to personal devices, personal cloud, chat tools or unapproved AI tools." },
      { title: "Requests from people and authorities", secs: 120, md: "When someone asks to see, correct, export or delete data:\n1. Log the request and the date.\n2. Verify identity strongly.\n3. Work out who controls the data. For workspace data, usually the customer (the employer).\n4. Reply within the deadline (often 30 days, shorter in some places).\n5. Record the outcome.\n\nWhen a lawyer, agency or anyone claims a right to data: **stop and ask Jordan.** Ask for a written valid request, tell the customer unless forbidden, and share only the minimum." },
      { title: "AI tools and new providers", secs: 90, md: "- Features that send text to an AI provider tell the person first, send the minimum, mask names and contact details where possible, and produce drafts a person checks.\n- Do not paste customer data into any other AI tool.\n- Before adding any new provider that handles customer personal data, give customers notice (our agreement sets a window) and update the policy, the data agreement and the security page first.\n- Never state how a provider keeps or uses data until you have checked its current terms." },
    ],
    questions: [
      q("Who controls a workspace's employee records?", ["OnboardOps", "The customer (the employer)", "Any staff member", "The AI provider"], 1, "We process it on the customer's behalf."),
      q("A person emails demanding all their data immediately. First step?", ["Send everything", "Log it and verify identity strongly", "Ignore it", "Forward it to the customer unread"], 1, "Log and verify before anything else."),
      q("A stranger says they are police and wants a customer's data. What do you do?", ["Send it", "Stop and ask Jordan; ask for a written valid request", "Send half", "Ask them to call back next year"], 1, "Never hand over data on a claim alone."),
      q("May you paste a customer's records into a public AI chat to summarise them?", ["Yes, it is faster", "Only if names are removed", "No, never into unapproved tools", "Yes, if it is short"], 2, "Not into unapproved tools."),
      q("Before adding a new provider that handles customer personal data, what must happen?", ["Nothing", "Give customers notice and update the policy first", "Add it and tell them later", "Ask the provider"], 1, "Notice and policy updates come first."),
      q("An employee asks us to delete their employer's training records. What is right?", ["Delete them", "Point them to the employer who controls that data", "Ignore them", "Delete half"], 1, "The employer decides."),
    ],
  },
];
