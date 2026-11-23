"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { auditUser } from "@/lib/mfa";
import { canUnlink, parseProvider, providerLabel } from "@/lib/oauth";
import { run, type Result } from "./_util";

/** Disconnects Google or GitHub from the signed-in account, unless it is the only way they can sign in. */
export async function unlinkOAuthAction(input: unknown): Promise<Result> {
  return run(async () => {
    const u = await getCurrentUser();
    if (!u) throw new Error("Sign in first.");
    const provider = parseProvider(z.object({ provider: z.string() }).parse(input).provider);
    if (!provider) throw new Error("Unknown provider.");
    const row = await prisma.oAuthAccount.findUnique({ where: { userId_provider: { userId: u.id, provider } } });
    if (!row) throw new Error(`${providerLabel[provider]} is not connected.`);
    const can = await canUnlink(u.id, provider);
    if (!can.ok) throw new Error(can.reason);
    await prisma.oAuthAccount.delete({ where: { id: row.id } });
    await auditUser(u.id, u.name, "OAUTH_UNLINKED", `${u.name} disconnected ${providerLabel[provider]}`);
    revalidatePath("/account");
    return undefined;
  });
}
