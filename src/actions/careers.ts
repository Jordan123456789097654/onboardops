"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { enforceRate } from "@/lib/rate-limit";
import { requireStaff, staffAudit, SUPPORT_STAFF } from "@/lib/platform";
import { sendEmail } from "@/lib/email";
import { run } from "./_util";

/** Public application. Stores what the person typed (no files), rate limited, with a honeypot field. */
export async function applyAction(input: unknown) {
  return run(async () => {
    await enforceRate("apply", 4, 3600);
    const d = z.object({
      postingId: z.string().max(40).optional().or(z.literal("")),
      name: z.string().trim().min(2, "Enter your name").max(100),
      email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
      link: z.string().trim().max(300).default("").refine((v) => v === "" || /^https?:\/\//i.test(v), "Links must start with http:// or https://"),
      message: z.string().trim().min(20, "Tell us a little about yourself (20+ characters)").max(4000),
      website: z.string().max(0).optional(),
    }).parse(input);
    let postingTitle = "General introduction";
    if (d.postingId) {
      const p = await prisma.jobPosting.findFirst({ where: { id: d.postingId, status: "OPEN" } });
      if (!p) throw new Error("That position is no longer open.");
      postingTitle = p.title;
    }
    await prisma.jobApplication.create({ data: { postingId: d.postingId || null, name: d.name, email: d.email, link: d.link, message: d.message } });
    const inbox = process.env.SUPPORT_INBOX;
    if (inbox) await sendEmail(inbox, `New application: ${postingTitle}`, `${d.name} <${d.email}> applied for: ${postingTitle}\n\nOpen the staff console, Careers, to review it.`, { kind: "careers" });
    return undefined;
  });
}

const refresh = () => { revalidatePath("/careers"); revalidatePath("/admin/careers"); };

export async function savePostingAction(input: unknown) {
  return run(async () => {
    const staff = await requireStaff(SUPPORT_STAFF);
    const d = z.object({
      id: z.string().optional(),
      title: z.string().trim().min(3, "Add a title").max(100),
      team: z.string().trim().max(60).default(""),
      location: z.string().trim().max(80).default("Remote"),
      type: z.string().trim().max(40).default("Full-time"),
      description: z.string().trim().min(20, "Describe the role (20+ characters)").max(6000),
    }).parse(input);
    await prisma.$transaction(async (tx) => {
      const data = { title: d.title, team: d.team, location: d.location, type: d.type, description: d.description };
      const row = d.id ? await tx.jobPosting.update({ where: { id: d.id }, data }) : await tx.jobPosting.create({ data: { ...data, createdByName: staff.name } });
      await staffAudit(tx, staff, { action: d.id ? "POSTING_UPDATED" : "POSTING_CREATED", targetType: "JobPosting", targetId: row.id, summary: `Job posting "${d.title}" ${d.id ? "updated" : "created"}` });
    });
    refresh();
    return undefined;
  });
}

export async function setPostingStatusAction(id: string, status: "OPEN" | "CLOSED") {
  return run(async () => {
    const staff = await requireStaff(SUPPORT_STAFF);
    z.enum(["OPEN", "CLOSED"]).parse(status);
    await prisma.$transaction(async (tx) => {
      const p = await tx.jobPosting.update({ where: { id }, data: { status } });
      await staffAudit(tx, staff, { action: "POSTING_STATUS", targetType: "JobPosting", targetId: id, summary: `"${p.title}" ${status === "OPEN" ? "opened" : "closed"}` });
    });
    refresh();
    return undefined;
  });
}

export async function deletePostingAction(id: string) {
  return run(async () => {
    const staff = await requireStaff(["OWNER"]);
    await prisma.$transaction(async (tx) => {
      const p = await tx.jobPosting.delete({ where: { id } });
      await staffAudit(tx, staff, { action: "POSTING_DELETED", targetType: "JobPosting", targetId: id, summary: `Deleted posting "${p.title}"` });
    });
    refresh();
    return undefined;
  });
}

export async function updateApplicationAction(id: string, input: unknown) {
  return run(async () => {
    const staff = await requireStaff(SUPPORT_STAFF);
    const d = z.object({ status: z.enum(["NEW", "REVIEWING", "INTERVIEW", "OFFER", "HIRED", "REJECTED"]), notes: z.string().trim().max(3000).default("") }).parse(input);
    await prisma.$transaction(async (tx) => {
      await tx.jobApplication.update({ where: { id }, data: d });
      await staffAudit(tx, staff, { action: "APPLICATION_UPDATED", targetType: "JobApplication", targetId: id, summary: `Application marked ${d.status}` });
    });
    refresh();
    return undefined;
  });
}

/** Applicants can be removed on request. Only the site owner deletes, and it is logged. */
export async function deleteApplicationAction(id: string) {
  return run(async () => {
    const staff = await requireStaff(["OWNER"]);
    await prisma.$transaction(async (tx) => {
      await tx.jobApplication.delete({ where: { id } });
      await staffAudit(tx, staff, { action: "APPLICATION_DELETED", targetType: "JobApplication", targetId: id, summary: "Application deleted" });
    });
    refresh();
    return undefined;
  });
}
