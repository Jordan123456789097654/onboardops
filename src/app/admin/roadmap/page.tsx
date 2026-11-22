import { prisma } from "@/lib/prisma";
import { requireStaffPage, SUPPORT_STAFF } from "@/lib/platform";
import { Empty, PageHeader } from "@/components/ui";
import { RoadmapEditor } from "./editor";

export const metadata = { title: "Roadmap" };

export default async function AdminRoadmap() {
  await requireStaffPage(SUPPORT_STAFF);
  const rows = await prisma.supportRequest.findMany({ where: { topic: "Feedback" }, orderBy: { createdAt: "desc" }, take: 200 });
  const counts = await prisma.roadmapVote.groupBy({ by: ["requestId"], where: { requestId: { in: rows.map((r) => r.id) } }, _count: true });
  const votes = new Map(counts.map((c) => [c.requestId, c._count]));
  return (
    <>
      <PageHeader title="Public roadmap" sub="Write a public title for a feedback item to show it on /roadmap. Its column comes from its status on the Beta feedback board. Leave the title blank to remove it." />
      {rows.length === 0 ? <Empty title="No feedback yet" /> : <RoadmapEditor rows={rows.map((r) => ({ id: r.id, message: r.message, status: r.boardStatus ?? "NEW", title: r.roadmapTitle ?? "", blurb: r.roadmapBlurb ?? "", votes: votes.get(r.id) ?? 0 }))} />}
    </>
  );
}
