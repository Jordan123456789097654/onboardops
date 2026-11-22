import { prisma } from "@/lib/prisma";
import { requireStaffPage, SUPPORT_STAFF } from "@/lib/platform";
import { PageHeader } from "@/components/ui";
import { CareersAdmin } from "./careers-admin";

export const metadata = { title: "Careers" };

export default async function AdminCareers() {
  const staff = await requireStaffPage(SUPPORT_STAFF);
  const [postings, apps] = await Promise.all([
    prisma.jobPosting.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { applications: true } } } }),
    prisma.jobApplication.findMany({ orderBy: { createdAt: "desc" }, take: 300, include: { posting: { select: { title: true } } } }),
  ]);
  return (
    <>
      <PageHeader title="Careers" sub="Create job postings, which appear on the public Careers page while open, and review applications and introductions." />
      <CareersAdmin
        isOwner={staff.role === "OWNER"}
        postings={postings.map((p) => ({ id: p.id, title: p.title, team: p.team, location: p.location, type: p.type, description: p.description, status: p.status, applications: p._count.applications }))}
        apps={apps.map((a) => ({ id: a.id, name: a.name, email: a.email, link: a.link, message: a.message, status: a.status, notes: a.notes, at: a.createdAt.toISOString(), posting: a.posting?.title ?? "General introduction" }))}
      />
    </>
  );
}
