"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { requireWorkspaceRole, STAFF_ROLES, MANAGEMENT_ROLES, ALL_ROLES, requireFeature } from "@/lib/rbac";
import { run } from "./_util";

const done = () => revalidatePath("/app", "layout");

/* ---------------- Shift Handoff Notes ---------------- */
export async function createHandoffNoteAction(input: unknown) {
  return run(async () => {
    const ctx = await requireFeature("handoff");
    const d = z.object({ departmentId: z.string().optional().or(z.literal("")), body: z.string().trim().min(3, "Write a handoff note").max(4000) }).parse(input);
    await prisma.$transaction(async (tx) => {
      const note = await tx.handoffNote.create({
        data: {
          workspaceId: ctx.workspaceId,
          departmentId: d.departmentId || null,
          authorName: ctx.user.name,
          body: d.body,
        },
      });
      await writeAudit(tx, {
        workspaceId: ctx.workspaceId,
        actorMemberId: ctx.id,
        actorName: ctx.user.name,
        actionType: "HANDOFF_NOTE_ADDED",
        targetType: "HandoffNote",
        targetId: note.id,
        summary: `Handoff note posted by ${ctx.user.name}`,
      });
    });
    done();
    return undefined;
  });
}

export async function deleteHandoffNoteAction(id: string) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(MANAGEMENT_ROLES);
    await prisma.handoffNote.deleteMany({ where: { id, workspaceId: ctx.workspaceId } });
    done();
    return undefined;
  });
}

/* ---------------- Shift Scheduling & Swaps ---------------- */
export async function createShiftAction(input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(MANAGEMENT_ROLES);
    const d = z
      .object({
        employeeId: z.string().optional().or(z.literal("")),
        departmentId: z.string().optional().or(z.literal("")),
        startsAt: z.string().min(1, "Select start time"),
        endsAt: z.string().min(1, "Select end time"),
        label: z.string().trim().max(120).default(""),
        notes: z.string().trim().max(1000).default(""),
      })
      .parse(input);
    const start = new Date(d.startsAt);
    const end = new Date(d.endsAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new Error("Enter valid start and end times.");
    if (end <= start) throw new Error("Shift end time must be after start time.");
    await prisma.$transaction(async (tx) => {
      const s = await tx.shift.create({
        data: {
          workspaceId: ctx.workspaceId,
          employeeId: d.employeeId || null,
          departmentId: d.departmentId || null,
          startsAt: start,
          endsAt: end,
          label: d.label,
          notes: d.notes,
        },
      });
      await writeAudit(tx, {
        workspaceId: ctx.workspaceId,
        actorMemberId: ctx.id,
        actorName: ctx.user.name,
        actionType: "SHIFT_CREATED",
        targetType: "Shift",
        targetId: s.id,
        summary: `Shift scheduled (${d.label || start.toISOString().slice(0, 10)})`,
      });
    });
    done();
    return undefined;
  });
}

export async function deleteShiftAction(id: string) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(MANAGEMENT_ROLES);
    await prisma.shift.deleteMany({ where: { id, workspaceId: ctx.workspaceId } });
    done();
    return undefined;
  });
}

/* ---------------- Time Clock & Timesheets ---------------- */
export async function clockInAction(input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ALL_ROLES);
    const d = z.object({ employeeId: z.string().optional(), note: z.string().trim().max(500).default("") }).parse(input ?? {});
    const empId = d.employeeId && MANAGEMENT_ROLES.includes(ctx.role) ? d.employeeId : ctx.profile?.id;
    if (!empId) throw new Error("Select an employee or link an employee profile to your account.");
    const open = await prisma.timeEntry.findFirst({ where: { workspaceId: ctx.workspaceId, employeeId: empId, clockOut: null } });
    if (open) throw new Error("Already clocked in. Clock out first.");
    await prisma.timeEntry.create({
      data: {
        workspaceId: ctx.workspaceId,
        employeeId: empId,
        clockIn: new Date(),
        note: d.note,
      },
    });
    done();
    return undefined;
  });
}

export async function clockOutAction(entryId: string, noteInput?: string) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(ALL_ROLES);
    const entry = await prisma.timeEntry.findFirst({ where: { id: entryId, workspaceId: ctx.workspaceId } });
    if (!entry) throw new Error("Time entry not found.");
    if (!MANAGEMENT_ROLES.includes(ctx.role) && entry.employeeId !== ctx.profile?.id) throw new Error("You can only clock out your own shift.");
    await prisma.timeEntry.update({
      where: { id: entryId },
      data: { clockOut: new Date(), ...(noteInput ? { note: noteInput } : {}) },
    });
    done();
    return undefined;
  });
}

export async function deleteTimeEntryAction(id: string) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(MANAGEMENT_ROLES);
    await prisma.timeEntry.deleteMany({ where: { id, workspaceId: ctx.workspaceId } });
    done();
    return undefined;
  });
}

/* ---------------- Equipment / Asset Sign-Out ---------------- */
export async function saveAssetAction(input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(STAFF_ROLES);
    const d = z
      .object({
        name: z.string().trim().min(2, "Enter equipment name").max(120),
        tag: z.string().trim().min(1, "Enter an asset tag or ID").max(60),
        category: z.string().trim().min(1).max(60).default("Equipment"),
      })
      .parse(input);
    const exists = await prisma.asset.findFirst({ where: { workspaceId: ctx.workspaceId, tag: d.tag } });
    if (exists) throw new Error(`Tag "${d.tag}" is already in use.`);
    await prisma.$transaction(async (tx) => {
      const a = await tx.asset.create({ data: { workspaceId: ctx.workspaceId, name: d.name, tag: d.tag, category: d.category } });
      await writeAudit(tx, {
        workspaceId: ctx.workspaceId,
        actorMemberId: ctx.id,
        actorName: ctx.user.name,
        actionType: "ASSET_CREATED",
        targetType: "Asset",
        targetId: a.id,
        summary: `Equipment "${d.name}" (${d.tag}) added`,
      });
    });
    done();
    return undefined;
  });
}

export async function checkoutAssetAction(input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(STAFF_ROLES);
    const d = z.object({ assetId: z.string(), employeeId: z.string(), condition: z.string().trim().max(300).default("") }).parse(input);
    const open = await prisma.assetCheckout.findFirst({ where: { assetId: d.assetId, inAt: null } });
    if (open) throw new Error("This item is already signed out. Check it back in first.");
    await prisma.assetCheckout.create({
      data: { assetId: d.assetId, employeeId: d.employeeId, condition: d.condition },
    });
    done();
    return undefined;
  });
}

export async function returnAssetAction(checkoutId: string, condition?: string) {
  return run(async () => {
    await requireWorkspaceRole(STAFF_ROLES);
    await prisma.assetCheckout.update({
      where: { id: checkoutId },
      data: { inAt: new Date(), ...(condition ? { condition } : {}) },
    });
    done();
    return undefined;
  });
}

export async function deleteAssetAction(id: string) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(MANAGEMENT_ROLES);
    await prisma.asset.deleteMany({ where: { id, workspaceId: ctx.workspaceId } });
    done();
    return undefined;
  });
}
