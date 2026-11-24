import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforceRate } from "@/lib/rate-limit";
import { addVisitorMessage, createTicket, refOf, resolveMerged } from "@/lib/support";
import { buildEmail } from "@/lib/email-template";
import { sendEmail } from "@/lib/email";
import { forwardTargets, hashReplyToken } from "@/lib/email-reply";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Hosting limits a request body to about 4.5 MB, so the combined size of all files is capped just under that.
const MAX_TOTAL = 4_200_000;
const MAX_FILES = 3;
const MAX_REPLIES_PER_LINK = 20;

const appUrl = () => (process.env.APP_URL || "https://onboardops.org").trim().replace(/^["']+|["']+$/g, "").replace(/\/$/, "");
const oneLine = (s: string, n = 120) => s.replace(/[\r\n\t]+/g, " ").trim().slice(0, n);
/** Text from a stranger is shown in our own email, so formatting characters that would turn into bold text or links are removed. */
const plain = (s: string) => s.replace(/[\[\]*]/g, " ").replace(/[ \t]{2,}/g, " ");

function sniff(b: Buffer): string | null {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && b.subarray(1, 4).toString() === "PNG") return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 4).toString() === "GIF8") return "image/gif";
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (b.subarray(0, 4).toString() === "%PDF") return "application/pdf";
  return null;
}

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Someone pressed Reply in one of our emails. The token in the link says which email and which person. */
export async function POST(req: Request) {
  try {
    await enforceRate("email-reply", 10, 3600);
  } catch {
    return fail("Too many replies from this connection. Please try again in a little while.", 429);
  }
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_TOTAL + 100_000) return fail("Those files are too large. Keep the total under 4 MB.", 413);

  const form = await req.formData().catch(() => null);
  if (!form) return fail("We couldn't read that. Please try again.");
  if (String(form.get("website") ?? "")) return NextResponse.json({ ok: true }); // spam trap
  const token = String(form.get("token") ?? "");
  const message = String(form.get("message") ?? "").trim().slice(0, 5000);
  const nameIn = oneLine(String(form.get("name") ?? ""), 100);
  if (token.length < 20 || token.length > 80 || !/^[A-Za-z0-9_-]+$/.test(token)) return fail("This reply link isn't valid.", 404);
  if (message.length < 2) return fail("Please write a message.");

  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0).slice(0, MAX_FILES);
  if (files.reduce((n, f) => n + f.size, 0) > MAX_TOTAL) return fail("Those files are too large. Keep the total under 4 MB.", 413);
  const prepared: { name: string; mime: string; buf: Buffer }[] = [];
  for (const f of files) {
    const buf = Buffer.from(await f.arrayBuffer());
    const mime = sniff(buf);
    if (!mime) return fail("Attach PNG, JPG, GIF, WebP or PDF files only.");
    prepared.push({ name: (f.name || "attachment").replace(/[^\w.\- ]+/g, "_").slice(-80) || "attachment", mime, buf });
  }

  const link = await prisma.emailReplyLink.findUnique({ where: { tokenHash: hashReplyToken(token) } });
  if (!link) return fail("This reply link isn't valid.", 404);
  if (link.expiresAt < new Date()) return fail("This reply link has expired. Please use the contact form instead.", 410);
  if (link.replies >= MAX_REPLIES_PER_LINK) return fail("This reply link has been used too many times. Please use the contact form instead.", 429);

  const email = link.to;
  const known = await prisma.user.findFirst({ where: { email }, select: { name: true } }).catch(() => null);
  const name = nameIn || known?.name || email.split("@")[0];
  const body = message;

  try {
    let ticket = link.requestId ? await prisma.supportRequest.findFirst({ where: { id: link.requestId, email } }) : null;
    if (ticket) {
      const target = await resolveMerged(ticket);
      const att = [];
      for (const a of prepared) att.push(await prisma.supportAttachment.create({ data: { requestId: target.id, name: a.name, mime: a.mime, size: a.buf.length, data: a.buf } }));
      await addVisitorMessage(target.id, name, body, { attachmentIds: att.map((a) => a.id) });
      ticket = target;
    } else {
      ticket = await createTicket({ name, email, topic: "Email reply", source: "EMAIL_REPLY", message: `In reply to: ${oneLine(link.subject, 200)}\n\n${body}`, workspaceId: link.workspaceId });
      for (const a of prepared) await prisma.supportAttachment.create({ data: { requestId: ticket.id, name: a.name, mime: a.mime, size: a.buf.length, data: a.buf } });
    }
    await prisma.emailReplyLink.update({ where: { id: link.id }, data: { requestId: ticket.id, replies: { increment: 1 } } });

    const ref = refOf(ticket.id);
    const inboxUrl = `${appUrl()}/admin/inbox?open=${ticket.id}`;
    const subject = oneLine(link.subject, 150);

    // A copy to the team, with a button into the inbox. Reply-To is the sender, so a plain reply from the mailbox goes to them.
    const fwd = buildEmail({
      icon: "chat",
      preheader: `${plain(name)} replied to "${plain(subject)}"`,
      title: "New reply to an email",
      align: "left",
      paragraphs: plain(body).slice(0, 3000).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
      details: [["From", `${plain(name)} <${email}>`], ["In reply to", plain(subject)], ["Ticket", ref], ...(prepared.length ? [["Attachments", `${prepared.length} (open the ticket to view)`] as [string, string]] : [])],
      button: { label: "Reply in the inbox", url: inboxUrl },
      note: `You can also just reply to this email. It goes to ${email}. Replies sent from the inbox are saved on the ticket.`,
    });
    const fwdSubject = `Reply from ${oneLine(plain(name), 60)}: ${subject}`;
    await Promise.all(forwardTargets().map((to) => sendEmail(to, fwdSubject, fwd.text, { html: fwd.html, kind: "reply-forward", replyTo: email })));

    const ack = buildEmail({
      icon: "chat",
      preheader: "We received your reply.",
      title: "We got your reply",
      align: "left",
      paragraphs: [`Hi ${plain(name).split(" ")[0]},`, `Thanks for writing back about "${plain(subject)}". A person will read it and answer by email.`, "To add something, just reply to this email."],
      details: [["Reference", ref]],
    });
    await sendEmail(email, `Re: ${subject} (${ref})`, ack.text, { html: ack.html, kind: "reply-ack" });

    return NextResponse.json({ ok: true, ref });
  } catch {
    return fail("We couldn't send your reply. Please try again, or use the contact form.", 500);
  }
}
