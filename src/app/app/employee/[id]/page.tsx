import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole, STAFF_ROLES, ADMIN_ROLES, MANAGEMENT_ROLES, serializeInfraction } from "@/lib/rbac";
import { Dossier } from "./dossier";

export const metadata = { title: "Employee dossier" };

export default async function EmployeePage({ params }: { params: { id: string } }) {
  const ctx = await requirePageRole(STAFF_ROLES);
  const emp = await prisma.employeeProfile.findFirst({
    where: { id: params.id, workspaceId: ctx.workspaceId },
    include: {
      department: true,
      jobRole: true,
      member: { include: { user: true } },
      enrollments: { include: { course: true }, orderBy: { course: { title: "asc" } } },
      infractions: { include: { timeline: { orderBy: { createdAt: "asc" } }, issuedBy: { include: { user: true } } }, orderBy: { createdAt: "desc" } },
      submissions: { include: { template: true }, orderBy: { submittedAt: "desc" }, take: 10 },
    },
  });
  if (!emp) notFound();
  const isAdmin = ADMIN_ROLES.includes(ctx.role);
  const audit = isAdmin ? await prisma.auditLog.findMany({ where: { workspaceId: ctx.workspaceId, targetType: "Employee", targetId: emp.id }, orderBy: { createdAt: "desc" }, take: 100 }) : [];
  const canManage = MANAGEMENT_ROLES.includes(ctx.role);
  const [docRows, reviewRows] = await Promise.all([
    canManage ? prisma.employeeDocument.findMany({ where: { employeeId: emp.id, workspaceId: ctx.workspaceId, ...(isAdmin ? {} : { restricted: false }) }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
    canManage ? prisma.review.findMany({ where: { employeeId: emp.id, workspaceId: ctx.workspaceId }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
  ]);
  const [departments, roles] = await Promise.all([
    prisma.department.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { name: "asc" } }),
    prisma.jobRole.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { title: "asc" } }),
  ]);
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  const data = {
    id: emp.id, staffCode: emp.staffCode, fullName: emp.fullName, email: emp.email, phone: emp.phone, emergencyContact: emp.emergencyContact,
    departmentId: emp.departmentId, jobRoleId: emp.jobRoleId, department: emp.department?.name ?? null, jobRole: emp.jobRole?.title ?? null,
    status: emp.status, readiness: emp.readiness, strikePoints: emp.strikePoints, hireDate: iso(emp.hireDate)!, shiftAvailability: emp.shiftAvailability as Record<string, string>,
    hasLogin: !!emp.memberId, memberId: emp.memberId, memberRole: emp.member ? (await prisma.workspaceMember.findUnique({ where: { id: emp.member.id } }))?.role ?? null : null,
    enrollments: emp.enrollments.map((e) => ({ id: e.id, course: e.course.title, status: e.status, bestScore: e.bestScore, attempts: e.attemptsCount, cert: e.certificateCode, completedAt: iso(e.completedAt), due: iso(e.dueDate), reason: e.assignedReason })),
    infractions: emp.infractions.map((c) => {
      const s = serializeInfraction(ctx.role, c);
      return {
        id: s.id, caseNumber: s.caseNumber, severity: s.severity, points: s.pointsAdded, policy: s.policyViolated, summary: s.summary, createdAt: s.createdAt.toISOString(),
        acknowledged: s.employeeAcknowledged, issuedBy: c.issuedBy.user.name, confidential: s.confidentialManagerNotes,
        timeline: s.timeline.map((t) => ({ id: t.id, type: t.eventType, note: t.note, actor: t.actorName, at: t.createdAt.toISOString(), confidential: t.isConfidential })),
      };
    }),
    checklists: emp.submissions.map((s) => ({ id: s.id, title: s.template.title, at: s.submittedAt.toISOString(), verified: !!s.verifiedAt })),
    documents: docRows.map((d) => ({ id: d.id, title: d.title, category: d.category, restricted: d.restricted, visible: d.visibleToEmployee, expires: iso(d.expiresAt), by: d.uploadedByName, at: d.createdAt.toISOString(), fileId: d.fileId })),
    reviews: reviewRows.map((r) => ({ id: r.id, kind: r.kind, period: r.periodLabel, rating: r.rating, summary: r.summary, strengths: r.strengths, improvements: r.improvements, goals: r.goals, privateNotes: r.privateNotes, status: r.status, author: r.authorName, at: (r.sharedAt ?? r.createdAt).toISOString() })),
    audit: audit.map((a) => ({ id: a.id, at: a.createdAt.toISOString(), actor: a.actorName, summary: a.summary, hash: a.hash })),
  };
  return (
    <Dossier
      emp={data}
      departments={departments.map((d) => ({ id: d.id, name: d.name }))}
      roles={roles.map((r) => ({ id: r.id, name: r.title }))}
      perms={{ manage: MANAGEMENT_ROLES.includes(ctx.role), admin: isAdmin, owner: ctx.role === "OWNER" }}
    />
  );
}
