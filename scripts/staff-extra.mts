// More content for the OnboardOps staff workspace: courses, policies, checklists, departments and roles.
import type { StaffCourse } from "./staff-courses.mts";
const q = (prompt: string, options: string[], correct: number, explanation: string) => ({ prompt, options, correct, explanation });

export const EXTRA_COURSES: StaffCourse[] = [
  {
    title: "Phishing Spotting for New Hires",
    description: "Certificate: Phishing Aware. Recognise fake emails, links and requests, and know exactly what to do when you see one.",
    category: "Security", passingScore: 85, validityDays: 365,
    lessons: [
      { title: "What phishing looks like", secs: 90, md: "Phishing is a message that tricks you into giving away a password, a code, money or access.\n\nSigns:\n- **Urgency or fear:** 'act in the next hour', 'your account will be closed'.\n- **A request for secrets:** passwords, one-time codes, recovery codes, card numbers.\n- **Odd senders:** a name you know with a different address, or a look-alike domain (onboardops.co instead of onboardops.org).\n- **Unexpected attachments** or links to sign in.\n- **Pressure to skip the usual steps**, such as 'the boss needs this now'.\n\nNo one at OnboardOps or at any vendor will ask for your password or code." },
      { title: "Check before you click", secs: 90, md: "1. **Hover over the link** to see where it really goes. Better, do not click: type the address yourself.\n2. **Read the sender's actual address,** not only the display name.\n3. **Look at the domain letter by letter.** Swapped letters and extra words are common.\n4. **Ask yourself:** was I expecting this? Does it ask me to do something unusual?\n5. **Verify by another way:** message the person on a different channel.\n\nBe extra careful with messages about invoices, password resets you did not request, shared documents, and gift cards." },
      { title: "If you spot one, or clicked one", secs: 90, md: "**If you spot one:** do not reply, do not click. Report it to the other staff member and delete it after we have noted it.\n\n**If you clicked or typed something:** tell the incident lead **immediately.** Speed matters far more than embarrassment. Change the password you used, sign out of all sessions, and check recovery details. If a code or key was shared, we rotate it (Incident Response Handbook 7.5).\n\nReporting is never punished. Hiding it is what makes it worse." },
    ],
    questions: [
      q("Which is a sign of phishing?", ["A message you were expecting from a known colleague", "An urgent message asking for your one-time code", "A calendar invite from your own manager you scheduled", "A newsletter you subscribed to"], 1, "Requests for codes with urgency are classic phishing."),
      q("The sender's name is your boss but the address is from another domain. What do you do?", ["Reply right away", "Do not click; check by another channel and report it", "Forward it to a customer", "Open the attachment"], 1, "Verify by another way and report."),
      q("Which domain looks like a fake of onboardops.org?", ["onboardops.org", "onb0ardops.org", "mail.onboardops.org", "www.onboardops.org"], 1, "A zero instead of an o is a look-alike."),
      q("You clicked a link and typed your password. First step?", ["Wait and see", "Tell the incident lead immediately and change the password", "Delete the email and say nothing", "Restart your computer only"], 1, "Speed matters; report at once."),
      q("Will a vendor ever ask for your password or code?", ["Yes if urgent", "Yes by phone", "No, never", "Yes if they are polite"], 2, "No legitimate vendor asks for them."),
      q("What is the safest way to reach a service from a suspicious email?", ["Click the link", "Type the address yourself", "Call the number in the email", "Reply to the email"], 1, "Type it yourself."),
    ],
  },
  {
    title: "First Week at OnboardOps",
    description: "Welcome course. Who we are, how we work, the handbooks to read, tools, and what to do in your first days.",
    category: "Onboarding", passingScore: 80, validityDays: null,
    lessons: [
      { title: "Who we are", secs: 90, md: "OnboardOps helps small businesses train new hires, keep policies and checklists, and track certifications and credentials. We are a small team, so each of us does many jobs and covers for each other.\n\nOur values:\n1. Customers first, honestly.\n2. Keep it simple.\n3. Own it: whoever sees a problem starts fixing it or hands it over clearly.\n4. Protect data.\n5. Learn in the open." },
      { title: "How we work", secs: 90, md: "- **Daily:** a short written note: what you did, what you are doing, what blocks you. Check the support inbox and alerts.\n- **Weekly:** a 30-minute review of tickets, incidents, bugs, the audit log and outreach.\n- **Monthly:** a one-page report.\n- **Quarterly:** a readiness review: drill, restore test, access review and handbook updates.\n\nDecide in writing for anything affecting customers, money, security or the law. Take real time off, and tell the other person before you are away." },
      { title: "Your first week", secs: 90, md: "1. Set up your named accounts, a password manager, **two-factor and a passkey** everywhere.\n2. Read the handbooks in this workspace and acknowledge each one.\n3. Complete the required courses: Security and Access Basics, Data Protection and Privacy, Phishing Spotting, and Incident Response Fundamentals. Support staff also take Support Excellence.\n4. Walk through a past incident and a support case.\n5. Shadow for a week, then work with review, then work alone.\n6. Get added to alerts and the on-call plan.\n\nAsk questions early. There are no silly ones." },
    ],
    questions: [
      q("What do we write each day?", ["Nothing", "A short note of what we did, will do and what blocks us", "A full report", "Only when asked"], 1, "A short daily note keeps us aligned."),
      q("What do you set up first, on every service?", ["A nickname", "Two-factor sign-in and a passkey", "A shared login", "Email forwarding"], 1, "Strong sign-in comes first."),
      q("You notice a problem that is not yours. What should you do?", ["Ignore it", "Start fixing it or hand it over clearly", "Wait for someone to complain", "Post it publicly"], 1, "We own problems."),
      q("Where do you find company rules and guides?", ["In the handbooks in this workspace", "Only by asking", "In personal notes", "Nowhere"], 0, "All handbooks live here."),
      q("When may you work completely alone?", ["Day one", "After a week of shadowing and a period of reviewed work", "Never", "Only on weekends"], 1, "We build up gradually."),
    ],
  },
  {
    title: "Customer Onboarding: Setting Up a New Customer",
    description: "Certificate: Customer Onboarding. How we set up a new customer's workspace, invite them and help them get value in the first week.",
    category: "Support", passingScore: 85, validityDays: 365,
    lessons: [
      { title: "Before you set up", secs: 90, md: "1. Confirm the business name, the owner's name and **the owner's own email**.\n2. Ask what they need first: training, policies, or checklists, and roughly how many people.\n3. Check whether the owner already has an account; if so we attach the workspace to it.\n4. Decide the starter content: pick from the library or describe the business so a draft can be prepared.\n\nStarter content is always added as **drafts for the owner to review**. We never publish for them." },
      { title: "Creating the workspace", secs: 120, md: "Use the staff tool to set up a workspace for a customer:\n1. Enter the business, owner name and email.\n2. Choose starter courses, policies and checklists, or use the AI draft and review it.\n3. Tick 'Email the owner now' to send the invite, which lets them set their own password.\n4. Open the new workspace and check the owner is listed, the content is present as drafts, and the email log shows the invite as sent.\n\nIf the invite is not delivered, check the email log, then spam, then send a fresh one or use another sign-in path." },
      { title: "The first week", secs: 90, md: "- **Day 1:** check the invite was received and the owner signed in. Offer a 15-minute walkthrough.\n- **Day 3:** ask how it is going; help publish the first course or checklist.\n- **Day 7:** check they invited their team. Encourage two-factor or a passkey.\n- **Day 30:** look at usage and write kindly if nothing is published.\n\nRecord what they asked for. Repeat questions become help articles. Never ask for a customer's password." },
    ],
    questions: [
      q("Whose email should you use for the new owner?", ["Your own", "The owner's own email", "A shared company email", "Any address"], 1, "It must be the owner's own email."),
      q("How is starter content added?", ["Published immediately", "As drafts for the owner to review", "Not at all", "Only after payment"], 1, "Drafts, so the owner stays in control."),
      q("The invite did not arrive. What first?", ["Resend it five times", "Check the email log, then spam, then send a fresh one", "Give them a password by email", "Wait a month"], 1, "Diagnose first, then resend."),
      q("When do you check that the customer invited their team?", ["Day 1", "Around day 7", "After a year", "Never"], 1, "A week in is the right check-in."),
      q("May you ask the new owner for their password to help set up?", ["Yes", "Only on the phone", "Never", "Only if they offer"], 2, "Never ask for a password."),
    ],
  },
];

const md = (s: string) => s.trim();
export const EXTRA_POLICIES: { title: string; description: string; md: string }[] = [
  { title: "Acceptable Use of Company Devices and Accounts", description: "What staff may and may not do with devices, accounts and company data.", md: md(`
# Acceptable Use of Company Devices and Accounts

## Purpose
Keep our devices, accounts and customers' data safe and our work professional.

## Rules
1. Use company accounts and devices for company work. Keep personal use minimal and never let it put company data at risk.
2. Every device is encrypted, locks within 5 minutes, and has its updates installed promptly.
3. Do not install software that you do not need or cannot trust. Do not disable security tools.
4. Use only your own account. Never share a login or a recovery code.
5. Do not store customer data on personal devices, personal cloud storage, or unapproved tools, including AI tools.
6. Do not use company systems for anything unlawful, harassing, or that could harm customers or the company.
7. Lost or stolen devices are reported to the incident lead at once.
8. Company data stays company data. When you leave, return devices and remove access the same day.

## Monitoring
Staff actions in company systems are logged for security and accountability. We do not read personal messages.

## Breaking the rules
Honest mistakes are reported and fixed. Deliberate or repeated breaches may lead to removal of access and further action.`) },
  { title: "Password and Secrets Policy", description: "How we create, store, share and rotate passwords, keys and tokens.", md: md(`
# Password and Secrets Policy

## Passwords
- Use a password manager. Long, unique and generated for every service.
- One strong master passphrase, with two-factor on the manager.
- Never reuse a password. Never write one on paper left in the open.

## Sign-in
- Two-factor on every account that touches the product, hosting, database, email, DNS, domain, code or money.
- Prefer passkeys, then an authenticator app. Do not rely on text messages alone.
- Keep recovery codes in the password manager and a printed copy somewhere safe.

## Secrets (keys, tokens, private links)
- Production secrets live only in the hosting settings and the password manager.
- Never paste a secret into chat, email, tickets, screenshots, code, documents or an AI tool.
- Test machines use test keys and local data.

## Rotation
Rotate a secret at least yearly, when someone with access leaves, and **immediately** if it may have been exposed. Rotate first, investigate after.

## If a secret leaks
Tell the incident lead at once and follow the Incident Response Handbook 7.5.`) },
  { title: "Code of Conduct", description: "How we treat customers, each other and the people whose data we hold.", md: md(`
# Code of Conduct

We are a small team and the way we behave is our reputation.

## We commit to
- **Respect.** Treat customers, colleagues and the public with courtesy. No harassment, discrimination or bullying of any kind.
- **Honesty.** Say what we can do and what we cannot. Do not mislead customers, regulators or each other. Admit mistakes early.
- **Privacy.** Look at customer data only when needed and with a stated reason. Never use it for personal gain or curiosity.
- **Integrity.** Declare conflicts of interest. Do not accept gifts that could influence a decision. Do not use customer information for any other purpose.
- **Safety.** Raise concerns about safety, security or unlawful behaviour.

## Speaking up
Anyone can raise a concern with the other staff member, or with Jordan Daniels directly. Concerns are taken seriously, handled in confidence and never punished when raised in good faith. If the concern is about the person you would normally tell, tell someone else you trust, or an outside adviser.

## Consequences
Breaches may lead to removal of access, ending of engagement and, where the law requires, reporting to authorities.`) },
  { title: "Remote Work and On-Call Policy", description: "Working from anywhere safely, and how we cover alerts.", md: md(`
# Remote Work and On-Call Policy

## Working remotely
- Work from a private, safe place. Use a trusted network; avoid public Wi-Fi for admin work, or use a trusted VPN.
- Keep screens out of view of others. Lock your device when you step away.
- Do not leave devices unattended in vehicles or public places.
- Follow the Security and Access Handbook everywhere you work.

## Availability
- Normal working hours are published on the website. Tell the other person when you will be away.
- During those hours check the support inbox and alerts at least twice a day.

## On-call
- Alerts for SEV 1 and 2 reach both of us. Agree each week who is primary.
- Primary responds to a SEV 1 immediately, and to a SEV 2 within 30 minutes in waking hours or within 2 hours overnight.
- If the primary cannot respond in 15 minutes, the other person takes over.
- Swap whenever you need, and tell the other person beforehand.

## Rest
After a long overnight incident, take time to rest. Hand over cleanly and do not make risky changes when exhausted.

## Travel
Tell the other person when you will be travelling or offline. Carry recovery methods and a way to reach vendor support.`) },
];

const item = (label: string, required = true) => ({ label, required });
export const EXTRA_CHECKLISTS: { title: string; shiftType: "OPENING" | "MID_SHIFT" | "CLOSING"; items: ReturnType<typeof item>[]; scheduleDays?: number[]; dueTime?: string }[] = [
  { title: "New customer setup", shiftType: "OPENING", items: [item("Confirm business name, owner name and the owner's own email"), item("Check whether the owner already has an account"), item("Pick starter courses, policies and checklists (drafts)"), item("Create the workspace and send the invite"), item("Check the email log shows the invite as sent"), item("Open the workspace and confirm drafts are present"), item("Offer a 15-minute walkthrough"), item("Diary a day 3, day 7 and day 30 check-in")] },
  { title: "Customer cancellation and data export", shiftType: "CLOSING", items: [item("Confirm the request comes from the owner (strong verification)"), item("Ask why in one line and log the reason"), item("Offer a data export and confirm they have it"), item("Explain what happens to their data and when"), item("Cancel billing and confirm in writing"), item("Schedule deletion after the grace period"), item("Record the deletion date and result"), item("Remove them from outreach and mailing lists")] },
  { title: "Staff onboarding", shiftType: "OPENING", items: [item("Create their named accounts on our domain"), item("Two-factor and a passkey on every account"), item("Password manager set up with recovery codes stored"), item("Least access granted (Security and Access Handbook section 3)"), item("Handbooks read and acknowledged"), item("Required courses assigned"), item("Walked through a past incident and a support case"), item("Added to alerts and on-call plan")] },
  { title: "Staff offboarding", shiftType: "CLOSING", items: [item("Remove access the same day on every system"), item("Rotate shared secrets they knew"), item("Revoke sessions and remove their passkeys"), item("Collect or wipe devices"), item("Transfer ownership of accounts and documents"), item("Remove from alerts, groups and the on-call plan"), item("Write down what only they knew"), item("Update roles and contacts in the handbooks")] },
  { title: "Deploy", shiftType: "MID_SHIFT", items: [item("Change described and risk judged"), item("Second person reviewed, or waited and re-read"), item("Tests and type-check pass"), item("Database changes noted and ready"), item("Know the last good deployment and how to roll back"), item("Deploy at a quiet time"), item("Watch monitoring for 30 minutes"), item("Changelog updated if customers can see it", false)] },
  { title: "Monthly access review", shiftType: "CLOSING", items: [item("List everyone with access to each system"), item("Remove anyone who no longer needs it"), item("Check admin and owner roles are justified"), item("Check two-factor is on for every account"), item("Review the staff audit log for odd activity"), item("Review support access grants and reasons"), item("Rotate any secret due this month"), item("Update the access table in the Security and Access Handbook")] },
];

export const EXTRA_DEPARTMENTS = ["Engineering", "Sales and Outreach", "Security"];
export const EXTRA_ROLES = [
  { title: "Engineer", description: "Builds and fixes the product, deploys changes safely and joins incident response as technical responder.", courses: ["First Week at OnboardOps", "Security and Access Basics", "Phishing Spotting for New Hires", "Data Protection and Privacy", "Incident Response Fundamentals"] },
  { title: "Outreach Specialist", description: "Runs honest, small-batch outreach to prospects, tracks replies and opt-outs, and hands real conversations to support.", courses: ["First Week at OnboardOps", "Phishing Spotting for New Hires", "Data Protection and Privacy", "Customer Onboarding: Setting Up a New Customer"] },
  { title: "Security Officer", description: "Owns access reviews, key rotation, security reports and the security handbook.", courses: ["First Week at OnboardOps", "Security and Access Basics", "Phishing Spotting for New Hires", "Data Protection and Privacy", "Incident Response Fundamentals", "Incident Commander Certification"] },
];
