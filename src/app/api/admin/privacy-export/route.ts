import { prisma } from "@/lib/prisma";
import { getStaff, staffAudit, SUPPORT_STAFF } from "@/lib/platform";

export const dynamic = "force-dynamic";

/** Account-level data for a privacy access request. Does not include employer-held employee records. */
export async function GET(req: Request) {
  const staff = await getStaff();
  if (!staff || !SUPPORT_STAFF.includes(staff.role)) return new Response("Forbidden", { status: 403 });
  const email = new URL(req.url).searchParams.get("email")?.toLowerCase().trim();
  if (!email) return new Response("email required", { status: 400 });
  const user = await prisma.user.findUnique({ where: { email }, include: { memberships: { include: { workspace: { select: { name: true, slug: true } } } } } });
  const [requests, emails, profiles] = await Promise.all([
    prisma.supportRequest.findMany({ where: { email }, include: { messages: { where: { kind: "REPLY" } } } }),
    prisma.emailLog.findMany({ where: { OR: [{ to: email }, { redirectedFrom: email }] }, select: { subject: true, kind: true, status: true, createdAt: true } }),
    prisma.employeeProfile.findMany({ where: { email }, select: { staffCode: true, fullName: true, workspace: { select: { name: true } } } }),
  ]);
  await staffAudit(prisma, staff, { action: "PRIVACY_EXPORT", targetType: "User", targetId: user?.id ?? email, summary: `Exported account data for ${email}` });
  const body = {
    exportedAt: new Date().toISOString(),
    notice: "Account-level data only. Records an employer keeps about an employee (training, discipline, reviews) belong to the employer; the employee should request those from them.",
    account: user ? { name: user.name, email: user.email, createdAt: user.createdAt, memberships: user.memberships.map((m) => ({ workspace: m.workspace.name, role: m.role, since: m.createdAt })) } : null,
    employeeProfilesAtEmployers: profiles.map((p) => ({ employer: p.workspace.name, staffCode: p.staffCode, name: p.fullName })),
    supportRequests: requests, emailsSent: emails,
  };
  return new Response(JSON.stringify(body, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="account-data-${email.replace(/[^a-z0-9]/g, "_")}.json"`, "Cache-Control": "no-store" } });
}
