import { subdomainHost } from "@/lib/subdomain";
import { prisma } from "@/lib/prisma";
import { requirePageRole, MANAGEMENT_ROLES } from "@/lib/rbac";
import { SITE } from "@/lib/site";
import { Access } from "./access";

export const metadata = { title: "Staff accounts" };

export default async function AccessPage() {
  const ctx = await requirePageRole(MANAGEMENT_ROLES);
  const emps = await prisma.employeeProfile.findMany({ where: { workspaceId: ctx.workspaceId, status: { not: "TERMINATED" } }, include: { member: { include: { user: true } }, department: true }, orderBy: { staffCode: "asc" } });
  const w = ctx.workspace;
  const url = w.customDomain && w.domainStatus === "VERIFIED" ? `https://${w.customDomain}` : w.subdomain && w.subdomainStatus === "ACTIVE" ? `https://${subdomainHost(w.subdomain)}` : `${SITE.url}/w/${w.slug}`;
  return <Access signInUrl={url} rows={emps.map((e) => ({ id: e.id, name: e.fullName, email: e.email, code: e.staffCode, dept: e.department?.name ?? null, hasLogin: !!e.memberId, role: e.member?.role ?? null, verified: !!e.member?.user.emailVerifiedAt }))} />;
}
