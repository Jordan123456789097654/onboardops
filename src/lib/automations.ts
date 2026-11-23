import type { Prisma, Severity } from "@prisma/client";
import { randomInt } from "crypto";
import { prisma } from "./prisma";
import { writeAudit } from "./audit";
import { sendEmbed, COLORS, type Embed } from "./webhooks";
import { sendEmail, emails } from "./email";
import { sendGenericWebhook } from "./generic-webhook";
import type { Ctx } from "./rbac";
import { getStrikeDecayDays } from "./workspace-meta";
import { notifyEmployee, notifyRoles } from "./notify";
import { pickQuiz, unmetPrerequisites } from "./course-rules";

type Tx = Prisma.TransactionClient;

/** Side effects collected inside a transaction and dispatched only after it commits. */
export type Effects = {
  ops: Embed[];
  confidential: Embed[];
  mail: { to: string; subject: string; text: string; html?: string }[];
};
export const newEffects = (): Effects => ({ ops: [], confidential: [], mail: [] });

export async function dispatchEffects(ctx: Ctx, fx: Effects) {
  const failures: string[] = [];
  for (const e of fx.ops) {
    const r = await sendEmbed(ctx.workspace.operationsWebhookUrl, e);
    if (!r.ok && ctx.workspace.operationsWebhookUrl) failures.push(`operations webhook: ${r.error}`);
  }
  for (const e of fx.confidential) {
    const r = await sendEmbed(ctx.workspace.confidentialWebhookUrl, e);
    if (!r.ok && ctx.workspace.confidentialWebhookUrl) failures.push(`confidential webhook: ${r.error}`);
  }
  if (ctx.workspace.genericWebhookUrl) {
    for (const [channel, list] of [["operations", fx.ops], ["confidential", fx.confidential]] as const) {
      for (const e of list) {
        const r = await sendGenericWebhook(ctx.workspace.genericWebhookUrl, ctx.workspace.genericWebhookSecret, "notification", { channel, title: e.title, description: e.description ?? null, fields: e.fields ?? [] });
        if (!r.ok) failures.push(`json webhook: ${r.error}`);
      }
    }
  }
  for (const m of fx.mail) {
    const r = await sendEmail(m.to, m.subject, m.text, { html: m.html, workspaceId: ctx.workspaceId, workspaceName: ctx.workspace.name });
    if (!r.ok && process.env.RESEND_API_KEY) failures.push(`email to ${m.to}: ${r.error}`);
  }
  if (failures.length) {
    await prisma.$transaction((tx) =>
      writeAudit(tx, {
        workspaceId: ctx.workspaceId,
        actorMemberId: ctx.id,
        actorName: ctx.user.name,
        actionType: "NOTIFY_FAILED",
        targetType: "Workspace",
        targetId: ctx.workspaceId,
        summary: `Notification delivery failed (${failures.length})`,
        metadata: { failures },
      })
    );
  }
}

export async function nextStaffCode(tx: Tx, workspaceId: string) {
  const all = await tx.employeeProfile.findMany({ where: { workspaceId }, select: { staffCode: true } });
  const max = all.reduce((m, e) => Math.max(m, parseInt(e.staffCode.replace(/\D/g, ""), 10) || 1000), 1000);
  return `EMP-${max + 1}`;
}

async function nextCaseNumber(tx: Tx, workspaceId: string) {
  const year = new Date().getUTCFullYear();
  const prefix = `INF-${year}-`;
  const existing = await tx.infractionCase.findMany({ where: { workspaceId, caseNumber: { startsWith: prefix } }, select: { caseNumber: true } });
  const max = existing.reduce((m, c) => Math.max(m, parseInt(c.caseNumber.slice(prefix.length), 10) || 0), 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

/** Automation 1: hire / role change -> enrollments for every required course, readiness = PENDING. */
export async function assignRoleCourses(
  tx: Tx,
  p: { workspaceId: string; employeeId: string; jobRoleId: string | null; reason: string; fx: Effects; employeeName: string; employeeEmail: string; workspaceName: string; isHire: boolean }
) {
  if (!p.jobRoleId) return [];
  const role = await tx.jobRole.findFirst({ where: { id: p.jobRoleId, workspaceId: p.workspaceId } });
  if (!role) return [];
  const courses = await tx.course.findMany({ where: { id: { in: role.requiredCourseIds }, workspaceId: p.workspaceId } });
  const have = await tx.courseEnrollment.findMany({ where: { employeeId: p.employeeId }, select: { courseId: true } });
  const haveIds = new Set(have.map((h) => h.courseId));
  const fresh = courses.filter((c) => !haveIds.has(c.id));
  for (const c of fresh) {
    await tx.courseEnrollment.create({
      data: { workspaceId: p.workspaceId, employeeId: p.employeeId, courseId: c.id, assignedReason: p.reason, dueDate: new Date(Date.now() + c.defaultDueDays * 86400000) },
    });
    await notifyEmployee(tx, p.workspaceId, p.employeeId, { title: `New training: ${c.title}`, body: p.reason, href: `/app/training/course/${c.id}` });
  }
  if (courses.length) {
    const passed = await tx.courseEnrollment.count({ where: { employeeId: p.employeeId, courseId: { in: courses.map((c) => c.id) }, status: "PASSED" } });
    if (passed < courses.length) await tx.employeeProfile.update({ where: { id: p.employeeId }, data: { readiness: "PENDING" } });
  }
  if (fresh.length) {
    if (p.isHire) {
      const m = emails.welcome(p.employeeName, p.workspaceName, fresh.map((c) => c.title));
      p.fx.mail.push({ to: p.employeeEmail, ...m });
    } else {
      for (const c of fresh) p.fx.mail.push({ to: p.employeeEmail, ...emails.courseAssigned(p.employeeName, c.title, p.reason) });
    }
  }
  return fresh.map((c) => c.title);
}

export type QuizQuestionOut = { id: string; prompt: string; /** i is the option's original index. Only that number is sent back with an answer. */ options: { i: number; text: string }[] };
export type QuizResult = { score: number; passed: boolean; correct: number; total: number; certificateCode?: string; cooldownUntil?: string; review: { questionId: string; prompt: string; chosen: number; correctIndex: number; explanation: string }[] };

function cooldownMessage(until: Date, minutes: number) {
  return `Retake available after ${until.toISOString().slice(11, 16)}Z (${minutes} minute cooldown).`;
}

/**
 * Starts (or resumes) a quiz sitting. The server chooses the questions (a random bank pick if the course uses one) and the option
 * order, remembers that choice, and only ever sends the prompts and options. Correct answers never leave the server.
 */
export async function startQuizAttempt(ctx: Ctx, employeeId: string, courseId: string): Promise<{ attemptId: string; questions: QuizQuestionOut[] }> {
  return prisma.$transaction(async (tx) => {
    const enrollment = await tx.courseEnrollment.findFirst({
      where: { employeeId, courseId, workspaceId: ctx.workspaceId },
      include: { course: { include: { questions: { orderBy: { orderIndex: "asc" } } } }, employee: true },
    });
    if (!enrollment) throw new Error("You are not enrolled in this course.");
    const { course, employee } = enrollment;
    if (enrollment.status === "PASSED") throw new Error("You already passed this course.");
    if (employee.status === "TERMINATED") throw new Error("This employee is terminated.");
    const unmet = await unmetPrerequisites(tx, { workspaceId: ctx.workspaceId, employeeId, jobRoleId: employee.jobRoleId, course });
    if (unmet.length) throw new Error(`Pass ${unmet.map((u) => `"${u.title}"`).join(" and ")} first.`);
    if (enrollment.lastAttemptAt && enrollment.status === "FAILED") {
      const until = new Date(enrollment.lastAttemptAt.getTime() + course.cooldownMinutes * 60000);
      if (until > new Date()) throw new Error(cooldownMessage(until, course.cooldownMinutes));
    }
    if (!course.questions.length) throw new Error("This course has no quiz questions.");
    const byId = new Map(course.questions.map((q) => [q.id, q]));
    // Resume an unfinished sitting from the last 2 hours, so a page refresh does not change the questions.
    let attempt = await tx.quizAttempt.findFirst({ where: { employeeId, courseId, submittedAt: null, startedAt: { gte: new Date(Date.now() - 2 * 3600_000) } }, orderBy: { startedAt: "desc" } });
    if (attempt && !attempt.questionIds.every((id) => byId.has(id))) attempt = null; // the quiz was edited since
    if (!attempt) {
      const pick = pickQuiz(course, course.questions);
      attempt = await tx.quizAttempt.create({ data: { workspaceId: ctx.workspaceId, courseId, employeeId, questionIds: pick.questionIds, optionOrder: pick.optionOrder } });
    }
    const order = (attempt.optionOrder ?? {}) as Record<string, number[]>;
    const questions = attempt.questionIds.map((id) => {
      const q = byId.get(id)!;
      const opts = q.options as string[];
      return { id, prompt: q.prompt, options: (order[id] ?? opts.map((_, i) => i)).map((i) => ({ i, text: opts[i] })) };
    });
    return { attemptId: attempt.id, questions };
  });
}

/** Automation 2: grade on the server against the questions that were asked, certify, promote readiness/status. */
export async function submitQuiz(ctx: Ctx, employeeId: string, courseId: string, attemptId: string, answers: { questionId: string; optionIndex: number }[]): Promise<{ result: QuizResult; fx: Effects }> {
  const fx = newEffects();
  const result = await prisma.$transaction(async (tx) => {
    const enrollment = await tx.courseEnrollment.findFirst({
      where: { employeeId, courseId, workspaceId: ctx.workspaceId },
      include: { course: { include: { questions: true } }, employee: true },
    });
    if (!enrollment) throw new Error("You are not enrolled in this course.");
    const { course, employee } = enrollment;
    if (enrollment.status === "PASSED") throw new Error("You already passed this course.");
    if (employee.status === "TERMINATED") throw new Error("This employee is terminated.");
    const unmet = await unmetPrerequisites(tx, { workspaceId: ctx.workspaceId, employeeId, jobRoleId: employee.jobRoleId, course });
    if (unmet.length) throw new Error(`Pass ${unmet.map((u) => `"${u.title}"`).join(" and ")} first.`);
    if (enrollment.lastAttemptAt && enrollment.status === "FAILED") {
      const until = new Date(enrollment.lastAttemptAt.getTime() + course.cooldownMinutes * 60000);
      if (until > new Date()) throw new Error(cooldownMessage(until, course.cooldownMinutes));
    }
    const attempt = await tx.quizAttempt.findFirst({ where: { id: attemptId, employeeId, courseId, workspaceId: ctx.workspaceId } });
    if (!attempt) throw new Error("Start the quiz again, then submit.");
    if (attempt.submittedAt) throw new Error("This quiz was already submitted. Start a new attempt.");
    const byId = new Map(course.questions.map((q) => [q.id, q]));
    const asked = attempt.questionIds.map((id) => byId.get(id));
    if (asked.some((q) => !q)) throw new Error("This quiz was updated while you were taking it. Reload and start again.");
    const qs = asked as NonNullable<(typeof asked)[number]>[];
    if (!qs.length) throw new Error("This course has no quiz questions.");
    const given = new Map(answers.map((a) => [a.questionId, a.optionIndex]));
    if (given.size !== qs.length || !qs.every((q) => given.has(q.id))) throw new Error("Answer every question before submitting.");
    let correct = 0;
    const review = qs.map((q) => {
      const chosen = given.get(q.id)!;
      if (chosen === q.correctOptionIndex) correct++;
      return { questionId: q.id, prompt: q.prompt, chosen, correctIndex: q.correctOptionIndex, explanation: q.explanation };
    });
    const score = Math.round((correct / qs.length) * 100);
    const passed = score >= course.passingScore;
    const best = Math.max(score, enrollment.bestScore ?? 0);
    let certificateCode: string | undefined;

    await tx.quizAttempt.update({ where: { id: attempt.id }, data: { submittedAt: new Date(), score, passed } });
    await tx.quizAnswer.createMany({
      data: qs.map((q, i) => ({ attemptId: attempt.id, workspaceId: ctx.workspaceId, courseId, questionId: q.id, prompt: q.prompt, chosenIndex: review[i].chosen, correctIndex: q.correctOptionIndex, correct: review[i].chosen === q.correctOptionIndex, options: q.options as string[] })),
    });

    if (passed) {
      for (let i = 0; i < 6 && !certificateCode; i++) {
        const code = `CERT-${randomInt(10000, 99999)}`;
        if (!(await tx.courseEnrollment.findUnique({ where: { certificateCode: code } }))) certificateCode = code;
      }
      await tx.courseEnrollment.update({
        where: { id: enrollment.id },
        data: { status: "PASSED", bestScore: best, attemptsCount: { increment: 1 }, lastAttemptAt: new Date(), completedAt: new Date(), certificateCode, reminderStage: 0, reminderSentAt: null, expiresAt: course.validityDays ? new Date(Date.now() + course.validityDays * 86400000) : null },
      });
      // Are all mandatory courses for this employee passed? (role requirements + any remedial enrollments)
      const open = await tx.courseEnrollment.count({ where: { employeeId, status: { not: "PASSED" } } });
      let promoted = false;
      if (open === 0) {
        await tx.employeeProfile.update({
          where: { id: employeeId },
          data: { readiness: "CERTIFIED", ...(employee.status === "ONBOARDING" ? { status: "ACTIVE" } : {}) },
        });
        promoted = true;
      }
      await writeAudit(tx, {
        workspaceId: ctx.workspaceId,
        actorMemberId: ctx.id,
        actorName: ctx.user.name,
        actionType: "QUIZ_PASSED",
        targetType: "Employee",
        targetId: employeeId,
        summary: `${employee.staffCode} passed "${course.title}" with ${score}% (${certificateCode})`,
        metadata: { courseId, score, certificateCode: certificateCode!, promoted },
      });
      if (promoted) await notifyRoles(tx, ctx.workspaceId, ["OWNER", "ADMIN", "MANAGER"], { title: `${employee.fullName} is certified`, body: `Passed ${course.title} with ${score}%`, href: `/app/employee/${employeeId}` }, ctx.id);
      fx.ops.push({
        title: `Certified: ${employee.fullName}`,
        description: `${employee.staffCode} passed ${course.title}`,
        color: COLORS.ok,
        fields: [
          { name: "Score", value: `${score}%`, inline: true },
          { name: "Certificate", value: certificateCode!, inline: true },
          ...(promoted ? [{ name: "Readiness", value: "CERTIFIED — all mandatory courses passed" }] : []),
        ],
      });
    } else {
      await tx.courseEnrollment.update({
        where: { id: enrollment.id },
        data: { status: "FAILED", bestScore: best, attemptsCount: { increment: 1 }, lastAttemptAt: new Date() },
      });
      await writeAudit(tx, {
        workspaceId: ctx.workspaceId,
        actorMemberId: ctx.id,
        actorName: ctx.user.name,
        actionType: "QUIZ_FAILED",
        targetType: "Employee",
        targetId: employeeId,
        summary: `${employee.staffCode} scored ${score}% on "${course.title}" (needs ${course.passingScore}%)`,
        metadata: { courseId, score },
      });
    }
    const out: QuizResult = { score, passed, correct, total: qs.length, certificateCode, review };
    if (!passed) out.cooldownUntil = new Date(Date.now() + course.cooldownMinutes * 60000).toISOString();
    return out;
  });
  return { result, fx };
}

export type IssueInput = {
  employeeId: string;
  severity: Severity;
  pointsAdded: number;
  policyViolated: string;
  summary: string;
  evidenceUrls: string[];
  confidentialManagerNotes: string;
};

/** Automation 3: progressive discipline escalation, strike point decay, auto-retraining, auto-suspend/terminate. */
export async function issueInfraction(ctx: Ctx, input: IssueInput) {
  const fx = newEffects();
  const SEV_ORDER: Severity[] = ["VERBAL_WARNING", "WRITTEN_INFRACTION", "STRIKE_POINTS", "SUSPENSION", "TERMINATION"];
  const out = await prisma.$transaction(async (tx) => {
    const emp = await tx.employeeProfile.findFirst({ where: { id: input.employeeId, workspaceId: ctx.workspaceId } });
    if (!emp) throw new Error("Employee not found.");
    const ws = ctx.workspace;
    const effects: string[] = [];

    // Apply strike point decay if configured on the workspace
    let basePoints = emp.strikePoints;
    const decayDays = getStrikeDecayDays(ws.features);
    if (decayDays > 0 && basePoints > 0) {
      const cutoff = new Date(Date.now() - decayDays * 86400000);
      const recentCases = await tx.infractionCase.findMany({
        where: { employeeId: emp.id, workspaceId: ws.id, createdAt: { gte: cutoff } },
        include: { appeals: true },
      });
      const activePts = recentCases
        .filter((c) => !c.appeals.some((a) => a.status === "OVERTURNED"))
        .reduce((s, c) => s + c.pointsAdded, 0);
      if (activePts < basePoints) {
        effects.push(`strike decay applied (${basePoints} → ${activePts})`);
        basePoints = activePts;
      }
    }

    // Evaluate progressive discipline rules (auto-escalate repeated patterns)
    let finalSeverity: Severity = input.severity;
    const rules = await tx.disciplineRule.findMany({ where: { workspaceId: ws.id, enabled: true, whenSeverity: input.severity } });
    for (const r of rules) {
      const since = new Date(Date.now() - r.withinDays * 86400000);
      const priorCount = await tx.infractionCase.count({
        where: {
          employeeId: emp.id,
          workspaceId: ws.id,
          severity: r.whenSeverity,
          createdAt: { gte: since },
          appeals: { none: { status: "OVERTURNED" } },
        },
      });
      if (priorCount + 1 >= r.count && SEV_ORDER.indexOf(r.escalateTo) > SEV_ORDER.indexOf(finalSeverity)) {
        finalSeverity = r.escalateTo;
        effects.push(`auto-escalated to ${finalSeverity.replace(/_/g, " ")} (${priorCount + 1}x ${r.whenSeverity.replace(/_/g, " ")} in ${r.withinDays}d)`);
      }
    }

    const newPoints = basePoints + input.pointsAdded;
    const caseNumber = await nextCaseNumber(tx, ws.id);

    const retrain = (finalSeverity === "WRITTEN_INFRACTION" || input.pointsAdded >= 2) && ws.autoRetrainOnWrittenInfraction;
    let remedialId: string | null = null;
    if (retrain) {
      const remedial = await tx.course.findFirst({ where: { workspaceId: ws.id, isRemedial: true, isPublished: true }, orderBy: { createdAt: "asc" } });
      remedialId = remedial?.id ?? null;
    }

    const created = await tx.infractionCase.create({
      data: {
        workspaceId: ws.id,
        caseNumber,
        employeeId: emp.id,
        issuedByMemberId: ctx.id,
        severity: finalSeverity,
        pointsAdded: input.pointsAdded,
        policyViolated: input.policyViolated,
        summary: input.summary,
        evidenceUrls: input.evidenceUrls,
        confidentialManagerNotes: input.confidentialManagerNotes,
        assignedRemedialCourseId: remedialId,
      },
    });
    await tx.infractionTimelineEvent.create({
      data: {
        caseId: created.id,
        actorMemberId: ctx.id,
        actorName: ctx.user.name,
        eventType: "CREATED",
        note: `${finalSeverity.replace(/_/g, " ")} issued for ${input.policyViolated}${finalSeverity !== input.severity ? ` (auto-escalated from ${input.severity.replace(/_/g, " ")})` : ""}`,
      },
    });

    const update: Prisma.EmployeeProfileUpdateInput = { strikePoints: newPoints };
    if (retrain) {
      update.readiness = "RETRAINING_REQUIRED";
      effects.push("readiness → RETRAINING_REQUIRED");
      if (remedialId) {
        const existing = await tx.courseEnrollment.findUnique({ where: { employeeId_courseId: { employeeId: emp.id, courseId: remedialId } } });
        const reason = `Auto-assigned after ${caseNumber}`;
        if (existing) {
          await tx.courseEnrollment.update({ where: { id: existing.id }, data: { status: "ASSIGNED", assignedReason: reason, completedAt: null, certificateCode: null, dueDate: new Date(Date.now() + 7 * 86400000) } });
        } else {
          await tx.courseEnrollment.create({ data: { workspaceId: ws.id, employeeId: emp.id, courseId: remedialId, assignedReason: reason, dueDate: new Date(Date.now() + 7 * 86400000) } });
        }
        const rc = await tx.course.findUnique({ where: { id: remedialId } });
        await tx.infractionTimelineEvent.create({
          data: { caseId: created.id, actorName: "System", eventType: "RETRAINING_TRIGGERED", note: `Remedial course assigned: ${rc?.title ?? remedialId}` },
        });
        effects.push(`remedial course assigned (${rc?.title})`);
        fx.mail.push({ to: emp.email, ...emails.courseAssigned(emp.fullName, rc?.title ?? "Remedial course", reason) });
        await notifyEmployee(tx, ws.id, emp.id, { title: `Retraining assigned: ${rc?.title ?? "Remedial course"}`, body: reason, href: `/app/training/course/${remedialId}` });
      }
    }
    if (finalSeverity === "TERMINATION") {
      update.status = "TERMINATED";
      effects.push("status → TERMINATED");
    } else if (finalSeverity === "SUSPENSION" || newPoints >= ws.autoSuspendStrikeThreshold) {
      if (emp.status !== "TERMINATED") {
        update.status = "SUSPENDED";
        effects.push("status → SUSPENDED");
      }
    }
    await tx.employeeProfile.update({ where: { id: emp.id }, data: update });

    await writeAudit(tx, {
      workspaceId: ws.id,
      actorMemberId: ctx.id,
      actorName: ctx.user.name,
      actionType: "INFRACTION_ISSUED",
      targetType: "Employee",
      targetId: emp.id,
      summary: `${caseNumber}: ${finalSeverity.replace(/_/g, " ")} for ${emp.staffCode} (+${input.pointsAdded} pts, total ${newPoints})${effects.length ? ` — ${effects.join("; ")}` : ""}`,
      metadata: { caseId: created.id, severity: finalSeverity, pointsAdded: input.pointsAdded, effects },
    });

    fx.confidential.push({
      title: `${caseNumber} — ${finalSeverity.replace(/_/g, " ")}`,
      description: `${emp.fullName} (${emp.staffCode}) · ${input.policyViolated}`,
      color: finalSeverity === "VERBAL_WARNING" ? COLORS.warn : COLORS.danger,
      fields: [
        { name: "Points", value: `+${input.pointsAdded} (total ${newPoints})`, inline: true },
        { name: "Issued by", value: ctx.user.name, inline: true },
        ...(effects.length ? [{ name: "Automatic actions", value: effects.join("\n") }] : []),
      ],
    });
    await notifyEmployee(tx, ws.id, emp.id, { title: `${caseNumber} needs your signature`, body: input.policyViolated, href: "/app/my-portal" });
    if (finalSeverity !== "VERBAL_WARNING") {
      fx.mail.push({ to: emp.email, ...emails.infraction(emp.fullName, caseNumber, finalSeverity, input.summary) });
    }
    return { id: created.id, caseNumber, effects };
  });
  return { ...out, fx };
}
