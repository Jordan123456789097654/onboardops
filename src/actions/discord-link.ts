"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ALL_STAFF, requireStaff, staffAudit } from "@/lib/platform";
import { enforceRate } from "@/lib/rate-limit";
import { hashCode } from "@/lib/staff-bot";
import { run } from "./_util";

/** Links the signed-in staff member to the Discord account that asked for the code. */
export async function linkDiscordAction(input: unknown) {
  return run(async () => {
    const staff = await requireStaff(ALL_STAFF);
    await enforceRate("discord-link", 8, 900);
    const d = z.object({ code: z.string().trim().min(8).max(12) }).parse(input);
    const row = await prisma.discordLinkCode.findUnique({ where: { codeHash: hashCode(d.code.replace(/[^A-Za-z0-9]/g, "")) } });
    if (!row || row.expiresAt < new Date()) throw new Error("That code is wrong or has expired. Run /link in Discord to get a new one.");
    await prisma.$transaction(async (tx) => {
      await tx.discordLink.deleteMany({ where: { OR: [{ userId: staff.id }, { discordId: row.discordId }] } });
      await tx.discordLink.create({ data: { discordId: row.discordId, userId: staff.id } });
      await tx.discordLinkCode.delete({ where: { id: row.id } });
      await staffAudit(tx, staff, { action: "DISCORD_LINKED", targetType: "User", targetId: staff.id, summary: `${staff.name} linked a Discord account` });
    });
    revalidatePath("/admin/discord");
    return undefined;
  });
}

export async function unlinkDiscordAction() {
  return run(async () => {
    const staff = await requireStaff(ALL_STAFF);
    await prisma.$transaction(async (tx) => {
      await tx.discordLink.deleteMany({ where: { userId: staff.id } });
      await staffAudit(tx, staff, { action: "DISCORD_UNLINKED", targetType: "User", targetId: staff.id, summary: `${staff.name} unlinked their Discord account` });
    });
    revalidatePath("/admin/discord");
    return undefined;
  });
}
