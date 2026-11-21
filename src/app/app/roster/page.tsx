import { prisma } from "@/lib/prisma";
import { requirePagePerm } from "@/lib/rbac";
import { PageHeader } from "@/components/ui";
import { PrintButton } from "@/app/print/print-button";

export const metadata = { title: "Emergency roster" };

export default async function Roster() {
  const ctx = await requirePagePerm("roster.view", "roster");
  const emps = await prisma.employeeProfile.findMany({ where: { workspaceId: ctx.workspaceId, status: { in: ["ACTIVE", "ONBOARDING", "LOA", "SUSPENDED"] } }, include: { department: true }, orderBy: [{ fullName: "asc" }] });
  const groups = Array.from(new Set(emps.map((e) => e.department?.name ?? "No department")));
  return (
    <>
      <PageHeader title="Emergency roster" sub={`${emps.length} current staff with phone and emergency contact. Print it or export it.`}>
        <a className="btn" href="/api/export/roster">Export CSV</a><PrintButton />
      </PageHeader>
      <p className="no-print mb-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">Contains personal contact details. Keep printed copies secure.</p>
      {groups.map((g) => (
        <section key={g} className="mb-6">
          <h2 className="mb-1 text-sm font-semibold">{g}</h2>
          <div className="card overflow-x-auto"><table className="w-full min-w-[640px] border-collapse"><thead><tr>{["ID", "Name", "Phone", "Emergency contact", "Status"].map((h) => <th key={h} className="th !static">{h}</th>)}</tr></thead>
            <tbody>{emps.filter((e) => (e.department?.name ?? "No department") === g).map((e) => <tr key={e.id}><td className="td mono">{e.staffCode}</td><td className="td font-medium">{e.fullName}</td><td className="td mono">{e.phone ?? "—"}</td><td className="td">{e.emergencyContact ?? "—"}</td><td className="td text-xs">{e.status}</td></tr>)}</tbody></table></div>
        </section>
      ))}
    </>
  );
}
