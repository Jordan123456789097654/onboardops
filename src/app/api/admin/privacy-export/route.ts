import { zipSync, strToU8 } from "fflate";
import { prisma } from "@/lib/prisma";
import { getStaff, staffAudit, SUPPORT_STAFF } from "@/lib/platform";
import { findUserByAnyEmail } from "@/lib/user-emails";
import { enforceRate } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const json = (v: unknown) => strToU8(JSON.stringify(v, null, 2));
const csvCell = (v: unknown) => { const s = v == null ? "" : v instanceof Date ? v.toISOString() : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = (rows: Record<string, unknown>[]) => (rows.length ? [Object.keys(rows[0]).join(","), ...rows.map((r) => Object.values(r).map(csvCell).join(","))].join("\n") : "No records.\n");

/**
 * Staff only. Builds a ZIP of one person's own data for a privacy access request: account, connected sign-ins, passkey and session metadata,
 * workspace memberships, their own training results and certificates, policy sign-offs, credentials, time-off requests and time entries,
 * support messages and emails we sent them. It never includes secrets (password hash, two-factor secrets, backup codes, passkey keys, tokens)
 * or records an employer keeps about an employee (discipline cases, reviews, coaching notes, documents), which the employer controls.
 * Every export is recorded in the staff audit log. Staff download it and send it to the person themselves.
 */
export async function GET(req: Request) {
  const staff = await getStaff();
  if (!staff || !SUPPORT_STAFF.includes(staff.role)) return new Response("Forbidden", { status: 403 });
  try { await enforceRate("privacy-export", 20, 3600, staff.id); } catch { return new Response("Too many exports. Try again later.", { status: 429 }); }
  const email = new URL(req.url).searchParams.get("email")?.toLowerCase().trim();
  if (!email) return new Response("email required", { status: 400 });

  const user = await findUserByAnyEmail(email);
  const emails = new Set<string>([email]);
  if (user) {
    emails.add(user.email.toLowerCase());
    for (const e of await prisma.userEmail.findMany({ where: { userId: user.id }, select: { email: true } })) emails.add(e.email.toLowerCase());
  }
  const list = [...emails];

  const [extraEmails, oauth, passkeys, sessions, members, supportRequests, emailLog] = await Promise.all([
    user ? prisma.userEmail.findMany({ where: { userId: user.id }, select: { email: true, verifiedAt: true, createdAt: true } }) : [],
    user ? prisma.oAuthAccount.findMany({ where: { userId: user.id }, select: { provider: true, email: true, createdAt: true, lastLoginAt: true } }) : [],
    user ? prisma.passkey.findMany({ where: { userId: user.id }, select: { name: true, deviceType: true, backedUp: true, createdAt: true, lastUsedAt: true } }) : [],
    user ? prisma.userSession.findMany({ where: { userId: user.id }, select: { device: true, ip: true, place: true, createdAt: true, lastSeenAt: true, revokedAt: true }, orderBy: { createdAt: "desc" }, take: 200 }) : [],
    user ? prisma.workspaceMember.findMany({ where: { userId: user.id }, include: { workspace: { select: { name: true, slug: true, subdomain: true } } } }) : [],
    prisma.supportRequest.findMany({ where: { email: { in: list } }, include: { messages: { select: { kind: true, body: true, createdAt: true }, orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "asc" } }),
    prisma.emailLog.findMany({ where: { OR: [{ to: { in: list } }, { redirectedFrom: { in: list } }] }, select: { subject: true, kind: true, status: true, createdAt: true }, orderBy: { createdAt: "asc" }, take: 2000 }),
  ]);

  const profiles = await prisma.employeeProfile.findMany({
    where: { OR: [{ email: { in: list } }, ...(members.length ? [{ memberId: { in: members.map((m) => m.id) } }] : [])] },
    include: { workspace: { select: { name: true } }, department: { select: { name: true } }, jobRole: { select: { title: true } } },
  });
  const pids = profiles.map((p) => p.id);
  const wsName = new Map(profiles.map((p) => [p.id, p.workspace.name]));
  const [enrollments, attempts, acks, credentials, requests, timeEntries] = pids.length
    ? await Promise.all([
        prisma.courseEnrollment.findMany({ where: { employeeId: { in: pids } }, include: { course: { select: { title: true } } }, orderBy: { completedAt: "asc" } }),
        prisma.quizAttempt.findMany({ where: { employeeId: { in: pids } }, include: { course: { select: { title: true } } }, orderBy: { startedAt: "asc" } }),
        prisma.policyAcknowledgment.findMany({ where: { employeeId: { in: pids } }, include: { policy: { select: { title: true } } }, orderBy: { acknowledgedAt: "asc" } }),
        prisma.credential.findMany({ where: { employeeId: { in: pids } }, orderBy: { createdAt: "asc" } }),
        prisma.staffRequest.findMany({ where: { employeeId: { in: pids } }, orderBy: { createdAt: "asc" } }),
        prisma.timeEntry.findMany({ where: { employeeId: { in: pids } }, orderBy: { clockIn: "asc" }, take: 20000 }),
      ])
    : [[], [], [], [], [], []];

  const certificates = enrollments.filter((e) => e.status === "PASSED").map((e) => ({ employer: wsName.get(e.employeeId) ?? "", course: e.course.title, certificateCode: e.certificateCode ?? "", passedOn: e.completedAt, expiresOn: e.expiresAt, bestScore: e.bestScore }));
  const files: Record<string, Uint8Array> = {
    "README.txt": strToU8([
      "OnboardOps account data export",
      `Prepared: ${new Date().toISOString()}`,
      `Requested for: ${email}`,
      "",
      "What is in this export: your account details, connected sign-in methods, passkey and session records (no secrets or keys), the workspaces you belong to,",
      "your own training results and certificates, policy sign-offs, credentials, time-off requests and time entries, messages you sent our support team, and emails we sent you.",
      "",
      "What is not in it: passwords, two-factor secrets, backup codes and passkey keys (we never share these), and records an employer keeps about its employees",
      "(for example discipline cases, reviews, coaching notes and documents). Your employer controls those, so please ask them for a copy.",
      "",
      user ? "An account was found for this email address." : "No account was found for this email address; only support messages and emails we sent are included.",
    ].join("\n")),
    "support-messages.json": json(supportRequests),
    "emails-sent-to-you.csv": strToU8(csv(emailLog)),
  };
  if (user) {
    files["account.json"] = json({ id: user.id, name: user.name, nickname: user.nickname, email: user.email, emailVerifiedAt: user.emailVerifiedAt, createdAt: user.createdAt, timezone: user.timezone, quietHours: { start: user.quietStart, end: user.quietEnd }, emailPreferences: user.emailPrefs, twoFactorEnabled: !!user.totpEnabledAt, passwordSet: !!user.passwordSetAt });
    files["other-email-addresses.json"] = json(extraEmails);
    files["connected-sign-ins.json"] = json(oauth);
    files["passkeys.json"] = json(passkeys);
    files["sessions.json"] = json(sessions);
    files["workspaces.json"] = json(members.map((m) => ({ workspace: m.workspace.name, address: m.workspace.subdomain ? `${m.workspace.subdomain}.onboardops.org` : null, role: m.role, joined: m.createdAt })));
  }
  if (profiles.length) {
    files["employee-profiles.json"] = json(profiles.map((p) => ({ employer: p.workspace.name, staffCode: p.staffCode, fullName: p.fullName, email: p.email, phone: p.phone, department: p.department?.name ?? null, jobRole: p.jobRole?.title ?? null, status: p.status, hireDate: p.hireDate })));
    files["training-enrollments.csv"] = strToU8(csv(enrollments.map((e) => ({ employer: wsName.get(e.employeeId) ?? "", course: e.course.title, status: e.status, bestScore: e.bestScore, attempts: e.attemptsCount, dueDate: e.dueDate, completedAt: e.completedAt, expiresAt: e.expiresAt }))));
    files["certificates.csv"] = strToU8(csv(certificates));
    files["quiz-attempts.csv"] = strToU8(csv(attempts.map((a) => ({ employer: wsName.get(a.employeeId) ?? "", course: a.course.title, startedAt: a.startedAt, submittedAt: a.submittedAt, score: a.score, passed: a.passed }))));
    files["policy-sign-offs.csv"] = strToU8(csv(acks.map((a) => ({ employer: wsName.get(a.employeeId) ?? "", policy: a.policy.title, version: a.version, signedAs: a.signatureName, acknowledgedAt: a.acknowledgedAt }))));
    files["credentials.csv"] = strToU8(csv(credentials.map((c) => ({ employer: wsName.get(c.employeeId) ?? "", name: c.name, number: c.number, issuer: c.issuer, issuedAt: c.issuedAt, expiresAt: c.expiresAt }))));
    files["time-off-and-requests.csv"] = strToU8(csv(requests.map((r) => ({ employer: wsName.get(r.employeeId) ?? "", kind: r.kind, subtype: r.subtype, startDate: r.startDate, endDate: r.endDate, status: r.status, reason: r.reason, createdAt: r.createdAt }))));
    files["time-entries.csv"] = strToU8(csv(timeEntries.map((t) => ({ employer: wsName.get(t.employeeId) ?? "", clockIn: t.clockIn, clockOut: t.clockOut, note: t.note }))));
  }

  await prisma.$transaction((tx) => staffAudit(tx, staff, { action: "PRIVACY_EXPORT", targetType: "User", targetId: user?.id ?? email, summary: `Exported account data for ${email} (${Object.keys(files).length} files)` }));
  const zip = zipSync(files, { level: 6 });
  const name = `onboardops-data-${email.replace(/[^a-z0-9]/g, "_")}.zip`;
  return new Response(zip as unknown as BodyInit, { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
}
