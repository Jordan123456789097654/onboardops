"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { OWNER_ONLY, requireStaff, staffAudit } from "@/lib/platform";
import { run } from "./_util";

/** The team page is public content, so only the site owner can change it. Every change is written to the staff audit log. */
const MAX_PHOTO_BYTES = 300 * 1024;

const member = z.object({
  name: z.string().trim().min(2, "Enter the person's name").max(80),
  role: z.string().trim().max(100).default(""),
  bio: z.string().trim().max(1500, "Keep the bio under 1,500 characters").default(""),
  linkUrl: z.string().trim().max(300).default("").refine((v) => v === "" || /^https:\/\/[^\s]+$/.test(v), "A link must start with https://"),
  visible: z.boolean().default(true),
  /** A data URL from the browser. undefined keeps the current photo, null removes it. */
  photo: z.string().max(500_000).nullable().optional(),
});

function decodePhoto(dataUrl: string): { bytes: Buffer; mime: string } {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new Error("Use a JPEG, PNG or WebP photo.");
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length > MAX_PHOTO_BYTES) throw new Error("That photo is too large. Use one under 300 KB.");
  return { bytes, mime: m[1] };
}

const refresh = () => {
  revalidatePath("/admin/team");
  revalidatePath("/team");
};

export async function createTeamMemberAction(input: unknown) {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    const d = member.parse(input);
    const last = await prisma.teamMember.aggregate({ _max: { sortOrder: true } });
    const photo = d.photo ? decodePhoto(d.photo) : null;
    await prisma.$transaction(async (tx) => {
      const t = await tx.teamMember.create({ data: { name: d.name, role: d.role, bio: d.bio, linkUrl: d.linkUrl, visible: d.visible, sortOrder: (last._max.sortOrder ?? 0) + 1, photo: photo ? photo.bytes : null, photoMime: photo ? photo.mime : null } });
      await staffAudit(tx, staff, { action: "TEAM_MEMBER_CREATED", targetType: "TeamMember", targetId: t.id, summary: `Added ${d.name} to the team page` });
    });
    refresh();
    return undefined;
  });
}

export async function updateTeamMemberAction(id: string, input: unknown) {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    const d = member.parse(input);
    const photo = typeof d.photo === "string" ? decodePhoto(d.photo) : null;
    await prisma.$transaction(async (tx) => {
      await tx.teamMember.update({
        where: { id },
        data: { name: d.name, role: d.role, bio: d.bio, linkUrl: d.linkUrl, visible: d.visible, ...(photo ? { photo: photo.bytes, photoMime: photo.mime } : d.photo === null ? { photo: null, photoMime: null } : {}) },
      });
      await staffAudit(tx, staff, { action: "TEAM_MEMBER_UPDATED", targetType: "TeamMember", targetId: id, summary: `Edited ${d.name} on the team page` });
    });
    refresh();
    return undefined;
  });
}

export async function setTeamMemberVisibleAction(id: string, visible: boolean) {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    await prisma.$transaction(async (tx) => {
      const t = await tx.teamMember.update({ where: { id }, data: { visible: !!visible }, select: { name: true } });
      await staffAudit(tx, staff, { action: visible ? "TEAM_MEMBER_SHOWN" : "TEAM_MEMBER_HIDDEN", targetType: "TeamMember", targetId: id, summary: `${visible ? "Showed" : "Hid"} ${t.name} on the team page` });
    });
    refresh();
    return undefined;
  });
}

/** Swap places with the neighbour above or below, in the order the page shows them. */
export async function moveTeamMemberAction(id: string, dir: "up" | "down") {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    const all = await prisma.teamMember.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
    const i = all.findIndex((t) => t.id === id);
    const j = dir === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= all.length) return undefined;
    const ids = all.map((t) => t.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await prisma.$transaction(async (tx) => {
      for (let k = 0; k < ids.length; k++) await tx.teamMember.update({ where: { id: ids[k] }, data: { sortOrder: k + 1 } });
      await staffAudit(tx, staff, { action: "TEAM_REORDERED", targetType: "TeamMember", targetId: id, summary: `Moved a team member ${dir}` });
    });
    refresh();
    return undefined;
  });
}

export async function deleteTeamMemberAction(id: string) {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    await prisma.$transaction(async (tx) => {
      const t = await tx.teamMember.delete({ where: { id }, select: { name: true } });
      await staffAudit(tx, staff, { action: "TEAM_MEMBER_DELETED", targetType: "TeamMember", targetId: id, summary: `Removed ${t.name} from the team page` });
    });
    refresh();
    return undefined;
  });
}

/** The page's own heading and intro. */
export async function saveTeamPageAction(input: unknown) {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    const d = z.object({ title: z.string().trim().min(2, "Enter a heading").max(100), intro: z.string().trim().max(800).default("") }).parse(input);
    await prisma.$transaction(async (tx) => {
      await tx.teamPage.upsert({ where: { id: "team" }, create: { id: "team", title: d.title, intro: d.intro }, update: { title: d.title, intro: d.intro } });
      await staffAudit(tx, staff, { action: "TEAM_PAGE_UPDATED", targetType: "TeamPage", targetId: "team", summary: "Edited the team page heading and intro" });
    });
    refresh();
    return undefined;
  });
}
