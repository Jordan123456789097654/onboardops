import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole, STAFF_ROLES, serializeInfraction } from "@/lib/rbac";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import { PrintButton } from "../../print-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Employee dossier" };

export default async function PrintDossier({ params }: { params: { id: string } }) {
  const ctx = await requirePageRole(STAFF_ROLES);
  const emp = await prisma.employeeProfile.findFirst({
    where: { id: params.id, workspaceId: ctx.workspaceId },
    include: { department: true, jobRole: true, enrollments: { include: { course: true } }, infractions: { include: { timeline: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" } } },
  });
  if (!emp) notFound();
  return (
    <div className="mx-auto max-w-3xl p-8 text-[13px]">
      <div className="no-print mb-4 flex justify-end"><PrintButton /></div>
      <p className="mono text-xs text-soft">{ctx.workspace.name} · Employee dossier · generated {fmtDateTime(new Date())}</p>
      <h1 className="mt-1 text-2xl font-semibold">{emp.fullName}</h1>
      <p className="mono">{emp.staffCode} · {emp.status} · {emp.readiness} · {emp.strikePoints} strike points</p>
      <p className="text-soft">{emp.jobRole?.title ?? "No job role"} · {emp.department?.name ?? "No department"} · hired {fmtDate(emp.hireDate)}</p>
      <h2 className="mb-1 mt-6 font-semibold">Training</h2>
      <table className="w-full border-collapse"><tbody>{emp.enrollments.map((e) => <tr key={e.id}><td className="td">{e.course.title}</td><td className="td mono">{e.status}</td><td className="td mono">{e.bestScore != null ? `${e.bestScore}%` : "—"}</td><td className="td mono">{e.certificateCode ?? "—"}</td></tr>)}</tbody></table>
      <h2 className="mb-1 mt-6 font-semibold">Infractions</h2>
      {emp.infractions.length === 0 && <p className="text-soft">None on file.</p>}
      {emp.infractions.map((c) => {
        const s = serializeInfraction(ctx.role, c);
        return (
          <div key={s.id} className="mb-3 border-b border-line pb-3">
            <p className="mono">{s.caseNumber} · {s.severity.replace(/_/g, " ")} · +{s.pointsAdded} pts · {fmtDate(s.createdAt)}</p>
            <p className="font-medium">{s.policyViolated}</p><p>{s.summary}</p>
            <p className="mono text-xs text-soft">{s.employeeAcknowledged ? `Acknowledged ${fmtDate(s.acknowledgedAt)} by ${s.employeeSignatureName}` : "Not yet acknowledged"}</p>
            {s.confidentialManagerNotes && <p className="mt-1 text-xs"><b>Confidential:</b> {s.confidentialManagerNotes}</p>}
          </div>
        );
      })}
    </div>
  );
}
