import { prisma } from "@/lib/prisma";
import { requireStaffPage, OWNER_ONLY } from "@/lib/platform";
import { resolvePlatformRole } from "@/lib/platform-role";
import { StaffManager } from "./manager";

export const metadata = { title: "Staff & roles" };

export default async function StaffPage() {
  const me = await requireStaffPage(OWNER_ONLY);
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true, platformRole: true, emailVerifiedAt: true } });
  const staff = users.map((u) => ({ ...u, role: resolvePlatformRole(u), bootstrap: (process.env.PLATFORM_OWNER_EMAILS || "").toLowerCase().split(",").map((s) => s.trim()).includes(u.email.toLowerCase()) })).filter((u) => u.role);
  return <StaffManager me={me.email} staff={staff.map((s) => ({ id: s.id, name: s.name, email: s.email, role: s.role as string, bootstrap: s.bootstrap }))} />;
}
