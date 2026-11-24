import { prisma } from "@/lib/prisma";
import { requireStaffPage, SUPPORT_STAFF } from "@/lib/platform";
import { PageHeader } from "@/components/ui";
import { NewsletterEditor, type IssueRow, type SubRow } from "./editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Newsletter" };

export default async function AdminNewsletter() {
  const staff = await requireStaffPage(SUPPORT_STAFF);
  const [posts, counts, subs] = await Promise.all([
    prisma.newsletterPost.findMany({ orderBy: [{ createdAt: "desc" }], take: 200 }).catch(() => null),
    prisma.newsletterSubscriber.groupBy({ by: ["status"], _count: { _all: true } }).catch(() => null),
    prisma.newsletterSubscriber.findMany({ orderBy: { createdAt: "desc" }, take: 100 }).catch(() => []),
  ]);
  if (!posts || !counts) {
    return (
      <>
        <PageHeader title="Newsletter" />
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-[13px] text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">The newsletter tables don&apos;t exist in the database yet. Run <code className="mono">npx prisma db push</code> and reload this page.</p>
      </>
    );
  }
  const c = Object.fromEntries(counts.map((x) => [x.status, x._count._all]));
  const issues: IssueRow[] = posts.map((p) => ({ id: p.id, slug: p.slug, title: p.title, summary: p.summary, category: p.category, body: p.body, status: p.status, publishedAt: p.publishedAt?.toISOString() ?? null, sentAt: p.sentAt?.toISOString() ?? null, sentTo: p.sentTo, sentFailed: p.sentFailed }));
  const subRows: SubRow[] = subs.map((s) => ({ id: s.id, email: s.email, status: s.status, at: s.createdAt.toISOString() }));
  return (
    <>
      <PageHeader title="Newsletter" sub="Write issues, publish them on the website, and email the bigger ones. Publishing and emailing are separate steps, and most issues only need the first." />
      <NewsletterEditor issues={issues} subscribers={subRows} counts={{ active: c.ACTIVE ?? 0, pending: c.PENDING ?? 0, unsubscribed: c.UNSUBSCRIBED ?? 0 }} isOwner={staff.role === "OWNER"} />
    </>
  );
}
