"use server";
import { createHash, randomInt, timingSafeEqual } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enforceRate } from "@/lib/rate-limit";
import { hashChatToken, newChatToken } from "@/lib/chat-ticket";
import { emails, sendEmail } from "@/lib/email";
import { getSupportConfig, publicSupportStatus } from "@/lib/support-config";
import { CHAT_VISIBLE_KINDS, addVisitorMessage, createTicket, refOf, resolveMerged, runSupportSweep } from "@/lib/support";
import { run } from "./_util";

const ticketRef = z.object({ id: z.string().min(5).max(64), token: z.string().min(20).max(80) });

async function ownTicket(id: string, token: string) {
  const req = await prisma.supportRequest.findUnique({ where: { id } });
  if (!req || !req.chatTokenHash || req.chatTokenHash !== hashChatToken(token)) throw new Error("This conversation could not be found.");
  return resolveMerged(req);
}

/** A visitor asks for a person. Creates a support ticket from the chat, and returns a secret token the browser keeps. */
export async function createChatTicketAction(input: unknown) {
  return run(async () => {
    await enforceRate("chat-ticket", 10, 3600);
    const d = z.object({
      name: z.string().trim().max(100).optional().nullable(),
      email: z.string().trim().max(200).optional().nullable(),
      message: z.string().trim().min(5, "Tell us what you need").max(3000),
      transcript: z.string().max(4000).default(""),
      page: z.string().trim().max(200).regex(/^\/[a-zA-Z0-9/_-]*$/).optional(),
    }).parse(input);
    // Signed-in people are not asked for their details: the ticket uses their account.
    const { getActiveMembership } = await import("@/lib/auth");
    const m = await getActiveMembership().catch(() => null);
    const name = m?.user.name || d.name || "";
    const email = m?.user.email || d.email || "";
    if (name.length < 2) throw new Error("Enter your name.");
    if (!z.string().email().safeParse(email).success) throw new Error("Enter a valid email.");
    const token = newChatToken();
    const body = d.transcript ? `${d.message}\n\n--- Chat before handoff ---\n${d.transcript}` : d.message;
    const req = await createTicket({ name, email, topic: "Question", message: body, source: "CHAT", chatTokenHash: hashChatToken(token), pageUrl: d.page ?? null });
    return { id: req.id, token, ref: refOf(req.id) };
  });
}

/** The visitor's side of the ticket: staff replies (with the rep's name), seen and typing state, status. */
export async function getChatTicketAction(input: unknown) {
  return run(async () => {
    const d = ticketRef.parse(input);
    const req = await ownTicket(d.id, d.token);
    const [msgs, files] = await Promise.all([
      prisma.supportMessage.findMany({ where: { requestId: req.id, kind: { in: CHAT_VISIBLE_KINDS } }, orderBy: { createdAt: "asc" } }),
      prisma.supportAttachment.findMany({ where: { requestId: req.id }, select: { id: true, messageId: true, name: true, mime: true, size: true } }),
    ]);
    const lastVisitorAt = [...msgs].reverse().find((m) => m.kind === "VISITOR")?.createdAt ?? req.createdAt;
    const seen = req.staffSeenAt && req.staffSeenAt >= lastVisitorAt && req.staffSeenBy ? { at: req.staffSeenAt.toISOString(), by: req.staffSeenBy } : null;
    const typing = req.staffTypingAt && Date.now() - req.staffTypingAt.getTime() < 9000 ? req.staffTypingBy : null;
    return {
      ref: refOf(req.id),
      status: req.status,
      movedToEmail: req.source === "EMAIL",
      assignee: req.assignee,
      seen,
      typing,
      rated: req.rating !== null,
      messages: msgs.map((m) => ({
        id: m.id,
        kind: m.kind,
        author: m.kind === "REPLY" ? m.authorName : m.kind === "VISITOR" ? "You" : "OnboardOps",
        body: m.body,
        at: m.createdAt.toISOString(),
        files: files.filter((f) => f.messageId === m.id).map((f) => ({ id: f.id, name: f.name, mime: f.mime, size: f.size })),
      })),
    };
  });
}

/** The visitor replies inside the chat. Staff see it in the inbox. A solved ticket reopens. */
export async function sendChatFollowUpAction(input: unknown) {
  return run(async () => {
    await enforceRate("chat-ticket-reply", 30, 3600);
    const d = ticketRef.extend({ body: z.string().trim().max(3000).default(""), attachmentIds: z.array(z.string().max(64)).max(5).default([]) }).parse(input);
    if (d.body.length < 1 && d.attachmentIds.length < 1) throw new Error("Write a message.");
    const req = await ownTicket(d.id, d.token);
    await addVisitorMessage(req.id, req.name, d.body || "(attachment)", { attachmentIds: d.attachmentIds });
    return undefined;
  });
}

/** Thumbs up or down once a ticket is solved. */
export async function rateTicketAction(input: unknown) {
  return run(async () => {
    await enforceRate("chat-rate", 20, 3600);
    const d = ticketRef.extend({ rating: z.number().int().min(1).max(5), note: z.string().trim().max(500).default("") }).parse(input);
    const req = await ownTicket(d.id, d.token);
    await prisma.supportRequest.update({ where: { id: req.id }, data: { rating: d.rating, ratingNote: d.note || null, ratedAt: new Date() } });
    return undefined;
  });
}

/** Opening hours, away message and branding for the bubble. Nothing secret. */
export async function getSupportStatusAction() {
  return run(async () => publicSupportStatus(await getSupportConfig()));
}

/** Fire-and-forget housekeeping (idle nudges, auto-close, retention). Throttled to once per 10 minutes. */
export async function sweepSupportAction() {
  return run(async () => {
    await runSupportSweep();
    return undefined;
  });
}

/* ---------------- Find your past conversations ---------------- */

const codeHash = (email: string, code: string) => createHash("sha256").update(`${email.toLowerCase()}:${code}`).digest("hex");

/** Emails a 6-digit code if this address has past conversations. Always answers the same, so it can't be used to find out who has written to us. */
export async function requestHistoryCodeAction(input: unknown) {
  return run(async () => {
    const d = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email") }).parse(input);
    await enforceRate("support-code", 5, 3600, d.email);
    const has = await prisma.supportRequest.count({ where: { email: d.email, spam: false, NOT: { topic: "Privacy request" } } });
    if (has > 0) {
      const code = String(randomInt(0, 1000000)).padStart(6, "0");
      await prisma.supportCode.deleteMany({ where: { email: d.email } });
      await prisma.supportCode.create({ data: { email: d.email, codeHash: codeHash(d.email, code), expiresAt: new Date(Date.now() + 15 * 60000) } });
      const m = emails.supportCode(code);
      await sendEmail(d.email, m.subject, m.text, { html: m.html, kind: "support-code" });
    }
    return undefined;
  });
}

export async function verifyHistoryCodeAction(input: unknown) {
  return run(async () => {
    const d = z.object({ email: z.string().trim().toLowerCase().email(), code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code") }).parse(input);
    await enforceRate("support-code-verify", 15, 900, d.email);
    const row = await prisma.supportCode.findFirst({ where: { email: d.email, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
    const bad = "That code didn't work. Check it, or ask for a new one.";
    if (!row || row.attempts >= 5) throw new Error(bad);
    const a = Buffer.from(row.codeHash);
    const b = Buffer.from(codeHash(d.email, d.code));
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      await prisma.supportCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
      throw new Error(bad);
    }
    await prisma.supportCode.delete({ where: { id: row.id } });
    const rows = await prisma.supportRequest.findMany({ where: { email: d.email, spam: false, mergedIntoId: null, NOT: { topic: "Privacy request" } }, orderBy: { createdAt: "desc" }, take: 10 });
    const out = [];
    for (const r of rows) {
      const token = newChatToken();
      await prisma.supportRequest.update({ where: { id: r.id }, data: { chatTokenHash: hashChatToken(token) } });
      out.push({ id: r.id, token, ref: refOf(r.id), status: r.status, topic: r.topic, createdAt: r.createdAt.toISOString(), preview: r.message.split("\n")[0].slice(0, 90) });
    }
    return out;
  });
}
