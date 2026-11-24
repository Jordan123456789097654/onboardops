"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceRole, ADMIN_ROLES } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { parseLogoDataUrl, workspaceLogoUrl } from "@/lib/logo";
import { run, type Result } from "./_util";

/** Saves or replaces the active workspace's logo (Owner / Admin only). */
export async function saveWorkspaceLogoAction(dataUrl: string): Promise<Result<{ logoUrl: string }>> {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    const { data, mime } = parseLogoDataUrl(dataUrl);
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({
        where: { id: ctx.workspaceId },
        data: {
          logoData: data,
          logoMime: mime,
          logoUpdatedAt: now,
        },
      });
      await writeAudit(tx, {
        workspaceId: ctx.workspaceId,
        actorMemberId: ctx.id,
        actorName: ctx.user.name,
        actionType: "WORKSPACE_LOGO_UPDATED",
        targetType: "Workspace",
        targetId: ctx.workspaceId,
        summary: `${ctx.user.name} updated the workspace logo`,
        metadata: { mime, bytes: data.length },
      });
    });

    revalidatePath("/app", "layout");
    revalidatePath("/app/settings");
    revalidatePath("/app/setup");
    revalidatePath(`/w/${ctx.workspace.slug}`);

    return { logoUrl: workspaceLogoUrl({ id: ctx.workspaceId, logoUpdatedAt: now })! };
  });
}
