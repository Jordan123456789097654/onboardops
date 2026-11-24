"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enforceRate } from "@/lib/rate-limit";
import { run } from "./_util";

const KINDS = {
  FEEDBACK: { topic: "Feedback", label: "Feedback" },
  NPS: { topic: "Survey", label: "Recommendation survey" },
  STORY: { topic: "Customer story", label: "Customer story" },
  LEAVING: { topic: "Leaving", label: "Why they left" },
} as const;

/** Public feedback, survey, story and leaving forms. Anonymous allowed, rate limited, and lands on the staff Beta feedback board. */
export async function submitSurveyAction(input: unknown) {
  return run(async () => {
    await enforceRate("survey", 8, 3600);
    const d = z.object({
      kind: z.enum(["FEEDBACK", "NPS", "STORY", "LEAVING"]),
      score: z.number().int().min(0).max(10).optional(),
      message: z.string().trim().max(3000).default(""),
      name: z.string().trim().max(100).default(""),
      email: z.union([z.literal(""), z.string().trim().toLowerCase().email().max(200)]).default(""),
      canQuote: z.boolean().optional(),
      website: z.string().max(0).optional(),
    }).parse(input);
    if (d.kind === "NPS" && d.score === undefined) throw new Error("Pick a number from 0 to 10.");
    if (d.kind !== "NPS" && d.message.length < 3) throw new Error("Please write a few words.");
    if (d.kind === "STORY" && !d.email) throw new Error("We need your email so we can follow up before sharing anything.");
    const k = KINDS[d.kind];
    const lines = [`${k.label}${d.kind === "NPS" ? `: ${d.score}/10 (0 = not likely, 10 = very likely)` : ""}`];
    if (d.message) lines.push("", d.message);
    if (d.kind === "STORY") lines.push("", d.canQuote ? "They said we may quote this once we have confirmed the wording with them." : "They did NOT give permission to quote this.");
    await prisma.supportRequest.create({
      data: { name: d.name || "Survey respondent", email: d.email || "anonymous@survey.onboardops.org", topic: k.topic, source: "SURVEY", boardStatus: "NEW", message: lines.join("\n") },
    });
    return undefined;
  });
}
