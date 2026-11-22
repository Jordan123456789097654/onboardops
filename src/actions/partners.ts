"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { enforceRate } from "@/lib/rate-limit";
import { requireStaff, staffAudit, SUPPORT_STAFF } from "@/lib/platform";
import { subdomainAvailable } from "@/lib/subdomain";
import { run } from "./_util";

/** Staff create a referral code for a partner. Signups made through ?ref=code are counted, with no reward attached yet. */
export async function createPartnerAction(input: unknown) {
  return run(async () => {
    const staff = await requireStaff(SUPPORT_STAFF);
    const d = z.object({ code: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{3,30}$/, "Use 3 to 30 letters, numbers or hyphens"), name: z.string().trim().min(2).max(100), contact: z.string().trim().max(200).default("") }).parse(input);
    if (await prisma.partner.findUnique({ where: { code: d.code } })) throw new Error("That code is already used.");
    await prisma.$transaction(async (tx) => {
      const p = await tx.partner.create({ data: d });
      await staffAudit(tx, staff, { action: "PARTNER_CREATED", targetType: "Partner", targetId: p.id, summary: `Partner "${d.name}" created with code ${d.code}` });
    });
    revalidatePath("/admin/partners");
    return undefined;
  });
}

export async function deletePartnerAction(id: string) {
  return run(async () => {
    const staff = await requireStaff(["OWNER"]);
    await prisma.$transaction(async (tx) => {
      const p = await tx.partner.delete({ where: { id } });
      await staffAudit(tx, staff, { action: "PARTNER_DELETED", targetType: "Partner", targetId: id, summary: `Partner "${p.name}" deleted` });
    });
    revalidatePath("/admin/partners");
    return undefined;
  });
}

/** Public: is name.onboardops.org free? Nothing is reserved. Rate limited. */
export async function checkAddressPublicAction(slug: string) {
  return run(async () => {
    await enforceRate("addrcheck", 40, 600);
    const r = await subdomainAvailable(String(slug ?? "").slice(0, 60));
    return r.ok ? { available: true as const, slug: r.slug, error: "" } : { available: false as const, slug: "", error: r.error };
  });
}
