"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enforceRate } from "@/lib/rate-limit";
import { hashChatToken, newChatToken } from "@/lib/chat-ticket";
import { run } from "./_util";

const ticketRef = z.object({ id: z.string().min(5).max(64), token: z.string().min(20).max(80) });

async function ownTicket(id: string, token: string) {
  const req = await prisma.supportRequest.findUnique({ where: { id } });
  if (!req || !req.chatTokenHash || req.chatTokenHash !== hashChatToken(token)) throw new Error("This conversation could not be found.");
  return req;
}

/** A visitor asks for a person. Creates a support ticket from the chat, and returns a secret token the browser keeps. */
export async function createChatTicketAction(input: unknown) {
  return run(async () => {
    await enforceRate("chat-ticket", 10, 3600);
    const d = z.object({
      name: z.string().trim().min(2, "Enter your name").max(100),
      email: z.string().trim().email("Enter a valid email"),
      message: z.string().trim().min(5, "Tell us what you need").max(3000),
      transcript: z.string().max(4000).default(""),
    }).parse(input);
    const token = newChatToken();
    const body = d.transcript ? `${d.message}\n\n--- Chat before handoff ---\n${d.transcript}` : d.message;
    const req = await prisma.supportRequest.create({
      data: { name: d.name, email: d.email.toLowerCase(), topic: "Question", message: body.slice(0, 5000), source: "CHAT", chatTokenHash: hashChatToken(token) },
    });
    return { id: req.id, token, ref: req.id.slice(-8).toUpperCase() };
  });
}

/** The visitor's side of the ticket: staff replies (with the rep's name) and status. */
export async function getChatTicketAction(input: unknown) {
  return run(async () => {
    const d = ticketRef.parse(input);
    const req = await ownTicket(d.id, d.token);
    const msgs = await prisma.supportMessage.findMany({ where: { requestId: req.id, kind: { in: ["REPLY", "VISITOR", "SYSTEM"] } }, orderBy: { createdAt: "asc" } });
    return {
      status: req.status,
      movedToEmail: req.source === "EMAIL",
      messages: msgs.map((m) => ({ id: m.id, kind: m.kind, author: m.kind === "REPLY" ? m.authorName : m.kind === "VISITOR" ? "You" : "OnboardOps", body: m.body, at: m.createdAt.toISOString() })),
    };
  });
}

/** The visitor replies inside the chat. Staff see it in the inbox. */
export async function sendChatFollowUpAction(input: unknown) {
  return run(async () => {
    await enforceRate("chat-ticket-reply", 30, 3600);
    const d = ticketRef.extend({ body: z.string().trim().min(1, "Write a message").max(3000) }).parse(input);
    const req = await ownTicket(d.id, d.token);
    await prisma.supportMessage.create({ data: { requestId: req.id, kind: "VISITOR", authorName: req.name, body: d.body } });
    await prisma.supportRequest.update({ where: { id: req.id }, data: { status: "OPEN" } });
    return undefined;
  });
}
