import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { PRIORITIES, allStatuses, getSupportConfig } from "@/lib/support-config";
import { emitSupportEvent } from "@/lib/support";
import { staffAudit } from "@/lib/platform";
import { apiError, authSupportApi, ticketJson } from "@/lib/support-api";

export const dynamic = "force-dynamic";

async function load(id: string) {
  const t = await prisma.supportRequest.findUnique({ where: { id } });
  return t && t.topic !== "Privacy request" ? t : null;
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await authSupportApi(req);
  if ("res" in auth) return auth.res;
  const t = await load(params.id);
  if (!t) return apiError("Not found", 404);
  const msgs = await prisma.supportMessage.findMany({ where: { requestId: t.id, kind: { in: ["REPLY", "VISITOR", "SYSTEM"] } }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ ticket: ticketJson(t, 5000), messages: msgs.map((m) => ({ id: m.id, kind: m.kind, author: m.authorName, body: m.body, at: m.createdAt.toISOString() })) });
}

const patch = z.object({
  status: z.string().trim().optional(),
  priority: z.enum(PRIORITIES).optional(),
  tags: z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9-]{1,30}$/)).max(12).optional(),
  assignee: z.string().trim().max(100).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await authSupportApi(req);
  if ("res" in auth) return auth.res;
  const t = await load(params.id);
  if (!t) return apiError("Not found", 404);
  const d = patch.safeParse(await req.json().catch(() => null));
  if (!d.success) return apiError(d.error.issues.map((i) => i.message).join(". "), 400);
  const cfg = await getSupportConfig();
  if (d.data.status && !allStatuses(cfg).includes(d.data.status)) return apiError("Unknown status", 400);
  const data: Record<string, unknown> = { ...d.data };
  if (d.data.status === "SOLVED") { data.solvedAt = new Date(); data.resolvedHint = false; }
  else if (d.data.status && t.status === "SOLVED") data.solvedAt = null;
  const u = await prisma.supportRequest.update({ where: { id: t.id }, data });
  await staffAudit(prisma, { id: `api:${auth.key.id}`, name: `API key: ${auth.key.name}`, email: "", role: "SUPPORT" }, { action: "SUPPORT_API_UPDATE", targetType: "SupportRequest", targetId: t.id, workspaceId: t.workspaceId, summary: `API updated request ${t.id.slice(-8).toUpperCase()}: ${Object.keys(d.data).join(", ")}` }).catch(() => {});
  if (d.data.status === "SOLVED" && t.status !== "SOLVED") await emitSupportEvent("ticket.solved", u);
  return NextResponse.json({ ticket: ticketJson(u) });
}
