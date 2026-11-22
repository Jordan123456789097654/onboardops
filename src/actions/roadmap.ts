"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { requireStaff, staffAudit, SUPPORT_STAFF } from "@/lib/platform";
import { enforceRate } from "@/lib/rate-limit";
import { run } from "./_util";

/** Staff choose which feedback shows on the public roadmap, and write the public wording. A blank title removes it. */
export async function setRoadmapItemAction(id: string, input: unknown) {
  return run(async () => {
    const staff = await requireStaff(SUPPORT_STAFF);
    const d = z.object({ title: z.string().trim().max(100).default(""), blurb: z.string().trim().max(400).default("") }).parse(input);
    await prisma.$transaction(async (tx) => {
      const r = await tx.supportRequest.findFirst({ where: { id, topic: "Feedback" } });
      if (!r) throw new Error("Feedback item not found.");
      await tx.supportRequest.update({ where: { id }, data: { roadmapTitle: d.title || null, roadmapBlurb: d.title ? d.blurb : null } });
      await staffAudit(tx, staff, { action: d.title ? "ROADMAP_PUBLISHED" : "ROADMAP_UNPUBLISHED", targetType: "Feedback", targetId: id, summary: d.title ? `Roadmap item: ${d.title}` : "Roadmap item removed" });
    });
    revalidatePath("/roadmap");
    revalidatePath("/admin/roadmap");
    return undefined;
  });
}

/** Signed-in users can vote once per item. Voting again removes the vote. */
export async function toggleVoteAction(requestId: string) {
  return run(async () => {
    const user = await getCurrentUser();
    if (!user) throw new Error("Sign in to vote.");
    await enforceRate("vote", 60, 3600);
    const item = await prisma.supportRequest.findFirst({ where: { id: requestId, roadmapTitle: { not: null } }, select: { id: true } });
    if (!item) throw new Error("That item is not on the roadmap.");
    const existing = await prisma.roadmapVote.findUnique({ where: { requestId_userId: { requestId, userId: user.id } } });
    if (existing) await prisma.roadmapVote.delete({ where: { id: existing.id } });
    else await prisma.roadmapVote.create({ data: { requestId, userId: user.id } });
    revalidatePath("/roadmap");
    return { voted: !existing };
  });
}
