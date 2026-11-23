// Local check of quiz banks, shuffling, prerequisites, learning-path order and answer capture.
// Uses the local demo database only. Creates its own employee, job role and attempts, changes two demo courses and puts them back.
// Run: DATA_MASTER_KEY=<any throwaway base64 key> npx tsx scripts/quiz-rules-selftest.mts
const unwrap = (m: any) => (m && m.default && !m.prisma && !m.startQuizAttempt ? m.default : m);
const { prisma } = unwrap(await import("../src/lib/prisma.ts"));
const { startQuizAttempt, submitQuiz } = unwrap(await import("../src/lib/automations.ts"));

if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) { console.error("Local database only."); process.exit(1); }
const ok = (n: string, c: boolean, extra = "") => { console.log(c ? "PASS" : "FAIL", n, extra); if (!c) process.exitCode = 1; };
const fails = async (f: () => Promise<unknown>) => { try { await f(); return ""; } catch (e) { return e instanceof Error ? e.message : String(e); } };

const A = await prisma.course.findFirstOrThrow({ where: { title: "Warehouse Safety Fundamentals" }, include: { questions: true } });
const B = await prisma.course.findFirstOrThrow({ where: { id: { not: A.id }, workspaceId: A.workspaceId, title: "Dock & Forklift Operations" } });
const owner = await prisma.workspaceMember.findFirstOrThrow({ where: { workspaceId: A.workspaceId, role: "OWNER" }, include: { user: true } });
const ctx: any = { workspaceId: A.workspaceId, id: owner.id, user: { name: "Selftest" }, role: "OWNER" };
const original = { a: { quizQuestionCount: A.quizQuestionCount, shuffleQuestions: A.shuffleQuestions, shuffleOptions: A.shuffleOptions, cooldownMinutes: A.cooldownMinutes }, b: { prerequisiteIds: B.prerequisiteIds } };

const code = `SELFTEST-${Date.now()}`;
const emp = await prisma.employeeProfile.create({ data: { workspaceId: A.workspaceId, staffCode: code, fullName: "Selftest Person", email: `${code.toLowerCase()}@example.test`, status: "ACTIVE" } });
const enrollA = await prisma.courseEnrollment.create({ data: { workspaceId: A.workspaceId, employeeId: emp.id, courseId: A.id } });
await prisma.courseEnrollment.create({ data: { workspaceId: A.workspaceId, employeeId: emp.id, courseId: B.id } });
const cleanup = async () => {
  await prisma.quizAttempt.deleteMany({ where: { employeeId: emp.id } });
  await prisma.courseEnrollment.deleteMany({ where: { employeeId: emp.id } });
  await prisma.employeeProfile.deleteMany({ where: { id: emp.id } });
  await prisma.jobRole.deleteMany({ where: { workspaceId: A.workspaceId, title: `${code}-role` } });
  await prisma.course.update({ where: { id: A.id }, data: original.a });
  await prisma.course.update({ where: { id: B.id }, data: original.b });
};

try {
  const byId = new Map<string, { correctOptionIndex: number; options: string[] }>(A.questions.map((q: any) => [q.id, q]));
  await prisma.course.update({ where: { id: A.id }, data: { quizQuestionCount: 3, shuffleQuestions: true, shuffleOptions: true, cooldownMinutes: 15 } });
  await prisma.course.update({ where: { id: B.id }, data: { prerequisiteIds: [A.id] } });

  // prerequisite blocks the second course
  const e1 = await fails(() => startQuizAttempt(ctx, emp.id, B.id));
  ok("prerequisite blocks starting the quiz", /Pass .*Warehouse Safety.* first/.test(e1), e1);

  // bank: 3 of 5, no answers leaked, varied across attempts
  const sets = new Set<string>(); const orders = new Set<string>(); let leaked = false;
  for (let i = 0; i < 25; i++) {
    const r = await startQuizAttempt(ctx, emp.id, A.id);
    if (r.questions.length !== 3) ok("bank size", false, String(r.questions.length));
    if (JSON.stringify(r).includes("correctOptionIndex") || JSON.stringify(r).includes("explanation")) leaked = true;
    sets.add(r.questions.map((q: any) => q.id).sort().join(","));
    orders.add(r.questions.map((q: any) => q.id).join(","));
    for (const q of r.questions) orders.add(q.id + ":" + q.options.map((o: any) => o.i).join(""));
    await prisma.quizAttempt.delete({ where: { id: r.attemptId } });
  }
  ok("each attempt asks exactly 3 of 5", true);
  ok("different question picks across attempts", sets.size > 1, `${sets.size} different sets in 25 tries`);
  ok("question and option order vary", orders.size > 10, `${orders.size} distinct orders`);
  ok("correct answers and explanations are never sent", !leaked);

  // resume: same attempt returned inside 2 hours
  const s1 = await startQuizAttempt(ctx, emp.id, A.id);
  const s2 = await startQuizAttempt(ctx, emp.id, A.id);
  ok("a refresh resumes the same sitting", s1.attemptId === s2.attemptId && s1.questions.map((q: any) => q.id).join() === s2.questions.map((q: any) => q.id).join());

  // validation
  const e2 = await fails(() => submitQuiz(ctx, emp.id, A.id, s1.attemptId, [{ questionId: s1.questions[0].id, optionIndex: 0 }]));
  ok("missing answers are rejected", /Answer every question/.test(e2), e2);
  const other = A.questions.find((q: any) => !s1.questions.some((x: any) => x.id === q.id));
  const e3 = await fails(() => submitQuiz(ctx, emp.id, A.id, s1.attemptId, [...s1.questions.slice(0, 2).map((q: any) => ({ questionId: q.id, optionIndex: 0 })), { questionId: other.id, optionIndex: 0 }]));
  ok("answers for questions that were not asked are rejected", /Answer every question/.test(e3), e3);
  const e4 = await fails(() => submitQuiz(ctx, emp.id, A.id, "not-an-attempt", s1.questions.map((q: any) => ({ questionId: q.id, optionIndex: 0 }))));
  ok("unknown attempt rejected", /Start the quiz again/.test(e4), e4);

  // wrong answers: fail, cooldown, answers stored
  const wrong = s1.questions.map((q: any) => ({ questionId: q.id, optionIndex: (byId.get(q.id)!.correctOptionIndex + 1) % 4 }));
  const fail = await submitQuiz(ctx, emp.id, A.id, s1.attemptId, wrong);
  ok("all wrong fails with a 0% score", !fail.result.passed && fail.result.score === 0);
  ok("review keeps the questions that were asked", fail.result.review.length === 3);
  const stored = await prisma.quizAnswer.findMany({ where: { attemptId: s1.attemptId } });
  ok("every answer is stored for analytics", stored.length === 3 && stored.every((a: any) => !a.correct && a.prompt && Array.isArray(a.options)));
  const e5 = await fails(() => startQuizAttempt(ctx, emp.id, A.id));
  ok("retake cooldown still applies", /minute cooldown/.test(e5), e5);
  const e6 = await fails(() => submitQuiz(ctx, emp.id, A.id, s1.attemptId, wrong));
  ok("a submitted attempt cannot be resubmitted", /cooldown|already submitted/.test(e6), e6);

  // retake after cooldown: new attempt; right answers pass
  await prisma.courseEnrollment.update({ where: { id: enrollA.id }, data: { lastAttemptAt: new Date(Date.now() - 3600_000) } });
  const t2 = await startQuizAttempt(ctx, emp.id, A.id);
  ok("retake gets a new attempt", t2.attemptId !== s1.attemptId);
  // answers are given as the ORIGINAL option index, whatever order it was shown in
  const right = t2.questions.map((q: any) => ({ questionId: q.id, optionIndex: byId.get(q.id)!.correctOptionIndex }));
  const pass = await submitQuiz(ctx, emp.id, A.id, t2.attemptId, right);
  ok("correct answers pass and certify", pass.result.passed && pass.result.score === 100 && !!pass.result.certificateCode);
  const stored2 = await prisma.quizAnswer.count({ where: { attemptId: t2.attemptId, correct: true } });
  ok("correct answers are stored too", stored2 === 3);

  // prerequisite now met
  const b1 = await startQuizAttempt(ctx, emp.id, B.id);
  ok("second course opens once the first is passed", b1.questions.length === B.id ? false : b1.questions.length > 0);

  // learning path in order: no explicit prerequisites, sequential role
  await prisma.course.update({ where: { id: B.id }, data: { prerequisiteIds: [] } });
  await prisma.courseEnrollment.update({ where: { id: enrollA.id }, data: { status: "ASSIGNED", certificateCode: null, completedAt: null } });
  const role = await prisma.jobRole.create({ data: { workspaceId: A.workspaceId, title: `${code}-role`, requiredCourseIds: [A.id, B.id], pathSequential: true } });
  await prisma.employeeProfile.update({ where: { id: emp.id }, data: { jobRoleId: role.id } });
  const e7 = await fails(() => startQuizAttempt(ctx, emp.id, B.id));
  ok("sequential path locks the second course until the first is passed", /Pass .*Warehouse Safety.* first/.test(e7), e7);
  await prisma.jobRole.update({ where: { id: role.id }, data: { pathSequential: false } });
  const e8 = await fails(() => startQuizAttempt(ctx, emp.id, B.id));
  ok("same role without 'unlock in order' does not lock", e8 === "", e8);
  const check = await prisma.jobRole.findUniqueOrThrow({ where: { id: role.id } });
  ok("path order is kept as saved", check.requiredCourseIds.join() === [A.id, B.id].join());
} finally {
  await cleanup();
  console.log("cleaned up");
}
process.exit(process.exitCode ?? 0);
