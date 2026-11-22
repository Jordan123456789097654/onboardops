import { prisma } from "@/lib/prisma";
import { requireStaffPage, SUPPORT_STAFF } from "@/lib/platform";
import { PageHeader } from "@/components/ui";
import { PartnersAdmin } from "./partners-admin";

export const metadata = { title: "Partners" };

export default async function AdminPartners() {
  const staff = await requireStaffPage(SUPPORT_STAFF);
  const partners = await prisma.partner.findMany({ orderBy: { createdAt: "desc" } });
  const counts = await prisma.workspace.groupBy({ by: ["referralCode"], where: { referralCode: { not: null } }, _count: true });
  const n = new Map(counts.map((c) => [c.referralCode, c._count]));
  return (
    <>
      <PageHeader title="Partners and referrals" sub="Give a partner a code. Anyone who signs up through yoursite?ref=code is counted here. No rewards are attached yet." />
      <PartnersAdmin isOwner={staff.role === "OWNER"} partners={partners.map((p) => ({ id: p.id, code: p.code, name: p.name, contact: p.contact, signups: n.get(p.code) ?? 0 }))} />
    </>
  );
}
