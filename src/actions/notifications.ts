"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceRole, ALL_ROLES } from "@/lib/rbac";
import { run } from "./_util";

export async function markNotificationsReadAction(ids?: string[]) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ALL_ROLES);
    await prisma.notification.updateMany({
      where: { memberId: ctx.id, readAt: null, ...(ids?.length ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() },
    });
    revalidatePath("/app", "layout");
    return undefined;
  });
}
