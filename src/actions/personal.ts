"use server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceRole, ALL_ROLES } from "@/lib/rbac";
import { hasSmsConfig, loadSmsConfig, sendSms, toE164 } from "@/lib/sms";
import { enforceRate } from "@/lib/rate-limit";
import { run } from "./_util";

const done = () => revalidatePath("/app/my-portal");

/** A new random token each time, so regenerating immediately invalidates the old link. Pass remove to switch the feed off. */
export async function setCalendarFeedAction(remove = false) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ALL_ROLES);
    if (!ctx.profile) throw new Error("No employee profile is linked to your login.");
    await prisma.employeeProfile.update({ where: { id: ctx.profile.id }, data: { calendarToken: remove ? null : randomBytes(20).toString("hex") } });
    done();
    return undefined;
  });
}

export async function setSmsOptInAction(input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ALL_ROLES);
    if (!ctx.profile) throw new Error("No employee profile is linked to your login.");
    const d = z.object({ optIn: z.boolean(), phone: z.string().trim().max(40).default("") }).parse(input);
    if (d.optIn) {
      if (!hasSmsConfig(ctx.workspace)) throw new Error("Your employer has not set up text messages.");
      if (!toE164(d.phone)) throw new Error("Enter a valid mobile number.");
    }
    await prisma.employeeProfile.update({ where: { id: ctx.profile.id }, data: { smsOptIn: d.optIn, ...(d.optIn ? { phone: d.phone } : {}) } });
    done();
    return undefined;
  });
}

export async function sendTestTextAction() {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ALL_ROLES);
    await enforceRate("sms-test", 3, 3600);
    const p = ctx.profile;
    if (!p?.smsOptIn || !p.phone) throw new Error("Turn on texts and save your number first.");
    const cfg = await loadSmsConfig(ctx.workspaceId);
    if (!cfg) throw new Error("Your employer has not set up text messages.");
    const r = await sendSms(cfg, p.phone, `OnboardOps: this is a test text for ${ctx.workspace.name}.`);
    if (!r.ok) throw new Error(r.error ?? "The text could not be sent.");
    return undefined;
  });
}
