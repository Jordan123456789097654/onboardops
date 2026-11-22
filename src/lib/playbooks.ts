export type Playbook = { slug: string; title: string; summary: string; chapters: { h: string; p?: string[]; ul?: string[] }[] };

const NOTE = "This playbook is general guidance, not legal advice. Employment law differs by state and situation, so check important matters with an employment attorney or HR professional.";

export const playbooks: Playbook[] = [
  {
    slug: "first-90-days",
    title: "The First 90 Days: a manager's playbook for new hires",
    summary: "A simple plan for before day one, the first week, the first month and the first 90 days, so new people become safe and confident faster.",
    chapters: [
      { h: "Why the first 90 days matter", p: ["People decide quickly whether they feel welcome, safe and clear about what is expected. Most early problems come from unclear expectations, not bad intentions. A predictable plan fixes that for both you and the new hire."] },
      { h: "Before day one", ul: ["Confirm the start time, address, parking, dress code and who to ask for. Send it in writing.", "Collect required paperwork through a secure channel. Do not ask for more personal information than you need.", "Create the new hire's account and assign required training and policies.", "Tell the team who is starting, what they will do and who will help them.", "Prepare equipment, uniform, locker or login in advance."] },
      { h: "Day one", ul: ["Greet them personally. Walk the site: exits, first aid, restrooms, break area, where to put belongings.", "Cover safety rules before any equipment or machinery is touched.", "Explain the schedule, how to clock in, how to ask for time off and how to report a problem.", "Hand over the handbook and the policies that apply. Give time to read before asking for a signature.", "Introduce a buddy and describe what the buddy will help with.", "End the day with a five-minute check-in: what was confusing, what do you need tomorrow?"] },
      { h: "Week one", ul: ["Shadow, then do tasks with a supervisor watching, then do tasks alone with a check at the end.", "Complete required training and record the results.", "Give specific feedback each day: one thing done well, one thing to adjust.", "Hold a short end-of-week conversation. Ask: what is unclear, what is missing, what would you change?"] },
      { h: "Days 8 to 30", ul: ["Set two or three clear goals for the first month, written down.", "Confirm that required certifications are done before solo work that needs them.", "Meet at day 30: review goals, training progress, attendance and how they are fitting in. Keep brief written notes.", "Fix problems early with a coaching conversation. Put the expectation in writing if it needs repeating."] },
      { h: "Days 31 to 90", ul: ["Increase responsibility step by step. Name what they are now trusted to do alone.", "Hold a 60-day check-in about workload, support and development interests.", "At day 90, write a short summary: strengths, areas to grow, next goals. Share it with the employee and let them respond.", "Ask for feedback about onboarding itself. Their answers are the best way to improve this plan."] },
      { h: "Common mistakes", ul: ["Skipping safety training because the team is busy.", "Assuming someone else told them how call-outs work.", "Giving feedback only when something goes wrong.", "Letting the plan live in one person's head. Put it in a checklist anyone can follow."] },
      { h: "A note on records", p: ["Keep records factual and consistent: what was covered, when, and who was present. Let the employee see and sign what concerns them. If you use OnboardOps, the checklist, training results and policy sign-offs create this record as you go.", NOTE] },
    ],
  },
  {
    slug: "fair-discipline",
    title: "Fair Discipline: a manager's playbook",
    summary: "How to respond to problems consistently and with dignity: coaching first, clear documentation, a chance to respond, and a real appeal.",
    chapters: [
      { h: "What fair discipline is", p: ["Fair discipline changes behavior and protects both the employee and the company. It is predictable, proportionate, documented and open to challenge. It is not punishment for its own sake, and it should never be a surprise."] },
      { h: "Principles to hold onto", ul: ["Clear expectations first. People cannot meet a rule they never heard.", "Consistency. The same behavior gets the same response, whoever the person is.", "Proportion. The response matches the seriousness and history.", "Privacy. Discuss it in private and share only with people who need to know.", "Voice. Employees can say their side and have it recorded.", "Dignity. Talk about the behavior, never the person's character."] },
      { h: "The steps", ul: ["Coaching conversation: an informal private talk. State the expectation, why it matters and what you will check. Make a short private note.", "Verbal warning: a formal conversation with a written record.", "Written warning: a signed document naming the policy, the facts and what must change.", "Final step: a suspension or final warning, reviewed with HR or a lawyer first.", "Termination review: only after earlier steps or for serious conduct. Always review with HR or a lawyer."] },
      { h: "Which conduct can skip steps", p: ["Decide this in advance and write it down. Typical examples are violence or threats, theft, serious safety violations and harassment. Serious or sensitive matters, especially harassment, discrimination, injuries, protected leave and complaints about managers, need HR or legal advice before you act."] },
      { h: "How to document", ul: ["Write what you saw or what the records show, with the date, time and place.", "Name the specific policy or expectation.", "Record what the employee said, in their words where you can.", "List earlier steps and dates.", "State what must change and when you will check.", "Give the employee a copy and keep one on file. Their signature means received, not agreed."] },
      { h: "Run the conversation", ul: ["Choose a private place and enough time.", "Start with the facts. Ask for their account and listen.", "Avoid guessing at motives. Avoid words like always, never, attitude or lazy.", "Explain the next step plainly. Do not threaten.", "Ask what support they need to meet the expectation.", "End by confirming the follow-up date."] },
      { h: "Appeals and responses", p: ["Let employees add a written response to any warning. Offer an appeal reviewed by someone who did not issue the warning, with a deadline such as five working days. Record the outcome, and if a warning is overturned, remove its effect and say so in the record."] },
      { h: "Check for consistency", ul: ["Each quarter, look at warnings by manager, department and policy.", "If one manager issues many more than others, find out why.", "If many appeals succeed on one policy, the rule or the training may be the problem.", "Fix the process before blaming people."] },
      { h: "When to stop and ask for advice", p: ["If the issue involves harassment, discrimination, retaliation, safety injuries, medical or family leave, immigration status, a union, or a complaint about a manager, pause and talk to HR or an employment lawyer before you do anything. Rushing can create risk for everyone.", NOTE] },
    ],
  },
];

export const playbookBySlug = (s: string) => playbooks.find((p) => p.slug === s);
