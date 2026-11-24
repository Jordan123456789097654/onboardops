"use server";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { ADMIN_ROLES, requireWorkspaceRole } from "@/lib/rbac";
import { hashScimToken } from "@/lib/scim";
import { run } from "./_util";

const done = () => revalidatePath("/app", "layout");

export async function createScimTokenAction(input: { name: string }) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    const d = z
      .object({
        name: z.string().trim().min(2, "Enter a name for this SCIM token (at least 2 characters)").max(80),
      })
      .parse(input);

    const activeCount = await prisma.scimToken.count({
      where: { workspaceId: ctx.workspaceId, revokedAt: null },
    });
    if (activeCount >= 10) {
      throw new Error("You can have at most 10 active SCIM tokens. Revoke an unused token first.");
    }

    const token = `scim_${randomBytes(24).toString("base64url")}`;
    const prefix = token.slice(0, 12);
    const tokenHash = hashScimToken(token);

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.scimToken.create({
        data: {
          workspaceId: ctx.workspaceId,
          name: d.name,
          prefix,
          tokenHash,
          scopes: ["users:write", "groups:write"],
          createdByName: ctx.user.name,
        },
      });

      await writeAudit(tx, {
        workspaceId: ctx.workspaceId,
        actorMemberId: ctx.id,
        actorName: ctx.user.name,
        actionType: "SCIM_TOKEN_CREATED",
        targetType: "ScimToken",
        targetId: row.id,
        summary: `SCIM 2.0 bearer token "${d.name}" created`,
        metadata: { prefix, scopes: row.scopes },
      });

      return row;
    });

    done();
    return {
      id: created.id,
      token,
      prefix: created.prefix,
      name: created.name,
    };
  });
}

export async function revokeScimTokenAction(id: string) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    const tokenId = z.string().trim().min(1, "Missing token ID").max(64).parse(id);

    await prisma.$transaction(async (tx) => {
      const existing = await tx.scimToken.findFirst({
        where: { id: tokenId, workspaceId: ctx.workspaceId, revokedAt: null },
      });
      if (!existing) {
        throw new Error("SCIM token not found or already revoked.");
      }

      await tx.scimToken.update({
        where: { id: tokenId },
        data: { revokedAt: new Date() },
      });

      await writeAudit(tx, {
        workspaceId: ctx.workspaceId,
        actorMemberId: ctx.id,
        actorName: ctx.user.name,
        actionType: "SCIM_TOKEN_REVOKED",
        targetType: "ScimToken",
        targetId: tokenId,
        summary: `SCIM 2.0 bearer token "${existing.name}" revoked`,
        metadata: { prefix: existing.prefix },
      });
    });

    done();
    return undefined;
  });
}
