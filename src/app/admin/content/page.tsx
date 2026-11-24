import { prisma } from "@/lib/prisma";
import { requireStaffPage, SUPPORT_STAFF } from "@/lib/platform";
import { aiConfigured } from "@/lib/ai/groq";
import { entries as changelogEntries } from "@/lib/changelog";
import { ContentStudio, type StudioRelease, type StudioTestimonial } from "./studio";

export const maxDuration = 60;
export const metadata = { title: "Content studio" };

export default async function ContentStudioPage() {
  await requireStaffPage(SUPPORT_STAFF);

  const testimonialsRaw = await prisma.testimonial.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      quote: true,
      name: true,
      jobTitle: true,
      company: true,
      rating: true,
      visible: true,
    },
  });

  const releases: StudioRelease[] = changelogEntries.map((e) => ({
    v: e.v,
    date: e.date,
    highlight: e.highlight ?? e.items[0] ?? "",
    items: e.items,
  }));

  const testimonials: StudioTestimonial[] = testimonialsRaw.map((t) => ({
    id: t.id,
    quote: t.quote,
    name: t.name,
    jobTitle: t.jobTitle,
    company: t.company,
    rating: t.rating,
    visible: t.visible,
  }));

  return <ContentStudio releases={releases} testimonials={testimonials} ai={aiConfigured()} />;
}
