import { prisma } from "@/lib/prisma";
import { requireStaffPage, SUPPORT_STAFF } from "@/lib/platform";
import { PageHeader } from "@/components/ui";
import { TestimonialsAdmin } from "./testimonials-admin";

export const metadata = { title: "Testimonials" };
export const dynamic = "force-dynamic";

export default async function AdminTestimonials() {
  const staff = await requireStaffPage(SUPPORT_STAFF);
  const rows = await prisma.testimonial
    .findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, quote: true, name: true, jobTitle: true, company: true, rating: true, visible: true, photoMime: true, updatedAt: true } })
    .catch(() => null);
  return (
    <>
      <PageHeader title="Testimonials" sub="Quotes shown on the homepage, right after the customer logos. Only visible ones are public. Add a quote only with the person's permission." />
      {rows === null ? (
        <div className="card border-amber-400/50 bg-amber-500/5 p-4 text-[13px]"><b>The testimonials table is not in the database yet.</b> Run <span className="mono">npx prisma db push</span> against the production database, then reload this page.</div>
      ) : (
        <TestimonialsAdmin canEdit={staff.role === "OWNER"} items={rows.map((r) => ({ id: r.id, quote: r.quote, name: r.name, jobTitle: r.jobTitle, company: r.company, rating: r.rating, visible: r.visible, photoUrl: r.photoMime ? `/api/testimonial-photo/${r.id}?v=${r.updatedAt.getTime()}` : null }))} />
      )}
    </>
  );
}
