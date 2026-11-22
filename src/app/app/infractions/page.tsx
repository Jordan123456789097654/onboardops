import { prisma } from "@/lib/prisma";
import { requirePageRole, STAFF_ROLES, serializeInfraction, canSeeConfidential, canIssueSeverity } from "@/lib/rbac";
import { Ledger, type CaseRow } from "./ledger";

export const metadata = { title: "Infractions" };

export default async function Infractions({ searchParams }: { searchParams: { log?: string } }) {
  const ctx = await requirePageRole(STAFF_ROLES);
  const [cases, employees, templates, rules] = await Promise.all([
    prisma.infractionCase.findMany({ where: { workspaceId: ctx.workspaceId }, include: { employee: true, issuedBy: { include: { user: true } }, timeline: { orderBy: { createdAt: "asc" } }, attachments: { orderBy: { createdAt: "asc" } }, appeals: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" } }),
    prisma.employeeProfile.findMany({ where: { workspaceId: ctx.workspaceId, status: { not: "TERMINATED" } }, orderBy: { staffCode: "asc" } }),
    prisma.caseTemplate.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { name: "asc" } }),
    prisma.disciplineRule.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { count: "asc" } }),
  ]);
  const rows: CaseRow[] = cases.map((c) => {
    const s = serializeInfraction(ctx.role, c);
    return {
      id: s.id, caseNumber: s.caseNumber, employeeId: c.employeeId, employee: `${c.employee.staffCode} ${c.employee.fullName}`, severity: s.severity, points: s.pointsAdded, policy: s.policyViolated, summary: s.summary,
      evidence: s.evidenceUrls, confidential: s.confidentialManagerNotes, acknowledged: s.employeeAcknowledged, signedBy: s.employeeSignatureName, acknowledgedAt: s.acknowledgedAt?.toISOString() ?? null,
      issuedBy: c.issuedBy.user.name, createdAt: s.createdAt.toISOString(),
      attachments: c.attachments.map((a) => ({ id: a.id, kind: a.kind, title: a.title, statement: a.statement, author: a.authorName, at: a.createdAt.toISOString() })),
      appeals: c.appeals.map((a) => ({ id: a.id, status: a.status, reason: a.reason, by: a.filedByName, reviewer: a.reviewerName, decision: a.decisionNote, at: a.createdAt.toISOString() })),
      timeline: s.timeline.map((t) => ({ id: t.id, type: t.eventType, note: t.note, actor: t.actorName, at: t.createdAt.toISOString(), confidential: t.isConfidential })),
    };
  });
  const severities = (["VERBAL_WARNING", "WRITTEN_INFRACTION", "STRIKE_POINTS", "SUSPENSION", "TERMINATION"] as const).filter((s) => canIssueSeverity(ctx.role, s));
  return <Ledger rows={rows} employees={employees.map((e) => ({ id: e.id, label: `${e.staffCode} ${e.fullName}` }))} templates={templates.map((t) => ({ id: t.id, name: t.name, severity: t.severity, points: t.points, policy: t.policy, summary: t.summary }))} severities={[...severities]} rules={rules.map((r) => ({ id: r.id, whenSeverity: r.whenSeverity, count: r.count, withinDays: r.withinDays, escalateTo: r.escalateTo }))} isAdmin={["OWNER", "ADMIN"].includes(ctx.role)} canConfidential={canSeeConfidential(ctx.role)} defaultOpen={searchParams.log === "1"} />;
}
