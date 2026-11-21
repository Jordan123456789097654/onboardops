"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { requireWorkspaceRole, ADMIN_ROLES } from "@/lib/rbac";
import { FEATURES } from "@/lib/features";
import { PERM_KEYS } from "@/lib/perms";
import { run } from "./_util";

const done = () => revalidatePath("/app", "layout");

export async function saveFeaturesAction(input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    const raw = z.record(z.boolean()).parse(input);
    const clean: Record<string, boolean> = {};
    for (const f of FEATURES) if (typeof raw[f.key] === "boolean") clean[f.key] = raw[f.key];
    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({ where: { id: ctx.workspaceId }, data: { features: clean } });
      const on = FEATURES.filter((f) => (clean[f.key] ?? f.defaultOn)).length;
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "FEATURES_UPDATED", targetType: "Workspace", targetId: ctx.workspaceId, summary: `Feature toggles updated (${on} of ${FEATURES.length} on)`, metadata: clean });
    });
    done();
    return undefined;
  });
}

const BUILT_IN = ["MANAGER", "SUPERVISOR", "EMPLOYEE"];

export async function saveRolePermsAction(input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    const raw = z.record(z.array(z.string())).parse(input);
    const customIds = (await prisma.customRole.findMany({ where: { workspaceId: ctx.workspaceId }, select: { id: true } })).map((c) => `custom:${c.id}`);
    const clean: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (!BUILT_IN.includes(k) && !customIds.includes(k)) continue;
      clean[k] = v.filter((p) => PERM_KEYS.includes(p));
    }
    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({ where: { id: ctx.workspaceId }, data: { rolePerms: clean } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "ROLE_PERMISSIONS_UPDATED", targetType: "Workspace", targetId: ctx.workspaceId, summary: "Role permissions updated", metadata: clean });
    });
    done();
    return undefined;
  });
}

const roleSchema = z.object({ id: z.string().optional(), name: z.string().trim().min(2, "Name the role").max(40), description: z.string().trim().max(200).default(""), baseRole: z.enum(["EMPLOYEE", "SUPERVISOR", "MANAGER"]) });

export async function saveCustomRoleAction(input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    const d = roleSchema.parse(input);
    if (["owner", "admin", "manager", "supervisor", "employee"].includes(d.name.toLowerCase())) throw new Error("That name is already used by a built-in role.");
    await prisma.$transaction(async (tx) => {
      const dup = await tx.customRole.findFirst({ where: { workspaceId: ctx.workspaceId, name: d.name, ...(d.id ? { id: { not: d.id } } : {}) } });
      if (dup) throw new Error("You already have a role with that name.");
      if (d.id) {
        if (!(await tx.customRole.findFirst({ where: { id: d.id, workspaceId: ctx.workspaceId } }))) throw new Error("Role not found.");
        await tx.customRole.update({ where: { id: d.id }, data: { name: d.name, description: d.description, baseRole: d.baseRole } });
      } else {
        await tx.customRole.create({ data: { workspaceId: ctx.workspaceId, name: d.name, description: d.description, baseRole: d.baseRole } });
      }
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: d.id ? "CUSTOM_ROLE_UPDATED" : "CUSTOM_ROLE_CREATED", targetType: "Workspace", targetId: ctx.workspaceId, summary: `Custom role "${d.name}" ${d.id ? "updated" : "created"} (base: ${d.baseRole})` });
    });
    done();
    return undefined;
  });
}

export async function deleteCustomRoleAction(id: string) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    await prisma.$transaction(async (tx) => {
      const r = await tx.customRole.findFirst({ where: { id, workspaceId: ctx.workspaceId }, include: { _count: { select: { members: true } } } });
      if (!r) throw new Error("Role not found.");
      if (r._count.members) throw new Error(`${r._count.members} member(s) still have this role. Change their role first.`);
      await tx.customRole.delete({ where: { id } });
      const ws = await tx.workspace.findUnique({ where: { id: ctx.workspaceId } });
      const rp = { ...((ws?.rolePerms as Record<string, string[]>) ?? {}) };
      delete rp[`custom:${id}`];
      await tx.workspace.update({ where: { id: ctx.workspaceId }, data: { rolePerms: rp } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "CUSTOM_ROLE_DELETED", targetType: "Workspace", targetId: ctx.workspaceId, summary: `Custom role "${r.name}" deleted` });
    });
    done();
    return undefined;
  });
}

/** Gives a member a custom role, or returns them to the built-in role they had (pass null and a built-in role). */
export async function setMemberRoleAction(memberId: string, input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ADMIN_ROLES);
    const d = z.object({ role: z.enum(["ADMIN", "MANAGER", "SUPERVISOR", "EMPLOYEE"]).optional(), customRoleId: z.string().nullable().optional() }).parse(input);
    await prisma.$transaction(async (tx) => {
      const m = await tx.workspaceMember.findFirst({ where: { id: memberId, workspaceId: ctx.workspaceId }, include: { user: true } });
      if (!m) throw new Error("Member not found.");
      if (m.role === "OWNER") throw new Error("The owner's role cannot be changed.");
      if (d.customRoleId) {
        const cr = await tx.customRole.findFirst({ where: { id: d.customRoleId, workspaceId: ctx.workspaceId } });
        if (!cr) throw new Error("Role not found.");
        await tx.workspaceMember.update({ where: { id: memberId }, data: { customRoleId: cr.id, role: cr.baseRole } });
        await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "MEMBER_ROLE_CHANGED", targetType: "Member", targetId: memberId, summary: `${m.user.name}: ${m.role} → custom role "${cr.name}"` });
      } else if (d.role) {
        if (d.role === "ADMIN" && ctx.role !== "OWNER") throw new Error("Only the owner can promote to admin.");
        await tx.workspaceMember.update({ where: { id: memberId }, data: { role: d.role, customRoleId: null } });
        await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "MEMBER_ROLE_CHANGED", targetType: "Member", targetId: memberId, summary: `${m.user.name}: ${m.role} → ${d.role}` });
      }
    });
    done();
    return undefined;
  });
}
