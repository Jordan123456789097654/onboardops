import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole, MANAGEMENT_ROLES } from "@/lib/rbac";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import { PrintButton } from "../../print-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Policy sign-off sheet" };

export default async function PolicySheet({ params }: { params: { id: string } }) {
  const ctx = await requirePageRole(MANAGEMENT_ROLES);
  const p = await prisma.policy.findFirst({ where: { id: params.id, workspaceId: ctx.workspaceId }, include: { acks: true } });
  if (!p) notFound();
  const emps = await prisma.employeeProfile.findMany({ where: { workspaceId: ctx.workspaceId, status: { not: "TERMINATED" }, ...(p.appliesToAll ? {} : { jobRoleId: { in: p.requiredJobRoleIds } }) }, orderBy: { staffCode: "asc" } });
  const ack = new Map(p.acks.filter((a) => a.version === p.version).map((a) => [a.employeeId, a]));
  const signed = emps.filter((e) => ack.has(e.id)).length;
  return (
    <div className="mx-auto max-w-4xl p-8 text-[12px]">
      <div className="no-print mb-4 flex justify-end"><PrintButton /></div>
      <p className="mono text-xs text-soft">{ctx.workspace.name} · Policy sign-off sheet · generated {fmtDateTime(new Date())}</p>
      <h1 className="mt-1 text-2xl font-semibold">{p.title} <span className="mono text-base text-soft">v{p.version}</span></h1>
      <p className="mt-1 text-soft">{signed} of {emps.length} employees in scope have signed this version.</p>
      <table className="mt-5 w-full border-collapse">
        <thead><tr>{["ID", "Employee", "Status", "Signed as", "Date"].map((h) => <th key={h} className="th !static">{h}</th>)}</tr></thead>
        <tbody>{emps.map((e) => { const a = ack.get(e.id); return (
          <tr key={e.id}><td className="td mono">{e.staffCode}</td><td className="td">{e.fullName}</td><td className="td">{a ? "Signed" : "Not signed"}</td><td className="td">{a?.signatureName ?? ""}</td><td className="td mono">{a ? fmtDate(a.acknowledgedAt) : ""}</td></tr>
        ); })}</tbody>
      </table>
    </div>
  );
}
