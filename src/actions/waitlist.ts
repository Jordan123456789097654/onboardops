"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enforceRate } from "@/lib/rate-limit";
import { run } from "./_util";

/** Public waitlist for people who are not ready to create a workspace. We store only the email address. */
export async function joinWaitlistAction(input: unknown) {
  return run(async () => {
    await enforceRate("waitlist", 5, 3600);
    const d = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200), website: z.string().max(0).optional() }).parse(input);
    await prisma.waitlistEntry.upsert({ where: { email: d.email }, create: { email: d.email, source: "home" }, update: {} });
    return undefined;
  });
}
