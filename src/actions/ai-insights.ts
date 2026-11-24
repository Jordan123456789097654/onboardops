"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ALL_ROLES, requirePerm, requireWorkspaceRole } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { TASKS, type DataQueryId } from "@/lib/ai/tasks";
import { runTask } from "@/lib/ai/run";
import { guardAi } from "@/lib/ai/guard";
import { AiError } from "@/lib/ai/groq";
import { redact } from "@/lib/ai/redact";
import { run } from "./_util";

type Ctx = Awaited<ReturnType<typeof requireWorkspaceRole>>;

/** Runs a task whose input was built here on the server (never taken from the browser), then counts and audit-logs the use without the text. */
async function runTrusted<O>(ctx: Ctx, taskId: string, payload: unknown): Promise<O> {
  const def = TASKS[taskId];
  await guardAi(ctx.workspace, ctx.userId, def.risk);
  let out;
  try {
    out = await runTask(def, payload);
  } catch (e) {
    if (e instanceof AiError) throw new Error(e.message);
    throw e;
  }
  const month = new Date().toISOString().slice(0, 7);
  await prisma.$transaction(async (tx) => {
    await tx.aiUsage.upsert({
      where: { workspaceId_month_feature: { workspaceId: ctx.workspaceId, month, feature: def.id } },
      create: { workspaceId: ctx.workspaceId, month, feature: def.id, requests: 1, inputTokens: out.usage.input, outputTokens: out.usage.output },
      update: { requests: { increment: 1 }, inputTokens: { increment: out.usage.input }, outputTokens: { increment: out.usage.output } },
    });
    await writeAudit(tx, {
      workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "AI_USED", targetType: "Workspace", targetId: ctx.workspaceId,
      summary: `Used AI: ${def.label}`, metadata: { task: def.id, inputChars: out.inChars, outputChars: out.outChars, redacted: false },
    });
  });
  return out.output as O;
}

const DAY = 86400000;
const ymd = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
const who = (e: { fullName: string; staffCode: string }) => `${e.fullName} (${e.staffCode})`;

/* ---------------- Ask your data ---------------- */

export type DataAnswer =
  | { kind: "none"; note: string }
  | { kind: "table"; title: string; note: string; columns: string[]; rows: string[][]; total: number };

const MAX_ROWS = 100;

/** The ready-made reports. Each is read-only and limited to this workspace's active staff. */
async function runDataQuery(ctx: Ctx, query: DataQueryId, days: number): Promise<{ title: string; columns: string[]; rows: string[][]; total: number }> {
  const w = ctx.workspaceId;
  const now = new Date();
  const active = { status: { not: "TERMINATED" as const } };
  const out = (title: string, columns: string[], all: string[][]) => ({ title, columns, rows: all.slice(0, MAX_ROWS), total: all.length });

  switch (query) {
    case "overdue_training": {
      const rows = await prisma.courseEnrollment.findMany({ where: { workspaceId: w, status: { not: "PASSED" }, dueDate: { lt: now }, employee: active, course: { isPublished: true } }, include: { employee: true, course: true }, orderBy: { dueDate: "asc" }, take: 300 });
      return out("Training past its due date", ["Employee", "Course", "Was due", "Days late"], rows.map((e) => [who(e.employee), e.course.title, ymd(e.dueDate), String(Math.floor((now.getTime() - e.dueDate!.getTime()) / DAY))]));
    }
    case "training_due_soon": {
      const rows = await prisma.courseEnrollment.findMany({ where: { workspaceId: w, status: { not: "PASSED" }, dueDate: { gte: now, lte: new Date(now.getTime() + days * DAY) }, employee: active, course: { isPublished: true } }, include: { employee: true, course: true }, orderBy: { dueDate: "asc" }, take: 300 });
      return out(`Training due in the next ${days} days`, ["Employee", "Course", "Due", "Status"], rows.map((e) => [who(e.employee), e.course.title, ymd(e.dueDate), e.status]));
    }
    case "expiring_certificates": {
      const rows = await prisma.courseEnrollment.findMany({ where: { workspaceId: w, status: "PASSED", expiresAt: { gt: now, lte: new Date(now.getTime() + days * DAY) }, employee: active }, include: { employee: true, course: true }, orderBy: { expiresAt: "asc" }, take: 300 });
      return out(`Training certificates expiring in ${days} days`, ["Employee", "Course", "Expires"], rows.map((e) => [who(e.employee), e.course.title, ymd(e.expiresAt)]));
    }
    case "expiring_credentials": {
      const rows = await prisma.credential.findMany({ where: { workspaceId: w, expiresAt: { gt: now, lte: new Date(now.getTime() + days * DAY) }, employee: active }, include: { employee: true }, orderBy: { expiresAt: "asc" }, take: 300 });
      return out(`Credentials expiring in ${days} days`, ["Employee", "Credential", "Issuer", "Expires"], rows.map((c) => [who(c.employee), c.name, c.issuer, ymd(c.expiresAt)]));
    }
    case "expired_credentials": {
      const rows = await prisma.credential.findMany({ where: { workspaceId: w, expiresAt: { lt: now }, employee: active }, include: { employee: true }, orderBy: { expiresAt: "desc" }, take: 300 });
      return out("Credentials that have expired", ["Employee", "Credential", "Issuer", "Expired"], rows.map((c) => [who(c.employee), c.name, c.issuer, ymd(c.expiresAt)]));
    }
    case "new_hires_progress": {
      const rows = await prisma.employeeProfile.findMany({ where: { workspaceId: w, status: "ONBOARDING" }, include: { enrollments: { where: { course: { isPublished: true } }, select: { status: true } } }, orderBy: { hireDate: "desc" }, take: 300 });
      return out("New hires and their training progress", ["Employee", "Hired", "Courses passed"], rows.map((e) => [who(e), ymd(e.hireDate), `${e.enrollments.filter((x) => x.status === "PASSED").length} of ${e.enrollments.length}`]));
    }
    case "staff_without_training": {
      const rows = await prisma.employeeProfile.findMany({ where: { workspaceId: w, status: "ACTIVE", enrollments: { none: {} } }, orderBy: { fullName: "asc" }, take: 300 });
      return out("Active staff with no courses assigned", ["Employee", "Hired"], rows.map((e) => [who(e), ymd(e.hireDate)]));
    }
    case "failed_quizzes": {
      const rows = await prisma.courseEnrollment.findMany({ where: { workspaceId: w, status: "FAILED", lastAttemptAt: { gte: new Date(now.getTime() - days * DAY) }, employee: active }, include: { employee: true, course: true }, orderBy: { lastAttemptAt: "desc" }, take: 300 });
      return out(`Quizzes failed in the last ${days} days`, ["Employee", "Course", "Best score", "Last try"], rows.map((e) => [who(e.employee), e.course.title, e.bestScore === null ? "" : `${e.bestScore}%`, ymd(e.lastAttemptAt)]));
    }
    case "incidents_by_type": {
      const rows = await prisma.incidentReport.groupBy({ by: ["type"], where: { workspaceId: w, createdAt: { gte: new Date(now.getTime() - days * DAY) } }, _count: { _all: true }, orderBy: { _count: { type: "desc" } } });
      return out(`Incident reports in the last ${days} days`, ["Type", "Reports"], rows.map((r) => [r.type, String(r._count._all)]));
    }
    case "headcount_by_department": {
      const [groups, depts] = await Promise.all([
        prisma.employeeProfile.groupBy({ by: ["departmentId"], where: { workspaceId: w, status: { not: "TERMINATED" } }, _count: { _all: true } }),
        prisma.department.findMany({ where: { workspaceId: w }, select: { id: true, name: true } }),
      ]);
      const name = new Map(depts.map((d) => [d.id, d.name]));
      return out("People by department", ["Department", "People"], groups.map((g) => [g.departmentId ? name.get(g.departmentId) ?? "Unknown" : "No department", String(g._count._all)]).sort((a, b) => Number(b[1]) - Number(a[1])));
    }
  }
}

/** A manager asks a plain question. AI only picks which ready-made report fits; our code runs it with the manager's own access. */
export async function askDataAction(input: unknown) {
  return run(async (): Promise<DataAnswer> => {
    const d = z.object({ question: z.string().trim().min(3, "Ask a question").max(300) }).parse(input);
    const ctx = await requirePerm("reports.view");
    const names = (await prisma.employeeProfile.findMany({ where: { workspaceId: ctx.workspaceId }, select: { fullName: true }, take: 500 })).map((e) => e.fullName);
    const plan = await runTrusted<{ query: DataQueryId | "none"; days: number; note: string }>(ctx, "data.plan", { question: redact(d.question, names).text });
    if (plan.query === "none") return { kind: "none", note: plan.note || "Try asking about overdue training, expiring credentials, new hires, failed quizzes or headcount." };
    const result = await runDataQuery(ctx, plan.query, plan.days);
    return { kind: "table", note: plan.note, ...result };
  });
}

/* ---------------- Quiz insight ---------------- */

export type QuizInsightResult = {
  stats: { attempts: number; passRate: number };
  ai: { headline: string; weakSpots: { prompt: string; why: string }[]; coachingTopics: string[]; lessonFixes: string[] };
};

export async function quizInsightAction(courseId: string) {
  return run(async (): Promise<QuizInsightResult> => {
    const ctx = await requirePerm("training.build");
    const course = await prisma.course.findFirst({ where: { id: z.string().max(64).parse(courseId), workspaceId: ctx.workspaceId }, select: { title: true } });
    if (!course) throw new Error("Course not found.");
    const [attempts, answers] = await Promise.all([
      prisma.quizAttempt.findMany({ where: { workspaceId: ctx.workspaceId, courseId, submittedAt: { not: null } }, select: { passed: true }, take: 20000 }),
      prisma.quizAnswer.findMany({ where: { workspaceId: ctx.workspaceId, courseId }, orderBy: { createdAt: "asc" }, take: 50000 }),
    ]);
    if (attempts.length === 0 || answers.length === 0) throw new Error("There are no graded attempts for this course yet.");
    const map = new Map<string, { prompt: string; options: string[]; correctIndex: number; total: number; correct: number; picks: number[] }>();
    for (const a of answers) {
      const opts = Array.isArray(a.options) ? (a.options as string[]) : [];
      const row = map.get(a.questionId) ?? { prompt: a.prompt, options: opts, correctIndex: a.correctIndex, total: 0, correct: 0, picks: [0, 0, 0, 0] };
      row.prompt = a.prompt; row.options = opts; row.correctIndex = a.correctIndex;
      row.total++;
      if (a.correct) row.correct++;
      if (a.chosenIndex >= 0 && a.chosenIndex < 4) row.picks[a.chosenIndex]++;
      map.set(a.questionId, row);
    }
    const questions = [...map.values()]
      .sort((x, y) => x.correct / x.total - y.correct / y.total)
      .slice(0, 15)
      .map((r) => {
        const wrong = r.picks.map((n, i) => ({ n, i })).filter((x) => x.i !== r.correctIndex && x.n > 0).sort((p, q) => q.n - p.n)[0];
        return { prompt: r.prompt, pctCorrect: Math.round((r.correct / r.total) * 100), answers: r.total, commonWrong: wrong ? r.options[wrong.i] : undefined };
      });
    const passRate = Math.round((attempts.filter((a) => a.passed).length / attempts.length) * 100);
    const ai = await runTrusted<QuizInsightResult["ai"]>(ctx, "quiz.insight", { courseTitle: course.title, attempts: attempts.length, passRate, questions });
    return { stats: { attempts: attempts.length, passRate }, ai };
  });
}

/* ---------------- Huddle agenda ---------------- */

export type HuddleResult = { facts: Record<string, number | Record<string, number>>; ai: { title: string; items: { topic: string; minutes: number; points: string[] }[] } };

export async function huddleAgendaAction(input: unknown) {
  return run(async (): Promise<HuddleResult> => {
    const d = z.object({ minutes: z.coerce.number().int().min(5).max(30).default(10), focus: z.string().trim().max(200).optional() }).parse(input);
    const ctx = await requirePerm("reports.view");
    const w = ctx.workspaceId;
    const now = new Date();
    const active = { status: { not: "TERMINATED" as const } };
    const [overdue, dueWeek, certs, creds, expired, onboarding, failed, incidents, headcount] = await Promise.all([
      prisma.courseEnrollment.count({ where: { workspaceId: w, status: { not: "PASSED" }, dueDate: { lt: now }, employee: active, course: { isPublished: true } } }),
      prisma.courseEnrollment.count({ where: { workspaceId: w, status: { not: "PASSED" }, dueDate: { gte: now, lte: new Date(now.getTime() + 7 * DAY) }, employee: active, course: { isPublished: true } } }),
      prisma.courseEnrollment.count({ where: { workspaceId: w, status: "PASSED", expiresAt: { gt: now, lte: new Date(now.getTime() + 30 * DAY) }, employee: active } }),
      prisma.credential.count({ where: { workspaceId: w, expiresAt: { gt: now, lte: new Date(now.getTime() + 30 * DAY) }, employee: active } }),
      prisma.credential.count({ where: { workspaceId: w, expiresAt: { lt: now }, employee: active } }),
      prisma.employeeProfile.count({ where: { workspaceId: w, status: "ONBOARDING" } }),
      prisma.courseEnrollment.count({ where: { workspaceId: w, status: "FAILED", lastAttemptAt: { gte: new Date(now.getTime() - 14 * DAY) }, employee: active } }),
      prisma.incidentReport.groupBy({ by: ["type"], where: { workspaceId: w, createdAt: { gte: new Date(now.getTime() - 14 * DAY) } }, _count: { _all: true } }),
      prisma.employeeProfile.count({ where: { workspaceId: w, status: { not: "TERMINATED" } } }),
    ]);
    const facts = {
      activeStaff: headcount,
      trainingOverdue: overdue,
      trainingDueInNext7Days: dueWeek,
      certificatesExpiringIn30Days: certs,
      credentialsExpiringIn30Days: creds,
      credentialsAlreadyExpired: expired,
      newHiresStillOnboarding: onboarding,
      quizzesFailedInLast14Days: failed,
      incidentReportsInLast14Days: Object.fromEntries(incidents.map((i) => [i.type, i._count._all])) as Record<string, number>,
    };
    const ai = await runTrusted<HuddleResult["ai"]>(ctx, "huddle.agenda", { minutes: d.minutes, focus: d.focus, facts });
    return { facts, ai };
  });
}

/* ---------------- Employee helpers ---------------- */

const STOP = new Set(["the", "and", "for", "with", "that", "this", "what", "how", "does", "can", "you", "your", "our", "are", "will", "when", "where", "who", "why", "not", "but", "use", "have", "should", "need", "much", "many", "get", "its", "from"]);
const tokens = (s: string) => Array.from(new Set(s.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((w) => w.length >= 3 && !STOP.has(w))));

export type PolicyAnswer = { found: boolean; answer: string; sources: { id: string; title: string }[] };

/** An employee asks about the policies they're expected to follow. Answers come only from published policy text that applies to them. */
export async function askPolicyAction(input: unknown) {
  return run(async (): Promise<PolicyAnswer> => {
    const d = z.object({ question: z.string().trim().min(3, "Ask a question").max(300) }).parse(input);
    const ctx = await requireWorkspaceRole(ALL_ROLES);
    const p = ctx.profile;
    const policies = await prisma.policy.findMany({
      where: { workspaceId: ctx.workspaceId, isPublished: true, ...(p ? { OR: [{ appliesToAll: true }, ...(p.jobRoleId ? [{ requiredJobRoleIds: { has: p.jobRoleId } }] : [])] } : {}) },
      select: { id: true, title: true, description: true, contentMarkdown: true },
      take: 200,
    });
    const toks = tokens(d.question);
    const ranked = policies
      .map((x) => {
        const title = x.title.toLowerCase(), body = `${x.description}\n${x.contentMarkdown}`.toLowerCase();
        let score = 0;
        for (const t of toks) { if (title.includes(t)) score += 5; if (body.includes(t)) score += 1; }
        return { x, score };
      })
      .filter((r) => r.score > 0 && (r.x.description + r.x.contentMarkdown).trim().length > 20)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((r) => ({ id: r.x.id, title: r.x.title, text: `${r.x.description}\n${r.x.contentMarkdown}`.trim().slice(0, 2800) }));
    if (ranked.length === 0) return { found: false, answer: "I couldn't find anything about that in the policies you have. Please ask your manager.", sources: [] };
    const out = await runTrusted<{ found: boolean; answer: string; sourceIds: string[] }>(ctx, "policy.ask", { question: d.question, passages: ranked });
    const byId = new Map(ranked.map((r) => [r.id, r.title]));
    return { found: out.found, answer: out.answer, sources: out.sourceIds.filter((i) => byId.has(i)).map((id) => ({ id, title: byId.get(id)! })) };
  });
}

export async function lessonTutorAction(input: unknown) {
  return run(async (): Promise<{ answer: string; example: string }> => {
    const d = z.object({ courseId: z.string().max(64), question: z.string().trim().min(3, "Ask a question").max(400) }).parse(input);
    const ctx = await requireWorkspaceRole(ALL_ROLES);
    const course = await prisma.course.findFirst({ where: { id: d.courseId, workspaceId: ctx.workspaceId }, include: { lessons: { orderBy: { orderIndex: "asc" } } } });
    if (!course) throw new Error("Course not found.");
    if (ctx.role === "EMPLOYEE") {
      const enrolled = ctx.profile ? await prisma.courseEnrollment.findFirst({ where: { employeeId: ctx.profile.id, courseId: course.id }, select: { id: true } }) : null;
      if (!enrolled || !course.isPublished) throw new Error("Course not found.");
    }
    const lessons = course.lessons.map((l, i) => `Lesson ${i + 1}: ${l.title}\n${l.contentMarkdown}`).join("\n\n").slice(0, 14000);
    return runTrusted(ctx, "lesson.tutor", { courseTitle: course.title, lessons, question: d.question });
  });
}

export async function weekSummaryAction() {
  return run(async (): Promise<{ summary: string; todo: string[] }> => {
    const ctx = await requireWorkspaceRole(ALL_ROLES);
    const p = ctx.profile;
    if (!p) throw new Error("No employee profile is linked to your login.");
    const tz = ctx.workspace.timezone || "America/New_York";
    const now = new Date();
    const when = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);
    const day = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(d);
    const [shifts, due, creds, policies, acks] = await Promise.all([
      prisma.shift.findMany({ where: { workspaceId: ctx.workspaceId, employeeId: p.id, endsAt: { gt: now }, startsAt: { lt: new Date(now.getTime() + 7 * DAY) } }, orderBy: { startsAt: "asc" }, take: 14 }),
      prisma.courseEnrollment.findMany({ where: { workspaceId: ctx.workspaceId, employeeId: p.id, status: { not: "PASSED" }, course: { isPublished: true }, dueDate: { lte: new Date(now.getTime() + 14 * DAY) } }, include: { course: true }, orderBy: { dueDate: "asc" }, take: 8 }),
      prisma.credential.findMany({ where: { workspaceId: ctx.workspaceId, employeeId: p.id, expiresAt: { not: null, lte: new Date(now.getTime() + 30 * DAY) } }, orderBy: { expiresAt: "asc" }, take: 5 }),
      prisma.policy.findMany({ where: { workspaceId: ctx.workspaceId, isPublished: true, OR: [{ appliesToAll: true }, ...(p.jobRoleId ? [{ requiredJobRoleIds: { has: p.jobRoleId } }] : [])] }, select: { id: true, title: true, version: true } }),
      prisma.policyAcknowledgment.findMany({ where: { employeeId: p.id }, select: { policyId: true, version: true } }),
    ]);
    const unsigned = policies.filter((x) => !acks.some((a) => a.policyId === x.id && a.version === x.version));
    const facts = {
      today: day(now),
      shiftsInNext7Days: shifts.map((s) => ({ label: s.label || "Shift", start: when(s.startsAt), end: when(s.endsAt) })),
      trainingToFinish: due.map((e) => ({ course: e.course.title, due: e.dueDate ? day(e.dueDate) : "no due date", overdue: !!e.dueDate && e.dueDate < now })),
      credentialsExpiringSoon: creds.map((c) => ({ name: c.name, expires: day(c.expiresAt!), alreadyExpired: c.expiresAt! < now })),
      policiesWaitingForMySignature: unsigned.map((x) => x.title).slice(0, 5),
    };
    return runTrusted(ctx, "week.summary", { facts });
  });
}
