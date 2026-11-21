import { prisma } from "@/lib/prisma";
import { requireWorkspaceRole, ADMIN_ROLES, AuthzError } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { fmtDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Full JSON export of the workspace for Owners and Admins. Includes confidential notes. Uploaded files are listed, not embedded. */
export async function GET() {
  try {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES, { allowSuspended: true });
    const w = ctx.workspaceId;
    const [departments, jobRoles, employees, courses, enrollments, cases, templates, submissions, audit, policies, acks, documents, incidents, reviews, members] = await Promise.all([
      prisma.department.findMany({ where: { workspaceId: w } }),
      prisma.jobRole.findMany({ where: { workspaceId: w } }),
      prisma.employeeProfile.findMany({ where: { workspaceId: w } }),
      prisma.course.findMany({ where: { workspaceId: w }, include: { lessons: { orderBy: { orderIndex: "asc" } }, questions: { orderBy: { orderIndex: "asc" } } } }),
      prisma.courseEnrollment.findMany({ where: { workspaceId: w } }),
      prisma.infractionCase.findMany({ where: { workspaceId: w }, include: { timeline: { orderBy: { createdAt: "asc" } } } }),
      prisma.shiftChecklistTemplate.findMany({ where: { workspaceId: w } }),
      prisma.shiftChecklistSubmission.findMany({ where: { workspaceId: w } }),
      prisma.auditLog.findMany({ where: { workspaceId: w }, orderBy: { createdAt: "asc" } }),
      prisma.policy.findMany({ where: { workspaceId: w } }),
      prisma.policyAcknowledgment.findMany({ where: { workspaceId: w } }),
      prisma.employeeDocument.findMany({ where: { workspaceId: w } }),
      prisma.incidentReport.findMany({ where: { workspaceId: w } }),
      prisma.review.findMany({ where: { workspaceId: w } }),
      prisma.workspaceMember.findMany({ where: { workspaceId: w }, include: { user: { select: { name: true, email: true } } } }),
    ]);
    await prisma.$transaction((tx) => writeAudit(tx, { workspaceId: w, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "WORKSPACE_EXPORTED", targetType: "Workspace", targetId: w, summary: "Full workspace export downloaded" }));
    const body = {
      exportedAt: new Date().toISOString(),
      exportedBy: ctx.user.name,
      notice: "Contains confidential manager notes and personal information. Store it securely. Uploaded files (policy PDFs, employee documents) are listed by name but are not included in this file.",
      workspace: { name: ctx.workspace.name, slug: ctx.workspace.slug, autoSuspendStrikeThreshold: ctx.workspace.autoSuspendStrikeThreshold, autoRetrainOnWrittenInfraction: ctx.workspace.autoRetrainOnWrittenInfraction },
      members: members.map((m) => ({ name: m.user.name, email: m.user.email, role: m.role })),
      departments, jobRoles, employees, courses, enrollments, infractionCases: cases, checklistTemplates: templates, checklistSubmissions: submissions,
      policies, policyAcknowledgments: acks, employeeDocuments: documents, incidentReports: incidents,
      reviewsAndOneOnOnes: reviews, auditLog: audit,
    };
    return new Response(JSON.stringify(body, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${ctx.workspace.slug}-export-${fmtDate(new Date())}.json"`, "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof AuthzError) return new Response(e.message, { status: 403 });
    return new Response("Export failed", { status: 500 });
  }
}
