import { PrismaClient, type Role, type EmployeeStatus, type Readiness } from "@prisma/client";
import bcrypt from "bcryptjs";
import { writeAudit } from "../src/lib/audit";

const prisma = new PrismaClient();
export const DEMO_PASSWORD = "OnboardOps!2026";

type Q = { prompt: string; options: string[]; correct: number; explanation: string };
type L = { title: string; md: string; secs?: number; video?: string };

const safetyLessons: L[] = [
  {
    title: "Why the rules exist",
    md: `# Warehouse safety basics\n\nMost injuries at Northside happen in three places: **aisle intersections**, **the dock edge**, and **manual lifts**. This course covers all three.\n\n- Every injury report in the last year involved a skipped step, not missing equipment.\n- Near misses get reported the same shift. No blame for reporting.\n- If a rule is slowing you down, tell your supervisor. Do not skip it.`,
    secs: 40,
  },
  {
    title: "Aisles, intersections and pedestrian lanes",
    md: `## Pedestrian lanes\n\nWalk in the **green-painted lanes** only. Never cut through a staging bay.\n\n## Intersections\n\n1. Stop at every blind corner and sound the horn if driving a lift.\n2. Make eye contact with the operator before you cross.\n3. Headphones stay out in all operating areas.\n\n## Speed\n\nWalking pace (about 3 mph) inside buildings, no exceptions.`,
    secs: 45,
  },
  {
    title: "Lifting and the dock edge",
    md: `## Manual lifts\n\nAnything over **40 lb** gets a two-person lift or a cart. Keep the load close, bend the knees, turn with your feet.\n\n## Dock edge\n\nThe yellow line marks the dock edge. Stay behind it unless a trailer is chocked and the dock plate is set.\n\nIf the trailer wheel chock is missing, **stop and call the dock lead**.`,
    secs: 45,
  },
];
const safetyQs: Q[] = [
  { prompt: "Where may pedestrians walk in the warehouse?", options: ["Anywhere that is faster", "Only in green-painted pedestrian lanes", "Between staging bays", "Behind lift trucks"], correct: 1, explanation: "Pedestrian lanes keep walkers out of lift paths. Staging bays are never a shortcut." },
  { prompt: "You reach a blind corner on a lift truck. What do you do?", options: ["Slow slightly and continue", "Stop and sound the horn", "Speed up to clear it", "Flash the lights only"], correct: 1, explanation: "Stop and sound the horn at every blind corner." },
  { prompt: "What is the walking speed limit inside the building?", options: ["About 3 mph, walking pace", "5 mph", "Whatever the shift allows", "10 mph on lift trucks only"], correct: 0, explanation: "Walking pace, about 3 mph, for everyone." },
  { prompt: "At what weight does a manual lift require a second person or a cart?", options: ["20 lb", "40 lb", "75 lb", "100 lb"], correct: 1, explanation: "Over 40 lb needs a two-person lift or a cart." },
  { prompt: "The wheel chock is missing on a trailer you need to load. What now?", options: ["Load quickly while it is parked", "Hold the trailer with a pallet jack", "Stop and call the dock lead", "Ask the driver to stay in the cab"], correct: 2, explanation: "No chock, no loading. Stop and call the dock lead." },
];

const forkliftLessons: L[] = [
  { title: "Pre-shift inspection", md: `# Before you start the truck\n\nComplete the **daily inspection card** every shift:\n\n- Forks: no cracks, heel wear under 10%\n- Horn, lights, backup alarm\n- Brakes and steering\n- Battery or propane level\n- Seat belt latches\n\nAny failed item means a red tag and the truck stays parked.`, secs: 40 },
  { title: "Load handling and travel", md: `## Travel\n\n- Forks 4–6 inches off the floor, mast tilted back.\n- Travel with the load **downhill-first on ramps** (load facing downhill).\n- No passengers, ever.\n\n## Stacking\n\nNever stack above the rated capacity on the data plate. Check the plate when swapping attachments.`, secs: 45 },
  { title: "Parking and incident response", md: `## Parking\n\nForks flat on the floor, controls neutral, parking brake set, key out.\n\n## If something goes wrong\n\n1. Stop the truck and secure the area.\n2. Call your supervisor before moving anything.\n3. Write the incident report before end of shift.\n\nIf the truck tips, **stay in the seat, lean away, brace** and do not jump.`, secs: 40 },
];
const forkliftQs: Q[] = [
  { prompt: "A daily inspection finds a cracked fork. What happens?", options: ["Use it for light loads", "Red tag the truck and park it", "Finish the shift, then report", "Swap with a coworker's truck without telling anyone"], correct: 1, explanation: "A failed inspection item means a red tag and the truck stays parked." },
  { prompt: "How high should forks be while travelling?", options: ["Eye level", "4–6 inches off the floor", "Resting on the floor", "As high as the mast allows"], correct: 1, explanation: "Forks 4–6 inches up with the mast tilted back." },
  { prompt: "On a ramp, which way does a loaded truck face?", options: ["Uphill, load first", "Downhill, load facing downhill", "Sideways", "It does not matter"], correct: 1, explanation: "Keep the load downhill so it cannot slide off the forks." },
  { prompt: "If the truck begins to tip, you should:", options: ["Jump clear", "Stay in the seat, lean away and brace", "Jump toward the load", "Let go of the wheel and cover your head"], correct: 1, explanation: "Jumping is how operators get crushed. Stay in the seat and brace." },
  { prompt: "After an incident, when is the report due?", options: ["End of the week", "Before the end of your shift", "Only if someone is hurt", "Whenever the supervisor asks"], correct: 1, explanation: "Reports are written before end of shift while details are fresh." },
];

const remedialLessons: L[] = [
  { title: "Incident review: what went wrong", md: `# Safety retraining\n\nYou were assigned this course after a written infraction. It is not a punishment checklist. The goal is to walk through *why* the rule exists and show you can apply it.\n\n## How to use this course\n\n1. Read each lesson fully.\n2. Think about the shift where the incident happened.\n3. Pass the review quiz at 90% or higher.`, secs: 30 },
  { title: "Stop-work authority and reporting", md: `## Stop-work authority\n\nEvery person at Northside, from new hire to owner, can stop any task they believe is unsafe. Nobody gets written up for stopping work in good faith.\n\n## Reporting\n\n- Near miss: report within the shift.\n- Injury: report immediately, then seek care.\n- Property damage: take a photo before moving anything.`, secs: 30 },
];
const remedialQs: Q[] = [
  { prompt: "Who has stop-work authority?", options: ["Supervisors only", "Managers and above", "Every employee", "Only safety-trained leads"], correct: 2, explanation: "Everyone can stop an unsafe task." },
  { prompt: "What should you do before moving property that has been damaged?", options: ["Move it to clear the aisle", "Take a photo first", "Wait until next shift", "Ask a coworker to hide it"], correct: 1, explanation: "Photograph first so the report reflects what actually happened." },
  { prompt: "A near miss happens at 9 am. When do you report it?", options: ["Within the same shift", "Next Monday", "Only if it happens twice", "Never, nobody was hurt"], correct: 0, explanation: "Near misses are reported the same shift." },
  { prompt: "Can you be written up for stopping work you believe is unsafe, in good faith?", options: ["Yes, if you were wrong", "Yes, if your supervisor disagrees", "No", "Only on your first offence"], correct: 2, explanation: "Good-faith stop-work is protected." },
  { prompt: "After an injury, what is the right order?", options: ["Finish the task, then report", "Report immediately, then seek care", "Seek care, report next week", "Ask a friend to cover and go home"], correct: 1, explanation: "Report immediately and get care." },
];

async function ensureStaff() {
  const pw = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const [email, name, role] of [["staff@onboardops.org", "Site Admin", "OWNER"], ["support@onboardops.org", "Support Agent", "SUPPORT"]] as const) {
    await prisma.user.upsert({ where: { email }, create: { email, name, passwordHash: pw, platformRole: role, emailVerifiedAt: new Date() }, update: { platformRole: role } });
  }
  await prisma.user.updateMany({ where: { emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
}

async function main() {
  await ensureStaff();
  const existing = await prisma.workspace.findUnique({ where: { slug: "northside-supply-logistics" } });
  if (existing) {
    await addExtras(existing.id);
    console.log("Base seed already present; ensured extras (policies, incidents, reviews, notifications).");
    return;
  }
  const pw = await bcrypt.hash(DEMO_PASSWORD, 10);
  const ws = await prisma.workspace.create({ data: { name: "Northside Supply & Logistics", slug: "northside-supply-logistics", autoSuspendStrikeThreshold: 5, autoRetrainOnWrittenInfraction: true } });

  const depts = {
    wh: await prisma.department.create({ data: { workspaceId: ws.id, name: "Warehouse", colorCode: "#52525B" } }),
    dp: await prisma.department.create({ data: { workspaceId: ws.id, name: "Dispatch", colorCode: "#1D4ED8" } }),
    fd: await prisma.department.create({ data: { workspaceId: ws.id, name: "Front Desk", colorCode: "#059669" } }),
  };

  const mkCourse = async (title: string, description: string, category: string, passing: number, remedial: boolean, lessons: L[], qs: Q[]) => {
    const c = await prisma.course.create({ data: { workspaceId: ws.id, title, description, category, passingScore: passing, cooldownMinutes: remedial ? 10 : 15, isRemedial: remedial, isPublished: true } });
    await prisma.courseLesson.createMany({ data: lessons.map((l, i) => ({ courseId: c.id, orderIndex: i, title: l.title, contentMarkdown: l.md, videoUrl: l.video ?? null, minReadSeconds: l.secs ?? 30 })) });
    await prisma.quizQuestion.createMany({ data: qs.map((q, i) => ({ courseId: c.id, orderIndex: i, prompt: q.prompt, options: q.options, correctOptionIndex: q.correct, explanation: q.explanation })) });
    return c;
  };
  const safety = await mkCourse("Warehouse Safety Fundamentals", "Aisles, dock edge and manual lifting rules every Northside employee follows.", "Safety", 85, false, safetyLessons, safetyQs);
  const forklift = await mkCourse("Dock & Forklift Operations", "Daily inspection, load handling and incident response for powered industrial trucks.", "Equipment", 85, false, forkliftLessons, forkliftQs);
  const remedial = await mkCourse("Safety Retraining: Incident Review", "Assigned automatically after a written infraction. Pass mark is 90%.", "Safety", 90, true, remedialLessons, remedialQs);

  const roles = {
    picker: await prisma.jobRole.create({ data: { workspaceId: ws.id, title: "Picker / Packer", description: "Order picking and packing.", requiredCourseIds: [safety.id] } }),
    forklift: await prisma.jobRole.create({ data: { workspaceId: ws.id, title: "Forklift Operator", description: "Powered truck operation on dock and floor.", requiredCourseIds: [safety.id, forklift.id] } }),
    dispatcher: await prisma.jobRole.create({ data: { workspaceId: ws.id, title: "Dispatcher", description: "Route planning and driver communication.", requiredCourseIds: [safety.id] } }),
    desk: await prisma.jobRole.create({ data: { workspaceId: ws.id, title: "Front Desk Associate", description: "Visitor check-in, driver paperwork.", requiredCourseIds: [safety.id] } }),
    lead: await prisma.jobRole.create({ data: { workspaceId: ws.id, title: "Shift Lead", description: "Runs a shift and verifies checklists.", requiredCourseIds: [safety.id, forklift.id] } }),
  };

  const mkUser = async (name: string, email: string, role: Role) => {
    const user = await prisma.user.create({ data: { name, email, passwordHash: pw } });
    const member = await prisma.workspaceMember.create({ data: { workspaceId: ws.id, userId: user.id, role } });
    return { user, member };
  };
  const owner = await mkUser("Dana Whitfield", "dana@northside.example", "OWNER");
  const admin = await mkUser("Helen Okafor", "helen@northside.example", "ADMIN");
  const manager = await mkUser("Marcus Reyes", "marcus@northside.example", "MANAGER");
  const supervisor = await mkUser("Priya Nair", "priya@northside.example", "SUPERVISOR");
  const tomasU = await mkUser("Tomas Alvarez", "tomas@northside.example", "EMPLOYEE");

  type E = { code: string; name: string; email: string; dept: keyof typeof depts; role: keyof typeof roles; status: EmployeeStatus; readiness: Readiness; points: number; hire: string; member?: string; phone: string };
  const defs: E[] = [
    { code: "EMP-1001", name: "Marcus Reyes", email: "marcus@northside.example", dept: "wh", role: "lead", status: "ACTIVE", readiness: "CERTIFIED", points: 0, hire: "2022-03-14", member: manager.member.id, phone: "612-555-0142" },
    { code: "EMP-1002", name: "Priya Nair", email: "priya@northside.example", dept: "dp", role: "dispatcher", status: "ACTIVE", readiness: "CERTIFIED", points: 0, hire: "2023-01-09", member: supervisor.member.id, phone: "612-555-0177" },
    { code: "EMP-1003", name: "Tomas Alvarez", email: "tomas@northside.example", dept: "wh", role: "forklift", status: "ACTIVE", readiness: "PENDING", points: 1, hire: "2025-05-19", member: tomasU.member.id, phone: "612-555-0119" },
    { code: "EMP-1004", name: "Keisha Brooks", email: "keisha.brooks@northside.example", dept: "wh", role: "picker", status: "ACTIVE", readiness: "CERTIFIED", points: 0, hire: "2024-08-05", phone: "612-555-0163" },
    { code: "EMP-1005", name: "Devon Pruitt", email: "devon.pruitt@northside.example", dept: "wh", role: "picker", status: "ACTIVE", readiness: "RETRAINING_REQUIRED", points: 2, hire: "2025-02-24", phone: "612-555-0188" },
    { code: "EMP-1006", name: "Lena Hoffmann", email: "lena.hoffmann@northside.example", dept: "dp", role: "dispatcher", status: "ACTIVE", readiness: "CERTIFIED", points: 0, hire: "2024-11-11", phone: "612-555-0105" },
    { code: "EMP-1007", name: "Samir Haddad", email: "samir.haddad@northside.example", dept: "fd", role: "desk", status: "ACTIVE", readiness: "CERTIFIED", points: 0, hire: "2025-09-02", phone: "612-555-0131" },
    { code: "EMP-1008", name: "Rosa Delgado", email: "rosa.delgado@northside.example", dept: "wh", role: "picker", status: "ONBOARDING", readiness: "PENDING", points: 0, hire: "2026-11-09", phone: "612-555-0150" },
  ];
  const emp: Record<string, { id: string }> = {};
  for (const d of defs) {
    emp[d.code] = await prisma.employeeProfile.create({
      data: {
        workspaceId: ws.id, memberId: d.member ?? null, staffCode: d.code, fullName: d.name, email: d.email, phone: d.phone,
        emergencyContact: "Emergency contact on file", departmentId: depts[d.dept].id, jobRoleId: roles[d.role].id, status: d.status, readiness: d.readiness,
        strikePoints: d.points, hireDate: new Date(d.hire), shiftAvailability: { mon: "06:00-14:30", tue: "06:00-14:30", wed: "06:00-14:30", thu: "06:00-14:30", fri: "06:00-14:30" },
      },
    });
  }
  await prisma.department.update({ where: { id: depts.wh.id }, data: { managerMemberId: manager.member.id } });
  await prisma.department.update({ where: { id: depts.dp.id }, data: { managerMemberId: supervisor.member.id } });

  const enroll = (code: string, course: { id: string }, status: "ASSIGNED" | "IN_PROGRESS" | "PASSED" | "FAILED", score: number | null, cert: string | null, reason: string, attempts = 0) =>
    prisma.courseEnrollment.create({
      data: { workspaceId: ws.id, employeeId: emp[code].id, courseId: course.id, status, bestScore: score, attemptsCount: attempts, assignedReason: reason, certificateCode: cert, completedAt: status === "PASSED" ? new Date("2026-10-01") : null, lastAttemptAt: attempts ? new Date("2026-10-01") : null, dueDate: new Date(Date.now() + 10 * 86400000) },
    });
  const req = "Required for job role";
  await enroll("EMP-1001", safety, "PASSED", 100, "CERT-30418", req, 1);
  await enroll("EMP-1001", forklift, "PASSED", 100, "CERT-30419", req, 1);
  await enroll("EMP-1002", safety, "PASSED", 100, "CERT-30522", req, 1);
  await enroll("EMP-1003", safety, "PASSED", 90, "CERT-41207", req, 2);
  await enroll("EMP-1003", forklift, "IN_PROGRESS", null, null, req);
  await enroll("EMP-1004", safety, "PASSED", 100, "CERT-51881", req, 1);
  await enroll("EMP-1005", safety, "PASSED", 85, "CERT-52204", req, 1);
  await enroll("EMP-1005", remedial, "ASSIGNED", null, null, "Auto-assigned after INF-2026-001");
  await enroll("EMP-1006", safety, "PASSED", 95, "CERT-60733", req, 1);
  await enroll("EMP-1007", safety, "PASSED", 90, "CERT-61450", req, 1);
  await enroll("EMP-1008", safety, "ASSIGNED", null, null, "Required for job role (new hire)");

  // Infraction cases
  const c1 = await prisma.infractionCase.create({
    data: {
      workspaceId: ws.id, caseNumber: "INF-2026-001", employeeId: emp["EMP-1005"].id, issuedByMemberId: manager.member.id, severity: "WRITTEN_INFRACTION", pointsAdded: 2,
      policyViolated: "Safe Lifting & Aisle Traffic, Policy 4.2",
      summary: "On the 6 am shift Devon crossed the aisle 7 intersection with a loaded pallet jack without stopping at the blind corner. A lift truck braked within two feet. No injury, no damage.",
      evidenceUrls: ["https://example.com/northside/cctv/aisle7-2026-11-03.mp4"],
      confidentialManagerNotes: "Second near miss involving Devon this quarter (first was coached verbally, not documented). Dock lead says Devon is rushing to hit pick-rate targets. Review the target with HR before the next evaluation.",
      employeeAcknowledged: false, assignedRemedialCourseId: remedial.id, createdAt: new Date("2026-11-03T15:20:00Z"),
    },
  });
  await prisma.infractionTimelineEvent.createMany({
    data: [
      { caseId: c1.id, actorMemberId: manager.member.id, actorName: "Marcus Reyes", eventType: "CREATED", note: "WRITTEN INFRACTION issued for Safe Lifting & Aisle Traffic, Policy 4.2", createdAt: new Date("2026-11-03T15:20:00Z") },
      { caseId: c1.id, actorName: "System", eventType: "RETRAINING_TRIGGERED", note: "Remedial course assigned: Safety Retraining: Incident Review", createdAt: new Date("2026-11-03T15:20:01Z") },
      { caseId: c1.id, actorMemberId: manager.member.id, actorName: "Marcus Reyes", eventType: "NOTE_ADDED", note: "Reviewed the incident with Devon in person. Devon agreed the corner was blind and said they were behind on picks.", createdAt: new Date("2026-11-04T14:05:00Z") },
      { caseId: c1.id, actorMemberId: admin.member.id, actorName: "Helen Okafor", eventType: "NOTE_ADDED", note: "Pick-rate target for aisle 7 under review. Do not discuss with the employee until HR decides.", isConfidential: true, createdAt: new Date("2026-11-05T16:30:00Z") },
    ],
  });
  const c2 = await prisma.infractionCase.create({
    data: {
      workspaceId: ws.id, caseNumber: "INF-2026-002", employeeId: emp["EMP-1003"].id, issuedByMemberId: supervisor.member.id, severity: "VERBAL_WARNING", pointsAdded: 0,
      policyViolated: "Attendance, Policy 2.1", summary: "Tomas clocked in 18 minutes late on 10/27 without calling ahead. Second late arrival in 30 days. Coached on the call-ahead rule.",
      evidenceUrls: [], confidentialManagerNotes: "Tomas mentioned a childcare change. Offer shift swap options if it continues.", employeeAcknowledged: true,
      employeeSignatureName: "Tomas Alvarez", acknowledgedAt: new Date("2026-10-28T13:10:00Z"), createdAt: new Date("2026-10-27T14:40:00Z"),
    },
  });
  await prisma.infractionTimelineEvent.createMany({
    data: [
      { caseId: c2.id, actorMemberId: supervisor.member.id, actorName: "Priya Nair", eventType: "CREATED", note: "VERBAL WARNING issued for Attendance, Policy 2.1", createdAt: new Date("2026-10-27T14:40:00Z") },
      { caseId: c2.id, actorMemberId: tomasU.member.id, actorName: "Tomas Alvarez", eventType: "ACKNOWLEDGED", note: 'Signed as "Tomas Alvarez". Acknowledgment confirms receipt, not agreement.', createdAt: new Date("2026-10-28T13:10:00Z") },
    ],
  });
  await prisma.employeeProfile.update({ where: { id: emp["EMP-1003"].id }, data: { strikePoints: 1 } });

  // Checklists
  const items = (labels: [string, boolean][]) => labels.map(([label, required], i) => ({ id: `i${i + 1}`, label, required }));
  const t1 = await prisma.shiftChecklistTemplate.create({ data: { workspaceId: ws.id, departmentId: depts.wh.id, shiftType: "OPENING", title: "Warehouse opening walk-through", items: items([["Dock doors and plates inspected", true], ["Forklift daily inspection cards filled out", true], ["Emergency exits clear", true], ["Aisle 1–12 floors free of debris or spills", true], ["Eye wash station checked", false]]) } });
  const t2 = await prisma.shiftChecklistTemplate.create({ data: { workspaceId: ws.id, departmentId: depts.wh.id, shiftType: "CLOSING", title: "Warehouse closing", items: items([["Lift trucks parked and plugged in", true], ["Dock doors closed and locked", true], ["Trash and cardboard staged for pickup", false], ["Alarm armed", true]]) } });
  const t3 = await prisma.shiftChecklistTemplate.create({ data: { workspaceId: ws.id, departmentId: depts.dp.id, shiftType: "OPENING", title: "Dispatch board setup", items: items([["Driver roster confirmed against schedule", true], ["Overnight delays logged", true], ["Radios charged and tested", true]]) } });
  await prisma.shiftChecklistTemplate.create({ data: { workspaceId: ws.id, departmentId: depts.fd.id, shiftType: "OPENING", title: "Front desk opening", items: items([["Visitor log reset", true], ["Driver check-in tablet charged", true], ["Printer stocked with BOL forms", false]]) } });
  await prisma.shiftChecklistSubmission.create({ data: { workspaceId: ws.id, templateId: t1.id, completedByEmployeeId: emp["EMP-1004"].id, completedItems: ["i1", "i2", "i3", "i4", "i5"], handoffNotes: "Dock 4 plate sticks a little. Maintenance ticket opened.", submittedAt: new Date("2026-11-18T06:12:00Z"), verifiedByName: "Marcus Reyes", verifiedAt: new Date("2026-11-18T06:40:00Z") } });
  await prisma.shiftChecklistSubmission.create({ data: { workspaceId: ws.id, templateId: t2.id, completedByEmployeeId: emp["EMP-1003"].id, completedItems: ["i1", "i2", "i4"], handoffNotes: "Cardboard bin was full, left for morning crew.", submittedAt: new Date("2026-11-18T22:31:00Z") } });
  await prisma.shiftChecklistSubmission.create({ data: { workspaceId: ws.id, templateId: t3.id, completedByEmployeeId: emp["EMP-1006"].id, completedItems: ["i1", "i2", "i3"], handoffNotes: "Truck 12 two hours late due to weather on I-94.", submittedAt: new Date("2026-11-19T05:48:00Z") } });

  // Audit trail
  const log = (actor: { name: string; id: string } | null, actionType: string, targetType: string, targetId: string, summary: string) =>
    prisma.$transaction((tx) => writeAudit(tx, { workspaceId: ws.id, actorMemberId: actor?.id ?? null, actorName: actor?.name ?? "System", actionType, targetType, targetId, summary }));
  const dana = { name: "Dana Whitfield", id: owner.member.id };
  const marcus = { name: "Marcus Reyes", id: manager.member.id };
  const priya = { name: "Priya Nair", id: supervisor.member.id };
  await log(dana, "WORKSPACE_CREATED", "Workspace", ws.id, 'Workspace "Northside Supply & Logistics" created');
  await log(dana, "COURSE_CREATED", "Course", safety.id, 'Course "Warehouse Safety Fundamentals" created (3 lessons, 5 questions)');
  await log(dana, "COURSE_CREATED", "Course", forklift.id, 'Course "Dock & Forklift Operations" created (3 lessons, 5 questions)');
  await log(marcus, "EMPLOYEE_CREATED", "Employee", emp["EMP-1008"].id, "EMP-1008 Rosa Delgado added; 1 course(s) assigned");
  await log(marcus, "QUIZ_PASSED", "Employee", emp["EMP-1004"].id, 'EMP-1004 passed "Warehouse Safety Fundamentals" with 100% (CERT-51881)');
  await log(priya, "INFRACTION_ISSUED", "Employee", emp["EMP-1003"].id, "INF-2026-002: VERBAL WARNING for EMP-1003 (+0 pts, total 1)");
  await log(marcus, "INFRACTION_ISSUED", "Employee", emp["EMP-1005"].id, "INF-2026-001: WRITTEN INFRACTION for EMP-1005 (+2 pts, total 2) — readiness → RETRAINING_REQUIRED; remedial course assigned (Safety Retraining: Incident Review)");
  await log(marcus, "CHECKLIST_VERIFIED", "Checklist", t1.id, '"Warehouse opening walk-through" verified by Marcus Reyes');

  await addExtras(ws.id);
  console.log("Seeded Northside Supply & Logistics.");
  console.log(`Demo logins (password: ${DEMO_PASSWORD})`);
  console.log("  OWNER      dana@northside.example");
  console.log("  ADMIN      helen@northside.example");
  console.log("  MANAGER    marcus@northside.example");
  console.log("  SUPERVISOR priya@northside.example");
  console.log("  EMPLOYEE   tomas@northside.example");
  console.log("Staff console (/admin):");
  console.log("  STAFF OWNER   staff@onboardops.org");
  console.log("  STAFF SUPPORT support@onboardops.org");
}

async function addExtras(wsId: string) {
  if ((await prisma.policy.count({ where: { workspaceId: wsId } })) > 0) return;
  const emp = async (code: string) => prisma.employeeProfile.findFirstOrThrow({ where: { workspaceId: wsId, staffCode: code } });
  const mem = async (email: string) => prisma.workspaceMember.findFirstOrThrow({ where: { workspaceId: wsId, user: { email } }, include: { user: true } });
  const dana = await mem("dana@northside.example");
  const marcus = await mem("marcus@northside.example");
  const tomasM = await mem("tomas@northside.example");
  const [keisha, tomas, devon, rosa] = await Promise.all([emp("EMP-1004"), emp("EMP-1003"), emp("EMP-1005"), emp("EMP-1008")]);
  const day = 86400000;

  // Certificates that lapse, and due dates that trigger reminders
  const forklift = await prisma.course.findFirstOrThrow({ where: { workspaceId: wsId, title: "Dock & Forklift Operations" } });
  await prisma.course.update({ where: { id: forklift.id }, data: { validityDays: 365 } });
  await prisma.courseEnrollment.updateMany({ where: { courseId: forklift.id, status: "PASSED" }, data: { expiresAt: new Date(Date.now() + 20 * day) } });
  await prisma.courseEnrollment.updateMany({ where: { employeeId: tomas.id, courseId: forklift.id }, data: { dueDate: new Date(Date.now() - 3 * day) } });
  await prisma.courseEnrollment.updateMany({ where: { employeeId: devon.id, status: "ASSIGNED" }, data: { dueDate: new Date(Date.now() + 2 * day) } });

  // Policies
  const conduct = await prisma.policy.create({ data: { workspaceId: wsId, title: "Code of Conduct & Attendance", description: "How we show up, call out, and treat each other.", appliesToAll: true, isPublished: true, version: 1, contentMarkdown: "# Code of Conduct & Attendance\n\n## Attendance\n\n- Call your shift lead at least **one hour before** your start time if you cannot make it.\n- Three late arrivals in 30 days triggers a documented conversation.\n\n## Respect\n\nHarassment, discrimination and retaliation are not tolerated. Report concerns to your supervisor, a manager, or the owner.\n\n## Stop-work authority\n\nAnyone may stop a task they believe is unsafe. Good-faith reports are never grounds for discipline." } });
  const fk = await prisma.jobRole.findFirstOrThrow({ where: { workspaceId: wsId, title: "Forklift Operator" } });
  await prisma.policy.create({ data: { workspaceId: wsId, title: "Powered Industrial Truck Procedure", description: "Required reading for forklift operators.", appliesToAll: false, requiredJobRoleIds: [fk.id], isPublished: true, version: 1, contentMarkdown: "# Powered Industrial Truck Procedure\n\n1. Complete the daily inspection card before every shift.\n2. Horn at blind corners. Forks 4-6 inches off the floor while travelling.\n3. No passengers, ever.\n4. Report any incident before the end of your shift." } });
  await prisma.policyAcknowledgment.create({ data: { workspaceId: wsId, policyId: conduct.id, employeeId: keisha.id, version: 1, signatureName: keisha.fullName } });

  // Incident reports
  await prisma.incidentReport.createMany({ data: [
    { workspaceId: wsId, reporterEmployeeId: keisha.id, reportedByName: "Keisha Brooks", type: "NEAR_MISS", occurredAt: new Date(Date.now() - 2 * day), location: "Aisle 7 intersection", description: "A pallet jack rolled into the pedestrian lane when the operator stepped away. Nobody was nearby. Suggest a wheel lock reminder sign.", status: "NEW" },
    { workspaceId: wsId, reporterEmployeeId: tomas.id, reportedByName: "Tomas Alvarez", type: "SAFETY_HAZARD", occurredAt: new Date(Date.now() - 5 * day), location: "Dock 4", description: "The dock plate sticks when raised. It took two people to set it. Maintenance ticket is open but the dock is still in use.", status: "REVIEWING", reviewerNotes: "Marcus is checking with maintenance. Dock 4 limited to light loads until fixed." },
  ] });

  // Reviews and 1:1s
  await prisma.review.create({ data: { workspaceId: wsId, employeeId: keisha.id, authorName: marcus.user.name, authorMemberId: marcus.id, kind: "ONE_ON_ONE", periodLabel: "Nov 2026", rating: 4, summary: "Keisha is picking accurately and trains newer pickers without being asked.", strengths: "Accuracy, calm under pressure, reports near misses promptly.", improvements: "Pace on large multi-line orders.", goals: "Cross-train on dispatch board by January.", privateNotes: "Strong candidate for lead role in spring. Do not mention timing yet.", status: "SHARED", sharedAt: new Date(Date.now() - day) } });
  await prisma.review.create({ data: { workspaceId: wsId, employeeId: tomas.id, authorName: marcus.user.name, authorMemberId: marcus.id, kind: "REVIEW", periodLabel: "Q4 2026", rating: 3, summary: "Reliable on the floor. Attendance needs to stay consistent.", strengths: "Forklift handling, helps teammates.", improvements: "Call-ahead on late arrivals.", goals: "Pass the Dock & Forklift course by end of month.", privateNotes: "Childcare change mentioned. Offer shift swap options.", status: "DRAFT" } });

  // Notifications
  await prisma.notification.createMany({ data: [
    { workspaceId: wsId, memberId: dana.id, title: "New incident: near miss", body: "A pallet jack rolled into the pedestrian lane...", href: "/app/incidents" },
    { workspaceId: wsId, memberId: dana.id, title: "Rosa Delgado is onboarding", body: "1 required course assigned", href: "/app/directory" },
    { workspaceId: wsId, memberId: marcus.id, title: "New incident: safety hazard", body: "The dock plate sticks when raised...", href: "/app/incidents" },
    { workspaceId: wsId, memberId: tomasM.id, title: "Overdue: Dock & Forklift Operations", body: "is overdue", href: "/app/my-portal" },
    { workspaceId: wsId, memberId: tomasM.id, title: "Please sign: Code of Conduct & Attendance", body: "Version 1", href: "/app/my-portal" },
  ] });
  void rosa;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
