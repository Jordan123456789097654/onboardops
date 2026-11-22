import Link from "next/link";
import { CtaBand, PageShell } from "@/components/page-shell";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { VoteButton } from "./vote-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Roadmap", description: "What OnboardOps is considering, building and has shipped. Beta users can vote on what comes next.", alternates: { canonical: "/roadmap" } };

const groups = [
  { key: "PLANNED", title: "Planned", hint: "We intend to build these." },
  { key: "CONSIDERING", title: "Under consideration", hint: "Vote to tell us what matters." },
  { key: "DONE", title: "Shipped", hint: "Built, thanks to your feedback." },
] as const;

export default async function Roadmap() {
  const uid = await getSessionUserId(false);
  const items = await prisma.supportRequest.findMany({ where: { topic: "Feedback", roadmapTitle: { not: null }, boardStatus: { not: "DECLINED" } }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, roadmapTitle: true, roadmapBlurb: true, boardStatus: true } });
  const ids = items.map((i) => i.id);
  const [counts, mine] = await Promise.all([
    prisma.roadmapVote.groupBy({ by: ["requestId"], where: { requestId: { in: ids } }, _count: true }),
    uid ? prisma.roadmapVote.findMany({ where: { userId: uid, requestId: { in: ids } }, select: { requestId: true } }) : Promise.resolve([]),
  ]);
  const votes = new Map(counts.map((c) => [c.requestId, c._count]));
  const voted = new Set(mine.map((m) => m.requestId));
  const status = (s: string | null) => (s === "PLANNED" ? "PLANNED" : s === "DONE" ? "DONE" : "CONSIDERING");
  return (
    <PageShell eyebrow="Roadmap" title="What we are building next" intro="Chosen from beta feedback. Sign in to vote, and send your own ideas through the feedback button inside the app or the contact page.">
      {items.length === 0 && <p className="text-[13px] text-soft">Nothing is published yet. <Link className="text-accent" href="/contact">Send us an idea</Link>.</p>}
      {groups.map((g) => {
        const list = items.filter((i) => status(i.boardStatus) === g.key).sort((a, b) => (votes.get(b.id) ?? 0) - (votes.get(a.id) ?? 0));
        if (!list.length) return null;
        return (
          <section key={g.key} className="mb-10">
            <h2 className="text-lg font-semibold">{g.title}</h2>
            <p className="text-[13px] text-soft">{g.hint}</p>
            <div className="mt-3 divide-y divide-line border-y border-line">
              {list.map((i) => (
                <div key={i.id} className="flex items-start gap-4 py-3">
                  <div className="min-w-0 flex-1"><div className="text-[14px] font-medium">{i.roadmapTitle}</div>{i.roadmapBlurb && <p className="mt-0.5 text-[13px] text-soft">{i.roadmapBlurb}</p>}</div>
                  {g.key !== "DONE" && <VoteButton id={i.id} votes={votes.get(i.id) ?? 0} voted={voted.has(i.id)} signedIn={!!uid} />}
                </div>
              ))}
            </div>
          </section>
        );
      })}
      <CtaBand />
    </PageShell>
  );
}
