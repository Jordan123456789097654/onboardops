// Sets up the OnboardOps staff workspace: owner, departments, job roles, the two handbooks as policies, and staff checklists.
// Dry run by default. Nothing is written unless you pass --apply.
//   npx tsx scripts/seed-staff-workspace.mts            (shows what it would do)
//   npx tsx scripts/seed-staff-workspace.mts --apply    (does it, against whatever DATABASE_URL points at)
// Safe to re-run: it reuses the workspace and skips policies and checklists that already exist by title.
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
const unwrap = (m: any) => (m && m.default && !m.prisma ? m.default : m);
const { prisma } = unwrap(await import("../src/lib/prisma.ts"));
const { hashPassword } = unwrap(await import("../src/lib/auth.ts"));
const { STAFF_COURSES: BASE_COURSES } = await import("./staff-courses.mts");
const X = await import("./staff-extra.mts");
const STAFF_COURSES = [...BASE_COURSES, ...X.EXTRA_COURSES];

const OWNER_EMAIL = "jordanedanield13@gmail.com";
const OWNER_NAME = "Jordan Daniels";
const WS_NAME = "OnboardOps";
const WS_SLUG = "onboardops-staff";
const SUBDOMAIN = "staff";
const apply = process.argv.includes("--apply");
const host = (process.env.DATABASE_URL ?? "").replace(/^.*@/, "").replace(/[/?].*$/, "");
console.log(`${apply ? "APPLYING to" : "DRY RUN against"} database host: ${host || "(none)"}`);

const handbook = (f: string) => readFileSync(new URL(`../docs/handbooks/${f}`, import.meta.url), "utf8");
const policies = [
  ["Incident Response Handbook", "How we detect, run, communicate and learn from incidents.", "incident-response.md"],
  ["Support Handbook", "How we answer customers, verify identity, handle data and escalate.", "support.md"],
  ["Security and Access Handbook", "Accounts, passkeys, secrets, access levels, devices and phishing.", "security-access.md"],
  ["Data Protection and Privacy Handbook", "Customer data, requests from people and authorities, AI tools and providers.", "data-privacy.md"],
  ["Staff and Operations Handbook", "How we work, tools, change management, continuity, onboarding and offboarding.", "staff-operations.md"],
  ["Trust and Safety Handbook", "Abuse reports, moderation, suspensions, bans and appeals.", "trust-safety.md"],
].map(([title, description, f]) => ({ title, description, md: handbook(f) })).concat(X.EXTRA_POLICIES);
const item = (label: string, required = true) => ({ label, required });
const checklists: { title: string; shiftType: "OPENING" | "MID_SHIFT" | "CLOSING"; items: ReturnType<typeof item>[] }[] = [
  { title: "Incident: first 15 minutes", shiftType: "OPENING", items: [item("Acknowledge the alert and tell the other person"), item("Open the incident log and note the time"), item("Rate the severity (1 to 4)"), item("Assign lead, technical, comms and scribe"), item("Contain harm first if data may be exposed"), item("Post the holding message for SEV 1 or 2"), item("Set the next update time"), item("Check recent deploys, keys and DNS changes")] },
  { title: "Incident: closing", shiftType: "CLOSING", items: [item("Service verified: home, sign-in, workspace, email"), item("Monitoring green for 30 minutes"), item("Resolution message sent to customers"), item("Maintenance mode off"), item("Log complete with root cause draft"), item("Review booked within 3 working days")] },
  { title: "Support: daily inbox", shiftType: "OPENING", items: [item("Clear urgent and high tickets first"), item("Every ticket has an owner and a next step"), item("Check the email log for failed invites and resets"), item("Review overnight alerts"), item("Close tickets quiet for 3 days")] },
  { title: "Support: weekly review", shiftType: "CLOSING", items: [item("Review five tickets for quality and security"), item("List the top three causes of tickets"), item("Turn repeat questions into help articles"), item("Check open appeals and moderation cases"), item("Confirm sign-in and email alerts reach both of us", false)] },
  { title: "Quarterly: readiness", shiftType: "CLOSING", items: [item("Tabletop drill of one playbook"), item("Test a database restore to a branch"), item("Test a deployment rollback"), item("Confirm vendor logins and recovery codes work"), item("Update contacts and roles in the handbooks")] },
];
checklists.push(...X.EXTRA_CHECKLISTS);
// 0 = Sunday. Monthly and quarterly checklists cannot be scheduled in the product, so those are started by hand.
const SCHEDULE: Record<string, { scheduleDays: number[]; dueTime: string }> = {
  "Support: daily inbox": { scheduleDays: [1, 2, 3, 4, 5], dueTime: "10:00" },
  "Support: weekly review": { scheduleDays: [5], dueTime: "16:00" },
};
const departments = ["Leadership", "Support", "Operations", ...X.EXTRA_DEPARTMENTS];
const roles: { title: string; description: string; courses: string[] }[] = [
  { title: "Founder and Incident Lead", description: "Owns the product, leads incident response, decides on security and legal matters.", courses: ["Incident Response Fundamentals", "Incident Commander Certification", "Security and Access Basics", "Data Protection and Privacy"] },
  { title: "COO and Support Lead", description: "Leads support and operations, deputy incident lead and communications lead.", courses: ["Incident Response Fundamentals", "Incident Commander Certification", "Support Excellence", "Security and Access Basics", "Data Protection and Privacy"] },
];

roles.push(...X.EXTRA_ROLES);
console.log(`Owner: ${OWNER_EMAIL}\nWorkspace: ${WS_NAME} (${WS_SLUG}), address ${SUBDOMAIN}.onboardops.org`);
console.log(`Policies: ${policies.map((p) => `${p.title} (${p.md.length} chars)`).join("; ")}`);
console.log(`Courses (each issues a certificate): ${STAFF_COURSES.map((c: any) => `${c.title} [${c.validityDays}d]`).join("; ")}`);
console.log(`Checklists: ${checklists.length}, departments: ${departments.length}, roles: ${roles.length}`);
if (!apply) { console.log("\nDry run only. Re-run with --apply to write."); process.exit(0); }

let user = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
const created = !user;
if (!user) user = await prisma.user.create({ data: { email: OWNER_EMAIL, name: OWNER_NAME, passwordHash: await hashPassword(randomBytes(24).toString("base64url")), emailVerifiedAt: new Date() } });
let ws = await prisma.workspace.findUnique({ where: { slug: WS_SLUG } });
if (!ws) ws = await prisma.workspace.create({ data: { name: WS_NAME, slug: WS_SLUG } });
const member = (await prisma.workspaceMember.findFirst({ where: { workspaceId: ws.id, userId: user.id } })) ?? (await prisma.workspaceMember.create({ data: { workspaceId: ws.id, userId: user.id, role: "OWNER" } }));

const have = async (m: "policy" | "shiftChecklistTemplate", title: string) => !!(await prisma[m].findFirst({ where: { workspaceId: ws.id, title } }));
for (const p of policies) if (!(await have("policy", p.title))) await prisma.policy.create({ data: { workspaceId: ws.id, title: p.title, description: p.description, contentMarkdown: p.md, appliesToAll: true, isPublished: true, reackDays: 365 } });
for (const c of checklists) if (!(await have("shiftChecklistTemplate", c.title))) await prisma.shiftChecklistTemplate.create({ data: { workspaceId: ws.id, title: c.title, shiftType: c.shiftType, items: c.items.map((x, i) => ({ id: `i${i + 1}`, ...x })), ...(SCHEDULE[c.title] ?? {}) } });
for (const name of departments) if (!(await prisma.department.findFirst({ where: { workspaceId: ws.id, name } }))) await prisma.department.create({ data: { workspaceId: ws.id, name } });
const courseIds = new Map<string, string>();
for (const c of STAFF_COURSES as any[]) {
  let course = await prisma.course.findFirst({ where: { workspaceId: ws.id, title: c.title } });
  if (!course) {
    course = await prisma.course.create({ data: { workspaceId: ws.id, title: c.title, description: c.description, category: c.category, passingScore: c.passingScore, validityDays: c.validityDays, isPublished: true } });
    await prisma.courseLesson.createMany({ data: c.lessons.map((l: any, i: number) => ({ courseId: course.id, orderIndex: i, title: l.title, contentMarkdown: l.md, minReadSeconds: l.secs })) });
    await prisma.quizQuestion.createMany({ data: c.questions.map((x: any, i: number) => ({ courseId: course.id, orderIndex: i, prompt: x.prompt, options: x.options, correctOptionIndex: x.correct, explanation: x.explanation })) });
  }
  courseIds.set(c.title, course.id);
}
for (const c of STAFF_COURSES as any[]) if (c.prerequisiteTitles?.length) await prisma.course.update({ where: { id: courseIds.get(c.title)! }, data: { prerequisiteIds: c.prerequisiteTitles.map((t: string) => courseIds.get(t)).filter(Boolean) } });
const required = (...t: string[]) => t.map((x) => courseIds.get(x)).filter(Boolean);
for (const r of roles) if (!(await prisma.jobRole.findFirst({ where: { workspaceId: ws.id, title: r.title } }))) await prisma.jobRole.create({ data: { workspaceId: ws.id, title: r.title, description: r.description, requiredCourseIds: required(...r.courses) } });

// "staff" is a reserved name in the product, so this writes the address directly. DNS and the hosting domain still need adding by hand.
const clash = await prisma.workspace.findFirst({ where: { subdomain: SUBDOMAIN, id: { not: ws.id } } });
if (!clash) await prisma.workspace.update({ where: { id: ws.id }, data: { subdomain: SUBDOMAIN, subdomainStatus: "PENDING" } });
console.log(`\nDone. Workspace ${ws.id}. Owner ${created ? "created (no password set; use the sign-in link or Forgot password)" : "already existed and is attached"}. Member ${member.id}.`);
console.log(clash ? "Address NOT set: another workspace already uses it." : `Address ${SUBDOMAIN}.onboardops.org saved as PENDING. Add the DNS record and the Vercel domain to finish.`);
await prisma.$disconnect();
