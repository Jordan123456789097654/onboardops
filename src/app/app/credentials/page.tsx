import { prisma } from "@/lib/prisma";
import { requirePagePerm } from "@/lib/rbac";
import { PageHeader, Empty } from "@/components/ui";
import { fmtDate } from "@/lib/utils";

export const metadata = { title: "Credentials" };

export default async function CredentialsPage() {
  const ctx = await requirePagePerm("credentials.manage", "credentials");
  const rows = await prisma.credential.findMany({ where: { workspaceId: ctx.workspaceId }, include: { employee: true }, orderBy: { expiresAt: "asc" } });
  return (
    <>
      <PageHeader title="Credentials" sub="Licenses and certifications across all staff, sorted by expiry." />
      {rows.length === 0 ? <Empty title="No credentials yet" hint="Add a license from an employee's Documents tab, or here by employee." /> : (
        <div className="card overflow-x-auto"><table className="w-full min-w-[640px] border-collapse"><thead><tr>{["Employee", "Credential", "Number", "Issuer", "Expires"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>{rows.map((c) => { const soon = c.expiresAt && c.expiresAt.getTime() < Date.now() + 30 * 86400000; return <tr key={c.id} className="hover:bg-muted"><td className="td">{c.employee.fullName}</td><td className="td">{c.name}</td><td className="td mono">{c.number || "—"}</td><td className="td">{c.issuer || "—"}</td><td className={`td mono ${soon ? "text-rose-600" : ""}`}>{c.expiresAt ? fmtDate(c.expiresAt) : "No expiry"}</td></tr>; })}</tbody></table></div>
      )}
    </>
  );
}
