import { prisma } from "@/lib/prisma";
import { requirePageRole, MANAGEMENT_ROLES } from "@/lib/rbac";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import { PrintButton } from "../print-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Compliance report" };

export default async function ComplianceReport() {
  const ctx = await requirePageRole(MANAGEMENT_ROLES);
  const w = ctx.workspaceId;
  const [emps, policies, courses] = await Promise.all([
    prisma.employeeProfile.findMany({ where: { workspaceId: w, status: { not: "TERMINATED" } }, include: { department: true, jobRole: true, enrollments: { include: { course: true } }, policyAcks: true }, orderBy: { staffCode: "asc" } }),
    prisma.policy.findMany({ where: { workspaceId: w, isPublished: true } }),
    prisma.course.count({ where: { workspaceId: w, isPublished: true } }),
  ]);
  const now = new Date();
  return (
    <div className="mx-auto max-w-4xl p-8 text-[12px]">
      <div className="no-print mb-4 flex justify-end"><PrintButton /></div>
      <p className="mono text-xs text-soft">{ctx.workspace.name} · Training and policy compliance report · generated {fmtDateTime(now)}</p>
      <h1 className="mt-1 text-2xl font-semibold">Compliance report</h1>
      <p className="mt-1 text-soft">{emps.length} current employees, {courses} published courses, {policies.length} published policies. Confidential disciplinary information is not included in this report.</p>
      <table className="mt-5 w-full border-collapse">
        <thead><tr>{["ID", "Employee", "Department", "Status", "Readiness", "Courses passed", "Overdue", "Expiring ≤30d", "Policies signed"].map((h) => <th key={h} className="th !static">{h}</th>)}</tr></thead>
        <tbody>{emps.map((e) => {
          const open = e.enrollments.filter((x) => x.status !== "PASSED");
          const overdue = open.filter((x) => x.dueDate && x.dueDate < now).length;
          const expiring = e.enrollments.filter((x) => x.status === "PASSED" && x.expiresAt && x.expiresAt > now && x.expiresAt.getTime() < now.getTime() + 30 * 86400000).length;
          const scope = policies.filter((p) => p.appliesToAll || (e.jobRoleId && p.requiredJobRoleIds.includes(e.jobRoleId)));
          const signed = scope.filter((p) => e.policyAcks.some((a) => a.policyId === p.id && a.version === p.version)).length;
          return <tr key={e.id}><td className="td mono">{e.staffCode}</td><td className="td">{e.fullName}</td><td className="td">{e.department?.name ?? "—"}</td><td className="td">{e.status}</td><td className="td">{e.readiness.replace(/_/g, " ")}</td><td className="td mono">{e.enrollments.length - open.length}/{e.enrollments.length}</td><td className="td mono">{overdue || "—"}</td><td className="td mono">{expiring || "—"}</td><td className="td mono">{scope.length ? `${signed}/${scope.length}` : "—"}</td></tr>;
        })}</tbody>
      </table>
      <p className="mt-4 text-soft">Prepared from OnboardOps records as of {fmtDate(now)}. Certificate expiry follows each course&apos;s validity period.</p>
    </div>
  );
}
