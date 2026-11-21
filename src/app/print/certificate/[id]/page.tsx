import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveMembership } from "@/lib/auth";
import { redirect } from "next/navigation";
import { fmtDate } from "@/lib/utils";
import { PrintButton } from "../../print-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Certificate" };

export default async function Certificate({ params }: { params: { id: string } }) {
  const m = await getActiveMembership();
  if (!m) redirect("/login");
  const e = await prisma.courseEnrollment.findFirst({ where: { id: params.id, workspaceId: m.workspaceId, status: "PASSED" }, include: { course: true, employee: true } });
  if (!e || !e.certificateCode) notFound();
  // Employees may only open their own certificates.
  if (m.role === "EMPLOYEE" && m.profile?.id !== e.employeeId) notFound();
  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="no-print mb-4 flex justify-end"><PrintButton /></div>
      <div className="rounded-lg border-2 border-ink p-10 text-center">
        <p className="mono text-xs uppercase text-soft">{m.workspace.name}</p>
        <h1 className="mt-4 text-3xl font-semibold">Certificate of Completion</h1>
        <p className="mt-6 text-soft">This certifies that</p>
        <p className="mt-2 text-2xl font-semibold">{e.employee.fullName}</p>
        <p className="mono text-xs text-soft">{e.employee.staffCode}</p>
        <p className="mt-6 text-soft">passed</p>
        <p className="mt-2 text-xl font-medium">{e.course.title}</p>
        <p className="mono mt-2">Score {e.bestScore}% (required {e.course.passingScore}%)</p>
        <div className="mono mt-8 flex justify-between text-xs"><span>{e.certificateCode}</span><span>{fmtDate(e.completedAt)}</span></div>
      </div>
    </div>
  );
}
