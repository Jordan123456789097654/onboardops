"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { requireWorkspaceRole, STAFF_ROLES, MANAGEMENT_ROLES, ALL_ROLES, requireFeature } from "@/lib/rbac";
import { textEmployee } from "@/lib/sms";
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

/* Employee asks to swap or give up one of their shifts; managers approve or deny. */
export async function requestShiftSwapAction(shiftId: string, input: unknown) {
  return run(async () => {
    const ctx = await requireFeature("scheduling");
    const me = ctx.profile;
    if (!me) throw new Error("No employee profile is linked to your login.");
    const d = z.object({ toId: z.string().optional().or(z.literal("")), note: z.string().trim().max(500).default("") }).parse(input);
    const s = await prisma.shift.findFirst({ where: { id: shiftId, workspaceId: ctx.workspaceId, employeeId: me.id, startsAt: { gt: new Date() } } });
    if (!s) throw new Error("Shift not found or already started.");
    if (s.swapStatus === "PENDING") throw new Error("A swap is already pending for this shift.");
    if (d.toId) {
      const t = await prisma.employeeProfile.findFirst({ where: { id: d.toId, workspaceId: ctx.workspaceId, status: "ACTIVE" } });
      if (!t) throw new Error("Choose an active coworker.");
    }
    await prisma.$transaction(async (tx) => {
      await tx.shift.update({ where: { id: shiftId }, data: { swapStatus: "PENDING", swapToId: d.toId || null, swapNote: d.note } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "SHIFT_SWAP_REQUESTED", targetType: "Shift", targetId: shiftId, summary: `${me.staffCode} requested a shift swap` });
    });
    done();
    return undefined;
  });
}

export async function decideShiftSwapAction(shiftId: string, input: unknown) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(MANAGEMENT_ROLES);
    const d = z.object({ decision: z.enum(["APPROVED", "DENIED"]) }).parse(input);
    await prisma.$transaction(async (tx) => {
      const s = await tx.shift.findFirst({ where: { id: shiftId, workspaceId: ctx.workspaceId, swapStatus: "PENDING" } });
      if (!s) throw new Error("No pending swap on this shift.");
      await tx.shift.update({ where: { id: shiftId }, data: d.decision === "APPROVED" ? { employeeId: s.swapToId, swapStatus: "APPROVED", swapToId: null } : { swapStatus: "DENIED" } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: `SHIFT_SWAP_${d.decision}`, targetType: "Shift", targetId: shiftId, summary: `Shift swap ${d.decision.toLowerCase()}` });
    });
    const s3 = await prisma.shift.findUnique({ where: { id: shiftId } });
    if (s3?.employeeId) await textEmployee(ctx.workspaceId, s3.employeeId, d.decision === "APPROVED" ? "Your shift swap was approved." : "Your shift swap request was denied.");
    done();
    return undefined;
  });
}

/* Drag-and-drop scheduling */
export async function assignShiftAction(shiftId: string, employeeId: string | null) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(MANAGEMENT_ROLES);
    await prisma.$transaction(async (tx) => {
      const s = await tx.shift.findFirst({ where: { id: shiftId, workspaceId: ctx.workspaceId } });
      if (!s) throw new Error("Shift not found.");
      if (employeeId) {
        const e = await tx.employeeProfile.findFirst({ where: { id: employeeId, workspaceId: ctx.workspaceId, status: { not: "TERMINATED" } } });
        if (!e) throw new Error("Employee not found.");
        const clash = await tx.shift.findFirst({ where: { workspaceId: ctx.workspaceId, employeeId, id: { not: shiftId }, startsAt: { lt: s.endsAt }, endsAt: { gt: s.startsAt } } });
        if (clash) throw new Error(`${e.fullName} already has a shift at that time.`);
      }
      await tx.shift.update({ where: { id: shiftId }, data: { employeeId, swapStatus: null, swapToId: null } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "SHIFT_ASSIGNED", targetType: "Shift", targetId: shiftId, summary: employeeId ? "Shift assigned" : "Shift set to open" });
    });
    if (employeeId) {
      const s2 = await prisma.shift.findUnique({ where: { id: shiftId } });
      if (s2) await textEmployee(ctx.workspaceId, employeeId, `New shift: ${s2.label || "Shift"} on ${s2.startsAt.toUTCString().slice(0, 22)} UTC.`);
    }
    done();
    return undefined;
  });
}

export async function moveShiftAction(shiftId: string, dayDelta: number) {
  return run(async () => {
    const ctx = await requireWorkspaceRole(MANAGEMENT_ROLES);
    const delta = z.number().int().min(-60).max(60).parse(dayDelta);
    if (delta === 0) return undefined;
    await prisma.$transaction(async (tx) => {
      const s = await tx.shift.findFirst({ where: { id: shiftId, workspaceId: ctx.workspaceId } });
      if (!s) throw new Error("Shift not found.");
      const startsAt = new Date(s.startsAt.getTime() + delta * 86400000);
      const endsAt = new Date(s.endsAt.getTime() + delta * 86400000);
      if (s.employeeId) {
        const clash = await tx.shift.findFirst({ where: { workspaceId: ctx.workspaceId, employeeId: s.employeeId, id: { not: shiftId }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } } });
        if (clash) throw new Error("That would double-book the employee.");
      }
      await tx.shift.update({ where: { id: shiftId }, data: { startsAt, endsAt } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "SHIFT_MOVED", targetType: "Shift", targetId: shiftId, summary: `Shift moved ${delta > 0 ? "+" : ""}${delta} day(s)` });
    });
    done();
    return undefined;
  });
}
