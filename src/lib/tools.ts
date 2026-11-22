/** Logic for the free public tools. Everything runs in the visitor's browser. Nothing here is legal advice. */

export const DRAFT_KEY = "oo-draft";
export type Draft =
  | { kind: "policy"; title: string; markdown: string }
  | { kind: "caseTemplate"; name: string; severity: "VERBAL_WARNING" | "WRITTEN_INFRACTION" | "SUSPENSION"; policy: string; summary: string }
  | { kind: "ladder"; rules: { whenSeverity: string; count: number; withinDays: number; escalateTo: string }[] };

export function saveDraft(d: Draft) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...d, savedAt: Date.now() })); return true; } catch { return false; }
}

export const DISCLAIMER = "This is a general starting point, not legal advice. Laws differ by state and situation. Have a qualified professional review anything important before you use it.";

/* ---------- Write-up helper ---------- */
const OPINION_WORDS: [RegExp, string][] = [
  [/\b(always|never|constantly|every time)\b/i, "Absolute words like always or never are hard to prove. Use dates and counts instead."],
  [/\b(lazy|rude|attitude|disrespectful|insubordinate|careless|sloppy)\b/i, "Describe the behavior you saw or heard instead of a label for the person."],
  [/\b(obviously|clearly|apparently|seems?|seemed|probably|i think|i feel|i believe)\b/i, "Stick to what you saw or what the records show, not what you assume."],
  [/\b(deliberately|on purpose|intentionally|didn'?t care|does not care)\b/i, "Avoid guessing at intent. State what happened."],
  [/\b(young|old|girl|boy|guys?|female|male|pregnan|disab|religio|race|racial)\w*\b/i, "Do not refer to age, gender, health, religion or other protected traits. If it truly matters, ask HR or a lawyer first."],
];
export const toneCheck = (text: string) => OPINION_WORDS.filter(([re]) => re.test(text)).map(([, tip]) => tip);

export type WriteUp = { employee: string; date: string; time: string; place: string; facts: string; policy: string; prior: "none" | "coaching" | "verbal" | "written"; expected: string; followUp: string; witnesses: string };

const nextStep = { none: "Coaching conversation", coaching: "Verbal warning", verbal: "Written warning", written: "Final warning or suspension (review with HR first)" } as const;
export const severityFor = (p: WriteUp["prior"]) => (p === "none" || p === "coaching" ? "VERBAL_WARNING" : p === "verbal" ? "WRITTEN_INFRACTION" : "SUSPENSION") as "VERBAL_WARNING" | "WRITTEN_INFRACTION" | "SUSPENSION";

export function buildWriteUp(w: WriteUp) {
  const d = w.date ? new Date(`${w.date}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "[date]";
  const fu = w.followUp ? new Date(`${w.followUp}T00:00:00`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "[follow-up date]";
  const priorText = { none: "No earlier conversation about this is on record.", coaching: "A coaching conversation about this took place earlier.", verbal: "A verbal warning about this was given earlier.", written: "A written warning about this was given earlier." }[w.prior];
  return [
    `NOTICE OF ${w.prior === "verbal" ? "WRITTEN WARNING" : w.prior === "written" ? "FINAL WARNING (HR REVIEW REQUIRED)" : "VERBAL WARNING"} (RECORD OF CONVERSATION)`,
    "",
    `Employee: ${w.employee || "[employee name]"}`,
    `Date written: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    "",
    "1. What happened",
    `On ${d}${w.time ? ` at ${w.time}` : ""}${w.place ? `, at ${w.place}` : ""}: ${w.facts.trim() || "[describe only what you saw, heard or what the records show]"}`,
    ...(w.witnesses.trim() ? ["", `Others who saw or have information: ${w.witnesses.trim()}`] : []),
    "",
    "2. The expectation that was not met",
    w.policy.trim() || "[name the policy, rule or written expectation, and where the employee can find it]",
    "",
    "3. Earlier steps",
    priorText,
    "",
    "4. What needs to change",
    w.expected.trim() || "[describe the specific behavior you expect from now on]",
    "",
    "5. Support and follow-up",
    `We will check in on ${fu}. If you need training, clarity about the expectation, or any other support to meet it, please tell your manager.`,
    `If this is not corrected, the next step may be: ${nextStep[w.prior]}.`,
    "",
    "6. Employee response",
    "The employee may add their own account in writing. It will be kept with this record.",
    "",
    "Employee comments: ____________________________________________",
    "",
    "Employee signature: ______________________   Date: ____________",
    "My signature confirms that I received this notice. It does not mean that I agree with it.",
    "",
    "Manager signature: _______________________   Date: ____________",
  ].join("\n");
}

/* ---------- "Should I write this up?" ---------- */
export type Answers = { sensitive: "yes" | "no"; told: "yes" | "no" | "unsure"; times: "first" | "second" | "repeat"; harm: "none" | "minor" | "serious"; fair: "yes" | "no" | "unsure" };
export type Advice = { level: "pause" | "fix" | "coaching" | "verbal" | "written" | "final"; title: string; reasons: string[]; next: string[] };

export function advise(a: Answers): Advice {
  if (a.sensitive === "yes") return { level: "pause", title: "Pause. Talk to HR or an employment lawyer first.", reasons: ["Harassment, discrimination, threats, injuries, theft, protected leave and complaints about others have legal rules and deadlines.", "A rushed write-up can create risk, including retaliation claims."], next: ["Write down the facts privately with dates, but do not issue anything yet.", "Do not confront or punish anyone before you get advice.", "Keep the matter confidential."] };
  if (a.fair === "no") return { level: "fix", title: "Fix consistency before you act.", reasons: ["If others did the same thing without consequences, a write-up can look unfair or targeted."], next: ["Decide the standard you will apply to everyone.", "Tell the whole team the expectation, then apply it evenly from that day."] };
  const reasons: string[] = [];
  if (a.told === "no") reasons.push("The employee may never have been told the rule. Start by making the expectation clear.");
  if (a.told === "unsure") reasons.push("You are not sure the expectation was communicated. Confirm that it was written down or said before you discipline.");
  if (a.told === "yes") reasons.push("The expectation was communicated, which supports taking a formal step.");
  reasons.push({ first: "This is the first time.", second: "This is the second time, so a pattern is starting.", repeat: "This has happened repeatedly." }[a.times]);
  reasons.push({ none: "Nothing was harmed.", minor: "There was minor impact.", serious: "There was serious harm or risk." }[a.harm]);
  const next = ["Write down the facts: date, time, place and what you saw.", "Cite the specific policy or expectation.", "Give the employee a chance to respond and keep their response."];
  if (a.told !== "yes" || (a.times === "first" && a.harm === "none")) return { level: "coaching", title: "Start with a coaching conversation.", reasons, next: ["Talk privately and explain the expectation and why it matters.", "Agree what will change and when you will check in.", "Make a short private note of the conversation. It is not a warning.", ...next.slice(2)] };
  if (a.harm === "serious" && a.times === "repeat") return { level: "final", title: "A final step may be needed. Review with HR before acting.", reasons, next: ["Gather every earlier record.", "Review the history and your policies with HR or a lawyer.", ...next] };
  if (a.times === "repeat" || (a.times === "second" && a.harm === "minor")) return { level: "written", title: "A written warning is reasonable.", reasons, next };
  return { level: "verbal", title: "A verbal warning, with a written record, fits.", reasons, next };
}

/* ---------- Policy builder ---------- */
export type Field = { key: string; label: string; type: "text" | "number" | "select" | "yesno"; options?: string[]; def: string | number | boolean };
export type Topic = { id: string; name: string; fields: Field[]; build: (v: Record<string, string | number | boolean>, company: string) => string };

const yes = (v: unknown) => v === true || v === "true";
export const topics: Topic[] = [
  { id: "attendance", name: "Attendance and punctuality", fields: [
    { key: "grace", label: "Grace period for arriving late (minutes)", type: "number", def: 5 },
    { key: "callBy", label: "Call or message before shift starts (minutes)", type: "number", def: 60 },
    { key: "who", label: "Who to contact", type: "text", def: "your supervisor" },
    { key: "noshow", label: "Missing a shift with no contact counts as", type: "select", options: ["a serious violation", "a written warning step", "grounds for review"], def: "a serious violation" },
    { key: "note", label: "Ask for a doctor's note for absences over (days)", type: "number", def: 3 },
  ], build: (v, c) => `# Attendance and Punctuality Policy\n\n**Applies to:** all employees of ${c}.\n\n## Why this policy exists\nTeams depend on each other. When someone is late or absent without notice, others cover for them. This policy sets simple, clear expectations.\n\n## What we expect\n1. Arrive ready to work at your scheduled start time. Arrivals up to ${v.grace} minutes late are noted but not counted against you.\n2. If you will be late or cannot work, contact ${v.who} at least ${v.callBy} minutes before your shift starts. Use the agreed way: phone call or message, not a message to a coworker.\n3. For absences longer than ${v.note} days, you may be asked for documentation. We will keep it private.\n4. Missing a shift without contacting us is treated as ${v.noshow}.\n\n## What happens if the policy is not followed\nWe respond step by step, starting with a conversation. Repeated problems may lead to a verbal warning, a written warning, and further steps. You can always add your side in writing.\n\n## Protected absences\nThis policy does not apply to absences protected by law, such as approved leave. Tell your manager if you think an absence is protected.\n\n## Questions\nAsk ${v.who} or HR.` },
  { id: "phones", name: "Mobile phones at work", fields: [
    { key: "where", label: "Where phones may be used", type: "select", options: ["breaks and break areas only", "anywhere unless it affects work", "only for work purposes"], def: "breaks and break areas only" },
    { key: "driving", label: "Is the work around vehicles or machinery?", type: "yesno", def: true },
    { key: "emergency", label: "Employees can be reached in an emergency through", type: "text", def: "the main office phone number" },
    { key: "photos", label: "Photos and recordings of the workplace", type: "select", options: ["need a manager's permission", "are not allowed", "are allowed if no one else is shown"], def: "need a manager's permission" },
  ], build: (v, c) => `# Mobile Phone Policy\n\n**Applies to:** all employees of ${c}.\n\n## Purpose\nPhones are useful, but they can distract us from our work and from the people around us.\n\n## Use of phones\n- Personal phones may be used in ${v.where}.${yes(v.driving) ? "\n- Never use a phone while operating a vehicle, forklift or machinery. Stop, park or shut down first." : ""}\n- Keep ringers off or on vibrate while working.\n\n## Emergencies\nIf family needs to reach you in an emergency, they can use ${v.emergency}. We will get the message to you right away.\n\n## Photos and recordings\nPhotos, video and audio recordings at work ${v.photos}. Do not record customers, coworkers or confidential information.\n\n## If the policy is not followed\nWe will start with a conversation. Repeated problems may lead to a warning under our progressive discipline process.\n\n## Questions\nAsk your supervisor or HR.` },
  { id: "safety", name: "Workplace safety and reporting", fields: [
    { key: "report", label: "Report hazards, injuries and near misses to", type: "text", def: "your supervisor immediately" },
    { key: "ppe", label: "Protective equipment (PPE) is required for", type: "text", def: "all warehouse and dock areas" },
    { key: "stop", label: "Employees may stop work if a task is unsafe", type: "yesno", def: true },
    { key: "drug", label: "Include a fitness-for-duty statement", type: "yesno", def: true },
  ], build: (v, c) => `# Workplace Safety Policy\n\n**Applies to:** all employees and visitors at ${c}.\n\n## Our commitment\nEveryone goes home safe. Safety comes before speed and before production targets.\n\n## Your responsibilities\n1. Follow posted safety rules and the training you received.\n2. Wear protective equipment (PPE) as required in ${v.ppe}.\n3. Keep walkways, exits and equipment clear.\n4. Report every hazard, injury and near miss to ${v.report}, even if no one was hurt.\n${yes(v.stop) ? "5. You may stop work if a task looks unsafe. Tell your supervisor. You will not be punished for raising a safety concern in good faith.\n" : ""}${yes(v.drug) ? "\n## Fitness for duty\nDo not work if you are impaired by alcohol, drugs or fatigue in a way that could put you or others at risk. Tell your supervisor if you are unsure.\n" : ""}\n## Reporting and retaliation\nReporting a safety concern is protected. We do not retaliate against anyone who does so in good faith.\n\n## If the policy is not followed\nSafety violations are taken seriously and may lead to discipline, up to and including termination.\n\n## Questions\nAsk your supervisor or HR.` },
  { id: "dress", name: "Dress code and uniform", fields: [
    { key: "style", label: "General standard", type: "select", options: ["company uniform", "business casual", "casual and clean", "safety-appropriate work clothes"], def: "safety-appropriate work clothes" },
    { key: "shoes", label: "Footwear requirement", type: "text", def: "closed-toe, non-slip shoes" },
    { key: "accommodate", label: "Mention accommodations for religious and medical needs", type: "yesno", def: true },
  ], build: (v, c) => `# Dress Code and Uniform Policy\n\n**Applies to:** all employees of ${c}.\n\n## Purpose\nOur clothing helps us stay safe and look professional to customers.\n\n## Standard\nWear ${v.style}. Clothing should be clean, in good repair and not offensive. Footwear: ${v.shoes}.\n${yes(v.accommodate) ? "\n## Accommodations\nIf your religion, a medical condition or a disability affects how you can meet this policy, tell your manager or HR. We will work with you on a reasonable accommodation.\n" : ""}\n## If the policy is not followed\nYour supervisor will talk with you first. You may be asked to change before continuing work.\n\n## Questions\nAsk your supervisor or HR.` },
  { id: "social", name: "Social media", fields: [
    { key: "speak", label: "Employees may speak about the company online", type: "select", options: ["as themselves, not on the company's behalf", "only if they get approval", "freely, following the rules below"], def: "as themselves, not on the company's behalf" },
    { key: "rights", label: "State that this does not limit legally protected discussion of pay and working conditions", type: "yesno", def: true },
  ], build: (v, c) => `# Social Media Policy\n\n**Applies to:** all employees of ${c}.\n\n## Purpose\nWhat you post can affect you, your coworkers and customers.\n\n## Guidelines\n- Employees may speak about the company online ${v.speak}. Make clear that opinions are your own.\n- Do not share confidential information, customer data, or private details about coworkers.\n- Do not harass, threaten or discriminate against anyone online.\n- Do not post photos or video of customers or restricted areas without permission.\n${yes(v.rights) ? "\n## Your legal rights\nThis policy does not stop you from discussing wages, hours or working conditions with others, or from any activity protected by law.\n" : ""}\n## If the policy is not followed\nWe will talk with you first. Serious violations may lead to discipline.\n\n## Questions\nAsk your supervisor or HR.` },
];

export const signOffSheet = (title: string, company: string) =>
  `# ${title}: Sign-off sheet\n\n**Company:** ${company || "[company]"}\n\nBy signing below I confirm that I received and read this policy. My signature means I received it. It does not mean I agree with every part.\n\n| Employee name | Signature | Date |\n| --- | --- | --- |\n${Array.from({ length: 12 }, () => "|  |  |  |").join("\n")}`;

/* ---------- Discipline ladder ---------- */
export type Rule = { whenSeverity: string; label: string; count: number; withinDays: number; escalateTo: string; escalateLabel: string };
export const defaultRules = (): Rule[] => [
  { whenSeverity: "VERBAL_WARNING", label: "Verbal warnings", count: 2, withinDays: 90, escalateTo: "WRITTEN_INFRACTION", escalateLabel: "a written warning" },
  { whenSeverity: "WRITTEN_INFRACTION", label: "Written warnings", count: 2, withinDays: 180, escalateTo: "SUSPENSION", escalateLabel: "a suspension" },
  { whenSeverity: "SUSPENSION", label: "Suspensions", count: 2, withinDays: 365, escalateTo: "TERMINATION", escalateLabel: "a termination review" },
];

/* ---------- Handbook outline ---------- */
export const industries = ["Warehouse and logistics", "Restaurant and food service", "Retail", "Healthcare and care", "Office and professional", "Online community or gaming team"] as const;
const core = ["Welcome and mission", "Employment basics (at-will statement, hiring, classifications)", "Equal opportunity and anti-harassment", "Reporting concerns and non-retaliation", "Work hours, breaks and timekeeping", "Attendance and punctuality", "Pay, overtime and pay schedule", "Time off and leave", "Conduct and progressive discipline", "Appeals and complaint process", "Technology, phones and privacy", "Safety and emergency procedures", "Employee records and privacy", "Ending employment", "Acknowledgment and signature page"];
const extra: Record<string, string[]> = {
  "Warehouse and logistics": ["Forklift and powered equipment rules", "Lifting, ergonomics and PPE", "Dock and vehicle safety", "Inventory accuracy and scanning"],
  "Restaurant and food service": ["Food safety and hygiene", "Tips and tip pooling", "Uniform and grooming", "Alcohol service rules", "Allergen handling"],
  Retail: ["Customer service standards", "Cash handling and loss prevention", "Opening and closing procedures", "Discounts and employee purchases"],
  "Healthcare and care": ["Patient and client privacy", "Infection control", "Licenses and credential tracking", "Mandatory reporting duties"],
  "Office and professional": ["Remote and hybrid work", "Expense reimbursement", "Confidential information", "Equipment and software use"],
  "Online community or gaming team": ["Moderator conduct and community rules", "Handling private messages and reports", "Confidentiality of user information", "Conflicts of interest and favoritism", "Volunteer vs paid role terms"],
};
export function handbookSections(industry: string, size: "1-10" | "11-50" | "51-200", remote: boolean) {
  const s = [...core.slice(0, 5), ...(extra[industry] ?? []), ...core.slice(5)];
  if (remote) s.splice(5, 0, "Remote work and working from home");
  if (size !== "1-10") s.splice(s.length - 1, 0, "Performance reviews and development");
  if (size === "51-200") s.splice(s.length - 1, 0, "Leave laws that apply at 50+ employees (FMLA) and company size notices");
  return s;
}
export const handbookMarkdown = (sections: string[], company: string) => `# ${company || "Company"} Employee Handbook: Outline\n\n${sections.map((x, i) => `${i + 1}. ${x}`).join("\n")}\n\nNote: ${DISCLAIMER}`;
