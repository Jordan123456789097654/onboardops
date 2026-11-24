import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { emails, sendEmail } from "@/lib/email";
import { emitSupportEvent, refOf } from "@/lib/support";
import { staffAudit } from "@/lib/platform";
import { apiError, authSupportApi } from "@/lib/support-api";

export const dynamic = "force-dynamic";

const body = z.object({ body: z.string().trim().min(2).max(8000), note: z.boolean().default(false), markSolved: z.boolean().default(false), author: z.string().trim().max(60).optional() });

/** POST { body, note?, markSolved?, author? }: emails a reply to the customer, or adds an internal note when note is true. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await authSupportApi(req);
  if ("res" in auth) return auth.res;
  const d = body.safeParse(await req.json().catch(() => null));
  if (!d.success) return apiError(d.error.issues.map((i) => i.message).join(". "), 400);
  const t = await prisma.supportRequest.findUnique({ where: { id: params.id } });
  if (!t || t.topic === "Privacy request") return apiError("Not found", 404);
  const author = d.data.author || auth.key.name;
  if (d.data.note) {
    await prisma.supportMessage.create({ data: { requestId: t.id, kind: "NOTE", authorName: author, body: d.data.body } });
    return NextResponse.json({ ok: true, kind: "NOTE" });
  }
  const m = emails.supportReply(t.name, refOf(t.id), d.data.body);
  const sent = await sendEmail(t.email, m.subject, m.text, { html: m.html, kind: "support-reply", workspaceId: t.workspaceId });
  await prisma.supportMessage.create({ data: { requestId: t.id, kind: "REPLY", authorName: author, body: d.data.body, emailed: sent.ok } });
  const u = await prisma.supportRequest.update({ where: { id: t.id }, data: { status: d.data.markSolved ? "SOLVED" : "WAITING", solvedAt: d.data.markSolved ? new Date() : null, resolvedHint: false, idleNudgedAt: null } });
  await staffAudit(prisma, { id: `api:${auth.key.id}`, name: `API key: ${auth.key.name}`, email: "", role: "SUPPORT" }, { action: "SUPPORT_API_REPLY", targetType: "SupportRequest", targetId: t.id, workspaceId: t.workspaceId, summary: `API replied to request ${refOf(t.id)}${d.data.markSolved ? " and closed it" : ""}` }).catch(() => {});
  await emitSupportEvent(d.data.markSolved ? "ticket.solved" : "ticket.replied", u, d.data.body);
  return NextResponse.json({ ok: true, kind: "REPLY", emailed: sent.ok, error: sent.error ?? null });
}
