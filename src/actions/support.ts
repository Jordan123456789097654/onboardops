"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { getActiveMembership } from "@/lib/auth";
import { enforceRate } from "@/lib/rate-limit";
import { createTicket } from "@/lib/support";
import { run } from "./_util";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(100),
  email: z.string().trim().email("Enter a valid email"),
  topic: z.enum(["Question", "Bug", "Billing or plan", "Privacy request", "Security report", "Legal notice", "Feedback"]),
  message: z.string().trim().min(15, "Tell us a bit more (at least 15 characters)").max(5000),
  website: z.string().max(0).optional(), // honeypot
});

export async function submitSupportRequestAction(input: unknown) {
  return run(async () => {
    await enforceRate("support", 8, 3600);
    const d = schema.parse(input);
    const recent = await prisma.supportRequest.count({ where: { email: d.email.toLowerCase(), createdAt: { gt: new Date(Date.now() - 3600_000) } } });
    if (recent >= 5) throw new Error("You have sent several requests in the last hour. Please wait and try again.");
    const req = await createTicket({ name: d.name, email: d.email, topic: d.topic, message: d.message, source: "CONTACT", boardStatus: d.topic === "Feedback" ? "NEW" : null });
    const inbox = process.env.SUPPORT_INBOX;
    if (inbox) await sendEmail(inbox, `[${d.topic}] Support request ${req.id.slice(-8).toUpperCase()}`, `From: ${d.name} <${d.email}>\nTopic: ${d.topic}\n\n${d.message}`, { kind: "support-inbound" });
    return { id: req.id };
  });
}

/** Feedback, bug reports and questions sent from inside the app. Linked to the sender's workspace. */
export async function submitFeedbackAction(input: unknown) {
  return run(async () => {
    await enforceRate("feedback", 20, 3600);
    const m = await getActiveMembership();
    if (!m || m.support) throw new Error("Sign in to send feedback.");
    const d = z.object({ topic: z.enum(["Feedback", "Bug", "Question"]), message: z.string().trim().min(10, "Tell us a bit more (10+ characters)").max(5000) }).parse(input);
    const recent = await prisma.supportRequest.count({ where: { userId: m.userId, createdAt: { gt: new Date(Date.now() - 3600_000) } } });
    if (recent >= 10) throw new Error("You have sent a lot of messages in the last hour. Please wait and try again.");
    const req = await createTicket({ name: m.user.name, email: m.user.email, topic: d.topic, message: d.message, source: "IN_APP", workspaceId: m.workspaceId, userId: m.userId, boardStatus: d.topic === "Feedback" ? "NEW" : null });
    const inbox = process.env.SUPPORT_INBOX;
    if (inbox) await sendEmail(inbox, `[${d.topic}] ${m.workspace.name}: request ${req.id.slice(-8).toUpperCase()}`, `From: ${m.user.name} <${m.user.email}> in ${m.workspace.name}\n\n${d.message}`, { kind: "support-inbound", workspaceId: m.workspaceId });
    return { ref: req.id.slice(-8).toUpperCase() };
  });
}
