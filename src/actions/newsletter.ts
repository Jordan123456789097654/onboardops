"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaff, staffAudit, SUPPORT_STAFF, OWNER_ONLY } from "@/lib/platform";
import { sendEmail } from "@/lib/email";
import { enforceRate, hit } from "@/lib/rate-limit";
import { slugify } from "@/lib/utils";
import { NEWS_CATEGORIES } from "@/lib/newsletter-templates";
import { listHeaders, newToken, renderConfirmEmail, renderIssueEmail } from "@/lib/newsletter";
import { unsubscribeByToken } from "@/lib/newsletter-db";
import { run } from "./_util";

const refresh = () => { revalidatePath("/newsletter"); revalidatePath("/admin/newsletter"); };

/* ---------------- Public ---------------- */

/** Asks for the newsletter. Nothing is sent until the person confirms from their email, and the answer is always the same, so it can't be used to find out who is subscribed. */
export async function subscribeNewsletterAction(input: unknown) {
  return run(async () => {
    await enforceRate("newsletter-subscribe", 6, 3600);
    const d = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200), website: z.string().max(0).optional() }).parse(input);
    await enforceRate("newsletter-subscribe-email", 6, 86400, d.email);
    const existing = await prisma.newsletterSubscriber.findUnique({ where: { email: d.email } });
    if (existing?.status === "ACTIVE") return undefined;
    const sub = existing
      ? await prisma.newsletterSubscriber.update({ where: { id: existing.id }, data: { status: "PENDING", unsubscribedAt: null } })
      : await prisma.newsletterSubscriber.create({ data: { email: d.email, token: newToken(), source: "website" } });
    const m = renderConfirmEmail(sub.token);
    await sendEmail(sub.email, "Confirm your OnboardOps newsletter subscription", m.text, { html: m.html, kind: "newsletter-confirm" });
    return undefined;
  });
}

export async function unsubscribeNewsletterAction(token: string) {
  return run(async () => {
    await enforceRate("newsletter-unsub", 20, 3600);
    return { done: await unsubscribeByToken(z.string().max(100).parse(token)) };
  });
}

/* ---------------- Staff: writing and publishing ---------------- */

const postSchema = z.object({
  id: z.string().max(64).optional(),
  title: z.string().trim().min(3, "Give the issue a title").max(140),
  slug: z.string().trim().toLowerCase().max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "The web address can use lowercase letters, numbers and dashes").optional().or(z.literal("")),
  summary: z.string().trim().max(300).default(""),
  category: z.enum(NEWS_CATEGORIES).default("Update"),
  body: z.string().trim().min(20, "Write the issue").max(40000),
});

export async function saveNewsletterPostAction(input: unknown) {
  return run(async () => {
    const staff = await requireStaff(SUPPORT_STAFF);
    const d = postSchema.parse(input);
    let slug = d.slug || slugify(d.title).slice(0, 80) || "issue";
    const clash = await prisma.newsletterPost.findFirst({ where: { slug, ...(d.id ? { NOT: { id: d.id } } : {}) }, select: { id: true } });
    if (clash) slug = `${slug.slice(0, 74)}-${Math.random().toString(36).slice(2, 6)}`;
    const data = { title: d.title, slug, summary: d.summary, category: d.category, body: d.body };
    const post = d.id
      ? await prisma.newsletterPost.update({ where: { id: d.id }, data })
      : await prisma.newsletterPost.create({ data: { ...data, authorName: staff.name } });
    await staffAudit(prisma, staff, { action: d.id ? "NEWSLETTER_EDIT" : "NEWSLETTER_CREATE", targetType: "NewsletterPost", targetId: post.id, summary: `${d.id ? "Edited" : "Created"} newsletter issue "${d.title.slice(0, 80)}"` });
    refresh();
    return { id: post.id, slug: post.slug, status: post.status };
  });
}

/** Puts an issue on the website, or takes it back to a draft. This does not send any email. */
export async function setNewsletterStatusAction(input: unknown) {
  return run(async () => {
    const staff = await requireStaff(SUPPORT_STAFF);
    const d = z.object({ id: z.string().max(64), status: z.enum(["PUBLISHED", "DRAFT"]) }).parse(input);
    const post = await prisma.newsletterPost.findUnique({ where: { id: d.id } });
    if (!post) throw new Error("Issue not found.");
    if (d.status === "PUBLISHED") {
      const blanks = `${post.title}\n${post.summary}\n${post.body}`.match(/\{\{[^}]+\}\}/g);
      if (blanks) throw new Error(`Fill in the blanks first: ${Array.from(new Set(blanks)).slice(0, 4).join(", ")}`);
    }
    await prisma.newsletterPost.update({ where: { id: d.id }, data: { status: d.status, ...(d.status === "PUBLISHED" && !post.publishedAt ? { publishedAt: new Date() } : {}) } });
    await staffAudit(prisma, staff, { action: d.status === "PUBLISHED" ? "NEWSLETTER_PUBLISH" : "NEWSLETTER_UNPUBLISH", targetType: "NewsletterPost", targetId: d.id, summary: `${d.status === "PUBLISHED" ? "Published" : "Unpublished"} newsletter issue "${post.title.slice(0, 80)}"` });
    refresh();
    revalidatePath(`/newsletter/${post.slug}`);
    return undefined;
  });
}

export async function deleteNewsletterPostAction(id: string) {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    const post = await prisma.newsletterPost.findUnique({ where: { id: z.string().max(64).parse(id) }, select: { title: true, slug: true } });
    if (!post) throw new Error("Issue not found.");
    await prisma.newsletterPost.delete({ where: { id } });
    await staffAudit(prisma, staff, { action: "NEWSLETTER_DELETE", targetType: "NewsletterPost", targetId: id, summary: `Deleted newsletter issue "${post.title.slice(0, 80)}"` });
    refresh();
    revalidatePath(`/newsletter/${post.slug}`);
    return undefined;
  });
}

/* ---------------- Staff: emailing an issue (optional, separate from publishing) ---------------- */

const MAX_RECIPIENTS = 500;

/** Emails a published issue. Most issues are website-only, so this is a deliberate extra step. A test goes to you alone; a real send is owner-only, needs a typed confirmation, and never sends the same issue twice to one person. */
export async function sendNewsletterAction(input: unknown) {
  return run(async () => {
    const staff = await requireStaff(SUPPORT_STAFF);
    const d = z.object({ id: z.string().max(64), test: z.boolean().default(false), confirm: z.string().optional() }).parse(input);
    const post = await prisma.newsletterPost.findUnique({ where: { id: d.id } });
    if (!post) throw new Error("Issue not found.");

    if (d.test) {
      if (await hit(`newsletter-test:${staff.id}`, 20, 3600)) throw new Error("You've sent a lot of tests this hour. Please wait a little.");
      const m = renderIssueEmail(post, "test-preview-token-not-a-real-subscriber");
      const r = await sendEmail(staff.email, `[Test] ${post.title}`, m.text, { html: m.html, kind: "newsletter-test" });
      if (!r.ok) throw new Error(r.error ?? "The test email failed.");
      return { delivered: 1, failed: 0, total: 1, test: true };
    }

    await requireStaff(OWNER_ONLY);
    if (post.status !== "PUBLISHED") throw new Error("Publish the issue to the website first, so the email can link to it.");
    if (d.confirm !== "SEND") throw new Error("Type SEND to confirm.");
    if (await hit(`newsletter-send:${staff.id}`, 6, 86400)) throw new Error("You've sent several issues today. Please wait before sending another.");

    const subs = await prisma.newsletterSubscriber.findMany({ where: { status: "ACTIVE", OR: [{ lastSentPostId: null }, { NOT: { lastSentPostId: post.id } }] }, orderBy: { createdAt: "asc" }, take: MAX_RECIPIENTS + 1 });
    if (subs.length === 0) throw new Error("There is nobody left to send this issue to.");
    if (subs.length > MAX_RECIPIENTS) throw new Error(`That's more than ${MAX_RECIPIENTS} people. Send it in batches by running this again once the first batch finishes.`);

    const campaign = await prisma.emailCampaign.create({ data: { staffName: staff.name, audience: "NEWSLETTER", subject: post.title.slice(0, 200), category: "Newsletter", total: subs.length, status: "SENDING" } });
    let delivered = 0, failed = 0;
    const started = Date.now();
    for (let i = 0; i < subs.length; i += 8) {
      if (Date.now() - started > 50_000) { failed += subs.length - i; break; }
      await Promise.all(subs.slice(i, i + 8).map(async (s) => {
        const m = renderIssueEmail(post, s.token);
        const r = await sendEmail(s.email, post.title, m.text, { html: m.html, kind: "newsletter", headers: listHeaders(s.token) });
        if (r.ok) {
          delivered++;
          await prisma.newsletterSubscriber.update({ where: { id: s.id }, data: { lastSentPostId: post.id } });
        } else failed++;
      }));
    }
    const status = failed === 0 ? "COMPLETED" : delivered > 0 ? "PARTIAL" : "FAILED";
    await prisma.emailCampaign.update({ where: { id: campaign.id }, data: { delivered, failed, status } });
    await prisma.newsletterPost.update({ where: { id: post.id }, data: { sentAt: post.sentAt ?? new Date(), sentTo: { increment: delivered }, sentFailed: failed } });
    await staffAudit(prisma, staff, { action: "NEWSLETTER_SENT", targetType: "NewsletterPost", targetId: post.id, summary: `Emailed newsletter issue "${post.title.slice(0, 80)}" to subscribers (${delivered} delivered, ${failed} failed)` });
    refresh();
    return { delivered, failed, total: subs.length, test: false };
  });
}

export async function removeSubscriberAction(id: string) {
  return run(async () => {
    const staff = await requireStaff(OWNER_ONLY);
    await prisma.newsletterSubscriber.deleteMany({ where: { id: z.string().max(64).parse(id) } });
    await staffAudit(prisma, staff, { action: "NEWSLETTER_SUBSCRIBER_REMOVED", targetType: "NewsletterSubscriber", targetId: id, summary: "Removed a newsletter subscriber" });
    refresh();
    return undefined;
  });
}
