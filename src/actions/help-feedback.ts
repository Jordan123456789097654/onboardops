"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enforceRate } from "@/lib/rate-limit";
import { articles } from "@/lib/docs";
import { run } from "./_util";

/** "Was this helpful?" on a help article. Anonymous, rate limited, and lands on the staff Beta feedback board. */
export async function helpfulAction(input: unknown) {
  return run(async () => {
    await enforceRate("helpful", 10, 3600);
    const d = z.object({ slug: z.string().max(100), helpful: z.boolean(), comment: z.string().trim().max(600).default(""), website: z.string().max(0).optional() }).parse(input);
    const a = articles.find((x) => x.slug === d.slug);
    if (!a) throw new Error("Article not found.");
    await prisma.supportRequest.create({ data: { name: "Help article reader", email: "anonymous@help.onboardops.org", topic: "Feedback", source: "HELP", boardStatus: "NEW", message: `Help article "${a.title}" (/support/${a.slug}): ${d.helpful ? "helpful" : "NOT helpful"}${d.comment ? `\n\n${d.comment}` : ""}` } });
    return undefined;
  });
}
