"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { OWNER_ONLY, requireStaff, staffAudit } from "@/lib/platform";
import { run } from "./_util";

/** Testimonials are public marketing content, so only the site owner can change them. Every change is written to the staff audit log. */
const MAX_PHOTO_BYTES = 300 * 1024;

const base = z.object({
  quote: z.string().trim().min(10, "Write the quote (at least 10 characters)").max(600, "Keep the quote under 600 characters"),
  name: z.string().trim().min(2, "Enter the person's name").max(80),
  jobTitle: z.string().trim().max(80).default(""),
  company: z.string().trim().max(80).default(""),
  rating: z.number().int().min(1).max(5).nullable().default(null),
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

function refresh() {
  revalidatePath("/admin/testimonials");
  revalidatePath("/");
}

export async function createTestimonialAction(input: unknown) {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    const d = base.parse(input);
    const last = await prisma.testimonial.aggregate({ _max: { sortOrder: true } });
    const photo = d.photo ? decodePhoto(d.photo) : null;
    await prisma.$transaction(async (tx) => {
      const t = await tx.testimonial.create({ data: { quote: d.quote, name: d.name, jobTitle: d.jobTitle, company: d.company, rating: d.rating, visible: d.visible, sortOrder: (last._max.sortOrder ?? 0) + 1, photo: photo ? photo.bytes : null, photoMime: photo?.mime ?? null }, select: { id: true } });
      await staffAudit(tx, staff, { action: "TESTIMONIAL_CREATED", targetType: "Testimonial", targetId: t.id, summary: `Added a testimonial from ${d.name}${d.company ? ` (${d.company})` : ""}` });
    });
    refresh();
    return undefined;
  });
}

export async function updateTestimonialAction(id: string, input: unknown) {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    const d = base.parse(input);
    const photo = typeof d.photo === "string" ? decodePhoto(d.photo) : null;
    await prisma.$transaction(async (tx) => {
      await tx.testimonial.update({
        where: { id },
        data: {
          quote: d.quote, name: d.name, jobTitle: d.jobTitle, company: d.company, rating: d.rating, visible: d.visible,
          ...(photo ? { photo: photo.bytes, photoMime: photo.mime } : d.photo === null ? { photo: null, photoMime: null } : {}),
        },
      });
      await staffAudit(tx, staff, { action: "TESTIMONIAL_UPDATED", targetType: "Testimonial", targetId: id, summary: `Edited the testimonial from ${d.name}` });
    });
    refresh();
    return undefined;
  });
}

export async function setTestimonialVisibleAction(id: string, visible: boolean) {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    await prisma.$transaction(async (tx) => {
      const t = await tx.testimonial.update({ where: { id }, data: { visible: !!visible }, select: { name: true } });
      await staffAudit(tx, staff, { action: visible ? "TESTIMONIAL_SHOWN" : "TESTIMONIAL_HIDDEN", targetType: "Testimonial", targetId: id, summary: `${visible ? "Showed" : "Hid"} the testimonial from ${t.name}` });
    });
    refresh();
    return undefined;
  });
}

/** Swap places with the neighbour above or below, in the order the homepage shows them. */
export async function moveTestimonialAction(id: string, dir: "up" | "down") {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    const all = await prisma.testimonial.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
    const i = all.findIndex((t) => t.id === id);
    const j = dir === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= all.length) return undefined;
    const ids = all.map((t) => t.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await prisma.$transaction(async (tx) => {
      for (let k = 0; k < ids.length; k++) await tx.testimonial.update({ where: { id: ids[k] }, data: { sortOrder: k + 1 } });
      await staffAudit(tx, staff, { action: "TESTIMONIAL_REORDERED", targetType: "Testimonial", targetId: id, summary: `Moved a testimonial ${dir}` });
    });
    refresh();
    return undefined;
  });
}

export async function deleteTestimonialAction(id: string) {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    await prisma.$transaction(async (tx) => {
      const t = await tx.testimonial.delete({ where: { id }, select: { name: true } });
      await staffAudit(tx, staff, { action: "TESTIMONIAL_DELETED", targetType: "Testimonial", targetId: id, summary: `Deleted the testimonial from ${t.name}` });
    });
    refresh();
    return undefined;
  });
}
