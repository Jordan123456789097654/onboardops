import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { ReplyForm } from "@/components/reply-form";
import { prisma } from "@/lib/prisma";
import { hashReplyToken } from "@/lib/email-reply";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reply to our email", robots: { index: false, follow: false } };

export default async function ReplyPage({ params }: { params: { token: string } }) {
  const t = params.token;
  const link = /^[A-Za-z0-9_-]{20,80}$/.test(t) ? await prisma.emailReplyLink.findUnique({ where: { tokenHash: hashReplyToken(t) }, select: { subject: true, expiresAt: true } }).catch(() => null) : null;
  if (!link || link.expiresAt < new Date()) {
    return (
      <PageShell narrow title={link ? "This reply link has expired" : "That link didn't work"}>
        <p className="text-[15px] text-soft">Reply links stop working after 30 days. You can still reach us through the <Link className="text-accent underline" href="/contact">contact form</Link> and we will answer by email.</p>
      </PageShell>
    );
  }
  return (
    <PageShell narrow eyebrow="Reply" title="Reply to our email" intro={`You are replying to: ${link.subject}`}>
      <ReplyForm token={t} />
    </PageShell>
  );
}
