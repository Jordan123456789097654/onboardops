import { prisma } from "@/lib/prisma";
import { requireStaffPage, SUPPORT_STAFF } from "@/lib/platform";
import { Privacy } from "./privacy";

export const metadata = { title: "Privacy requests" };

export default async function PrivacyPage() {
  const staff = await requireStaffPage(SUPPORT_STAFF);
  const rows = await prisma.supportRequest.findMany({ where: { topic: "Privacy request" }, include: { messages: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "asc" } });
  return <Privacy isOwner={staff.role === "OWNER"} rows={rows.map((r) => ({ id: r.id, ref: r.id.slice(-8).toUpperCase(), name: r.name, email: r.email, message: r.message, status: r.status, at: r.createdAt.toISOString(), due: new Date(r.createdAt.getTime() + 45 * 86400000).toISOString(), replies: r.messages.filter((m) => m.kind === "REPLY").length }))} />;
}
