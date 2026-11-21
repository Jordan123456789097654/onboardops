import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePageRole, STAFF_ROLES, MANAGEMENT_ROLES } from "@/lib/rbac";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/utils";
import { AddEmployee } from "./add-employee";
import { ImportEmployees } from "./import-employees";

export const metadata = { title: "Staff Directory" };

export default async function Directory({ searchParams }: { searchParams: { q?: string; dept?: string; status?: string; readiness?: string; add?: string } }) {
  const ctx = await requirePageRole(STAFF_ROLES);
  const { q = "", dept = "", status = "", readiness = "" } = searchParams;
  const where: Prisma.EmployeeProfileWhereInput = { workspaceId: ctx.workspaceId };
  if (q) where.OR = [{ fullName: { contains: q, mode: "insensitive" } }, { staffCode: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }];
  if (dept) where.departmentId = dept;
  if (status) where.status = status as any;
  if (readiness) where.readiness = readiness as any;
  const [rows, departments, roles] = await Promise.all([
    prisma.employeeProfile.findMany({ where, include: { department: true, jobRole: true }, orderBy: { staffCode: "asc" } }),
    prisma.department.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { name: "asc" } }),
    prisma.jobRole.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { title: "asc" } }),
  ]);
  const exportQs = new URLSearchParams({ q, dept, status, readiness }).toString();
  const canAdd = MANAGEMENT_ROLES.includes(ctx.role);
  return (
    <>
      <PageHeader title="Staff Directory" sub={`${rows.length} employee${rows.length === 1 ? "" : "s"}`}>
        <a href={`/api/export/employees?${exportQs}`} className="btn">Export CSV</a>
        {canAdd && <ImportEmployees />}
        {canAdd && <AddEmployee defaultOpen={searchParams.add === "1"} departments={departments.map((d) => ({ id: d.id, name: d.name }))} roles={roles.map((r) => ({ id: r.id, name: r.title }))} />}
      </PageHeader>
      <form className="mb-3 flex flex-wrap gap-2" method="get">
        <input name="q" defaultValue={q} className="input !w-64" placeholder="Search name, ID or email" />
        <select name="dept" defaultValue={dept} className="input !w-44"><option value="">All departments</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        <select name="status" defaultValue={status} className="input !w-40"><option value="">All statuses</option>{["ONBOARDING", "ACTIVE", "LOA", "SUSPENDED", "TERMINATED"].map((s) => <option key={s}>{s}</option>)}</select>
        <select name="readiness" defaultValue={readiness} className="input !w-52"><option value="">All readiness</option>{["PENDING", "CERTIFIED", "RETRAINING_REQUIRED"].map((s) => <option key={s}>{s}</option>)}</select>
        <button className="btn">Filter</button>
        {(q || dept || status || readiness) && <Link href="/app/directory" className="btn">Clear</Link>}
      </form>
      {rows.length === 0 ? (
        <Empty title="No employees match" hint="Adjust the filters, or add your first employee." />
      ) : (
        <div className="card max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <thead><tr>{["ID", "Name", "Department", "Role", "Status", "Readiness", "Points", "Hired"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="hover:bg-muted">
                  <td className="td mono"><Link className="text-accent" href={`/app/employee/${e.id}`}>{e.staffCode}</Link></td>
                  <td className="td"><Link href={`/app/employee/${e.id}`} className="font-medium">{e.fullName}</Link><div className="text-xs text-soft">{e.email}</div></td>
                  <td className="td">{e.department?.name ?? "—"}</td>
                  <td className="td">{e.jobRole?.title ?? "—"}</td>
                  <td className="td"><Badge value={e.status} /></td>
                  <td className="td"><Badge value={e.readiness} /></td>
                  <td className="td mono">{e.strikePoints}</td>
                  <td className="td mono">{fmtDate(e.hireDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
