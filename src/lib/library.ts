/** Starter content a workspace can add in one click. These are generic starting points, not legal advice: review and adapt them. */
export type LibCourse = { id: string; title: string; description: string; category: string; passingScore: number; validityDays?: number; lessons: { title: string; md: string; secs: number }[]; questions: { prompt: string; options: string[]; correct: number; explanation: string }[] };
export type LibPolicy = { id: string; title: string; description: string; md: string };
export type LibChecklist = { id: string; title: string; shiftType: "OPENING" | "MID_SHIFT" | "CLOSING"; items: [string, boolean][] };
export type LibCase = { id: string; name: string; severity: "VERBAL_WARNING" | "WRITTEN_INFRACTION" | "STRIKE_POINTS" | "SUSPENSION"; points: number; policy: string; summary: string };

const q = (prompt: string, options: string[], correct: number, explanation: string) => ({ prompt, options, correct, explanation });

export const LIB_COURSES: LibCourse[] = [
  {
    id: "forklift", title: "Forklift Safety (Powered Industrial Trucks)", description: "Daily inspection, load handling, travel and incident response.", category: "Equipment", passingScore: 85, validityDays: 365,
    lessons: [
      { title: "Before you drive", secs: 40, md: "# Pre-shift inspection\n\nComplete the inspection card **every shift**. Check forks, mast, tires, horn, lights, backup alarm, brakes, steering, seat belt and fluid or battery level.\n\nAny failed item means the truck is **tagged out** and not used until repaired.\n\nOnly trained and authorized operators may drive. Never let anyone ride on the forks or the truck." },
      { title: "Driving and loads", secs: 45, md: "## Travel\n\n- Forks 4 to 6 inches off the floor, mast tilted back.\n- Slow at corners and sound the horn at blind spots.\n- On ramps, keep the load on the uphill side.\n\n## Loads\n\nStay within the capacity on the data plate. Center the load against the backrest. Never raise the load while moving." },
      { title: "If something goes wrong", secs: 30, md: "Stop, set the brake and secure the area. Report any incident or near miss before the end of the shift.\n\nIf the truck starts to tip, **stay in the seat, hold on and lean away**. Do not jump." },
    ],
    questions: [
      q("A daily inspection finds a cracked fork. What do you do?", ["Use it for light loads", "Tag the truck out and report it", "Finish the shift first", "Swap forks yourself"], 1, "A failed item means the truck is tagged out until repaired."),
      q("How high should forks be while traveling?", ["Eye level", "4 to 6 inches off the floor", "On the floor", "As high as the mast goes"], 1, "Low forks keep the truck stable."),
      q("Who may drive a forklift?", ["Anyone in a hurry", "Trained and authorized operators", "Anyone with a license", "A passenger, briefly"], 1, "Only trained and authorized operators."),
      q("If the truck starts to tip, you should:", ["Jump clear", "Stay in the seat, hold on and lean away", "Jump toward the load", "Let go of the wheel"], 1, "Jumping is how operators get crushed."),
      q("When must an incident or near miss be reported?", ["Next week", "Before the end of the shift", "Only if someone is hurt", "Never"], 1, "Report it the same shift."),
    ],
  },
  {
    id: "food", title: "Food Safety Basics", description: "Handwashing, temperatures, cross-contamination and allergens.", category: "Safety", passingScore: 85, validityDays: 365,
    lessons: [
      { title: "Hands and hygiene", secs: 35, md: "# Clean hands first\n\nWash hands for at least **20 seconds** with soap and warm water: when you start, after the restroom, after touching raw food, after handling trash, and any time they are dirty.\n\nStay home or tell your manager if you have vomiting, diarrhea, fever or jaundice." },
      { title: "Temperatures and cross-contamination", secs: 45, md: "## Keep it out of the danger zone\n\nCold food at **41°F or below**. Hot food at **135°F or above**. Between 41°F and 135°F bacteria multiply fast.\n\n## Prevent cross-contamination\n\nUse separate boards and utensils for raw meat and ready-to-eat food. Store raw meat below ready-to-eat food." },
      { title: "Allergens", secs: 30, md: "Know the major allergens: milk, eggs, fish, shellfish, tree nuts, peanuts, wheat, soy and sesame. When a guest reports an allergy, tell the manager, use clean utensils and surfaces, and never guess about ingredients." },
    ],
    questions: [
      q("How long should you wash your hands?", ["5 seconds", "At least 20 seconds", "A quick rinse", "Only when visibly dirty"], 1, "At least 20 seconds with soap and warm water."),
      q("What is the safe cold-holding temperature?", ["50°F or below", "41°F or below", "60°F or below", "Room temperature"], 1, "Cold food must stay at 41°F or below."),
      q("Where should raw chicken be stored?", ["Above ready-to-eat food", "Below ready-to-eat food", "Next to salad", "On the counter"], 1, "Store raw meat below ready-to-eat food."),
      q("A guest says they have a peanut allergy. First step?", ["Guess what is safe", "Tell the manager and follow allergen procedure", "Remove nuts and serve", "Ignore it"], 1, "Tell the manager and use allergen procedures."),
      q("You have a fever and vomiting. You should:", ["Work as normal", "Tell your manager and stay out of food handling", "Wear gloves", "Work the register only without telling anyone"], 1, "Do not handle food when sick."),
    ],
  },
  {
    id: "harassment", title: "Workplace Harassment Awareness", description: "What harassment is, how to speak up, and how reports are handled.", category: "Conduct", passingScore: 85, validityDays: 365,
    lessons: [
      { title: "What counts as harassment", secs: 40, md: "# Respect at work\n\nHarassment is unwelcome conduct based on a protected characteristic (such as race, sex, religion, age, disability or national origin) that is severe or pervasive enough to create a hostile or offensive environment, or that results in an employment decision.\n\nExamples: slurs, unwanted touching, sexual comments or advances, threats, and mocking someone's accent or disability.\n\nIntent does not matter. **Impact does.**" },
      { title: "Speaking up", secs: 35, md: "## You have options\n\nReport to your supervisor, a manager, the owner, or file an **incident report** in OnboardOps. If your supervisor is involved, go above them.\n\nRetaliation against anyone who reports in good faith is **not allowed**. Reports are taken seriously and handled as privately as possible." },
      { title: "If you see it", secs: 30, md: "Bystanders matter. If it is safe, say something or check in with the person. Report what you saw. Managers must report what they learn, even if the person asks them not to." },
    ],
    questions: [
      q("Harassment is judged mainly by:", ["Only the speaker's intent", "The impact and whether the conduct is unwelcome", "Whether anyone complained", "How long someone has worked there"], 1, "Impact and unwelcome conduct matter."),
      q("Who can you report to?", ["Only HR", "Supervisor, manager, owner or an incident report", "No one", "Only the person involved"], 1, "You have several ways to report."),
      q("Retaliation for a good-faith report is:", ["Allowed if the report was wrong", "Not allowed", "Sometimes fine", "Up to the supervisor"], 1, "Retaliation is not allowed."),
      q("A manager hears about harassment and the employee asks them to keep it secret. The manager should:", ["Keep it secret", "Report it as required", "Confront the person alone", "Wait a month"], 1, "Managers must report what they learn."),
      q("You see a coworker being harassed. If it is safe, you can:", ["Ignore it", "Say something, check in and report it", "Join in", "Post about it online"], 1, "Bystanders can help and report."),
    ],
  },
  {
    id: "fire", title: "Fire Safety and Emergency Evacuation", description: "Alarms, exits, extinguishers and meeting points.", category: "Safety", passingScore: 85, validityDays: 365,
    lessons: [
      { title: "Know your exits", secs: 30, md: "# Before anything happens\n\nLearn the **two nearest exits** from your work area and the outdoor **meeting point**. Keep exits, aisles and electrical panels clear at all times.\n\nNever block a fire door, and never lock an exit during operating hours." },
      { title: "If the alarm sounds", secs: 40, md: "## Evacuate\n\n1. Stop work and leave by the nearest safe exit.\n2. Help anyone who needs assistance if it is safe.\n3. Do not use elevators.\n4. Go to the meeting point and tell your supervisor you are out.\n5. Do not go back inside until you are told it is safe.\n\n## Extinguishers\n\nOnly fight a small fire if you are trained, have a clear exit behind you, and the fire is not spreading. Remember **PASS**: Pull, Aim, Squeeze, Sweep." },
    ],
    questions: [
      q("How many exits should you know?", ["One", "The two nearest", "None", "Only the front door"], 1, "Know the two nearest exits."),
      q("When the alarm sounds you should:", ["Finish your task", "Leave by the nearest safe exit", "Use the elevator", "Call a friend"], 1, "Evacuate by the nearest safe exit."),
      q("What does PASS stand for?", ["Push, Aim, Spray, Stop", "Pull, Aim, Squeeze, Sweep", "Point, Alert, Shout, Stay", "Pull, Alert, Spray, Sweep"], 1, "Pull, Aim, Squeeze, Sweep."),
      q("Is it ever okay to block a fire door?", ["Yes, briefly", "No, never", "When it is busy", "At night"], 1, "Never block fire doors or exits."),
      q("After you reach the meeting point you should:", ["Go back for belongings", "Tell your supervisor you are out", "Leave without telling anyone", "Wait inside"], 1, "Check in so everyone is accounted for."),
    ],
  },
];

export const LIB_POLICIES: LibPolicy[] = [
  { id: "conduct", title: "Code of Conduct", description: "How we treat each other and the business.", md: "# Code of Conduct\n\nWe treat coworkers, customers and visitors with respect. We follow the law and our policies, we are honest in our records, and we look out for each other's safety.\n\n## We do not tolerate\n\n- Harassment, discrimination or retaliation\n- Threats or violence\n- Theft, fraud or falsifying records\n- Working while impaired\n\n## Speak up\n\nReport concerns to your supervisor, a manager or the owner, or file an incident report. Good-faith reports are protected." },
  { id: "attendance", title: "Attendance and Punctuality", description: "Shifts, call-outs and lateness.", md: "# Attendance\n\n- Arrive ready to start at your scheduled time.\n- If you cannot make a shift, tell your supervisor **at least one hour before** it starts, by phone or the method your team uses.\n- A shift missed without notice is a no call, no show.\n- Repeated lateness or absences are handled under our progressive process.\n\nApproved leave is not counted against you. Request leave through your portal." },
  { id: "harassment", title: "Anti-Harassment and Non-Retaliation", description: "What is not allowed and how to report.", md: "# Anti-Harassment and Non-Retaliation\n\nHarassment or discrimination based on any protected characteristic is prohibited. This includes unwelcome comments, jokes, touching, images and messages, in person or online.\n\n## Reporting\n\nReport to any supervisor, manager or the owner, or file an incident report. You do not have to report to the person involved.\n\n## No retaliation\n\nNo one will be punished for reporting in good faith or taking part in an investigation." },
  { id: "safety", title: "Workplace Safety and Stop-Work Authority", description: "Everyone can stop an unsafe task.", md: "# Workplace Safety\n\nSafety comes before speed. Follow posted rules, wear required protective equipment and report hazards, injuries and near misses **the same shift**.\n\n## Stop-work authority\n\nAnyone may stop a task they believe is unsafe. No one is disciplined for stopping work in good faith." },
  { id: "drugs", title: "Drug and Alcohol Policy (starter)", description: "Fitness for duty. Adapt to your state's rules.", md: "# Drug and Alcohol Policy\n\nEmployees must be fit for duty. Working while impaired by alcohol, illegal drugs or misused medication is prohibited. If you take a prescription that may affect your safety, tell your manager that you need an adjustment, without sharing the diagnosis.\n\n*Drug-testing rules vary by state and industry. Review this with a qualified professional before using it.*" },
  { id: "social", title: "Social Media and Confidentiality", description: "Customer privacy and what not to post.", md: "# Social Media and Confidentiality\n\nDo not share customer information, private employee information or confidential business details online. Do not post anything that harasses coworkers. You may discuss your own wages, hours and working conditions." },
];

export const LIB_CHECKLISTS: LibChecklist[] = [
  { id: "open", title: "Opening checklist", shiftType: "OPENING", items: [["Unlock and disarm alarm", true], ["Walk the floor for hazards or spills", true], ["Check emergency exits are clear", true], ["Power on equipment and run quick checks", true], ["Review the day's schedule and notes", false]] },
  { id: "close", title: "Closing checklist", shiftType: "CLOSING", items: [["Clean and reset work areas", true], ["Power down and secure equipment", true], ["Take out trash and cardboard", false], ["Lock doors and windows", true], ["Arm alarm and record handoff notes", true]] },
  { id: "safety", title: "Daily safety walk", shiftType: "MID_SHIFT", items: [["Aisles and exits are clear", true], ["Fire extinguishers accessible and charged", true], ["First-aid kit stocked", false], ["Spills cleaned and wet-floor signs placed", true], ["Report any hazard found", true]] },
  { id: "vehicle", title: "Vehicle inspection", shiftType: "OPENING", items: [["Tires and lights", true], ["Brakes and steering", true], ["Fluids and fuel", true], ["Mirrors, horn and wipers", true], ["Damage walk-around, photo if found", false]] },
  { id: "kitchen", title: "Kitchen closing", shiftType: "CLOSING", items: [["Food labeled, dated and stored at proper temperature", true], ["Surfaces and equipment sanitized", true], ["Fryers and grills cleaned and off", true], ["Floor drains and floors cleaned", false], ["Temperature logs completed", true]] },
];

export const LIB_CASES: LibCase[] = [
  { id: "late", name: "Late arrival", severity: "VERBAL_WARNING", points: 0, policy: "Attendance and Punctuality", summary: "Employee arrived [number] minutes after the scheduled start on [date] without notice. Reminded of the call-ahead requirement." },
  { id: "ncns", name: "No call, no show", severity: "WRITTEN_INFRACTION", points: 2, policy: "Attendance and Punctuality", summary: "Employee did not report for the scheduled shift on [date] and did not contact a supervisor." },
  { id: "safety", name: "Safety rule violation", severity: "WRITTEN_INFRACTION", points: 2, policy: "Workplace Safety", summary: "On [date], employee [describe unsafe act and the rule it broke]. No injury / injury occurred. Retraining will be assigned." },
  { id: "ppe", name: "Missing protective equipment", severity: "VERBAL_WARNING", points: 1, policy: "Workplace Safety", summary: "Employee was observed without required [equipment] while performing [task] on [date]." },
  { id: "conduct", name: "Unprofessional conduct", severity: "WRITTEN_INFRACTION", points: 1, policy: "Code of Conduct", summary: "On [date], employee [describe behavior]. The expected standard was explained." },
  { id: "records", name: "Inaccurate record", severity: "WRITTEN_INFRACTION", points: 2, policy: "Code of Conduct", summary: "Employee entered or signed an inaccurate [record] on [date]. Facts and corrective steps are noted." },
];
