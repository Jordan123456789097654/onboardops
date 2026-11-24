import { prisma } from "@/lib/prisma";
import { requireStaffPage, SUPPORT_STAFF } from "@/lib/platform";
import { aiConfigured } from "@/lib/ai/groq";
import { allStatuses, can, getSupportConfig } from "@/lib/support-config";
import { BUILT_IN_TEMPLATES } from "@/lib/support-templates";
import { runSupportSweep } from "@/lib/support";
import { Inbox } from "./inbox";
import type { InboxInfo, Req } from "./types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const metadata = { title: "Support inbox" };

export default async function InboxPage({ searchParams }: { searchParams: { status?: string; open?: string; q?: string } }) {
  const staff = await requireStaffPage(SUPPORT_STAFF);
  await Promise.race([runSupportSweep(), new Promise((r) => setTimeout(r, 5000))]);
  const cfg = await getSupportConfig();
  const q = (searchParams.q ?? "").trim().slice(0, 100);

  const rows = await prisma.supportRequest.findMany({
    where: {
      NOT: { topic: "Privacy request" },
      mergedIntoId: null,
      ...(q
        ? {
            OR: [
              { message: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { id: { endsWith: q.toLowerCase() } },
              { tags: { has: q.toLowerCase() } },
              { messages: { some: { kind: { not: "NOTE" }, body: { contains: q, mode: "insensitive" } } } },
              { messages: { some: { kind: "NOTE", body: { contains: q, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    include: { messages: { orderBy: { createdAt: "asc" } }, attachments: { select: { id: true, messageId: true, name: true, mime: true, size: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  const wsIds = Array.from(new Set(rows.map((r) => r.workspaceId).filter((x): x is string => !!x)));
  const [wss, staffRows, custom] = await Promise.all([
    prisma.workspace.findMany({ where: { id: { in: wsIds } }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { platformRole: { not: null } }, select: { name: true } }),
    prisma.supportCanned.findMany({ orderBy: { createdAt: "desc" } }),
  ]);
  const wname = new Map(wss.map((w) => [w.id, w.name]));
  const data: Req[] = rows.map((r) => ({
    id: r.id, ref: r.id.slice(-8).toUpperCase(), name: r.name, email: r.email, topic: r.topic, message: r.message, status: r.status, source: r.source, assignee: r.assignee,
    workspaceId: r.workspaceId, workspaceName: r.workspaceId ? wname.get(r.workspaceId) ?? "Deleted workspace" : null, createdAt: r.createdAt.toISOString(),
    priority: r.priority, tags: r.tags, category: r.category, sentiment: r.sentiment, aiSummary: r.aiSummary, resolvedHint: r.resolvedHint, inbox: r.inbox, spam: r.spam,
    linkedIds: r.linkedIds, rating: r.rating, ratingNote: r.ratingNote, pageUrl: r.pageUrl,
    messages: r.messages.map((m) => ({
      id: m.id, kind: m.kind, author: m.authorName, body: m.body, emailed: m.emailed, at: m.createdAt.toISOString(),
      files: r.attachments.filter((a) => a.messageId === m.id).map((a) => ({ id: a.id, name: a.name, mime: a.mime, size: a.size })),
    })),
  }));

  const staffNames = Array.from(new Set([staff.name, ...staffRows.map((s) => s.name)])).sort();
  const info: InboxInfo = {
    statuses: allStatuses(cfg),
    sla: cfg.sla,
    inboxes: cfg.inboxes.map((i) => ({ id: i.id, name: i.name })),
    staff: staffNames,
    can: { close: can(cfg, staff.role, "close"), delete: can(cfg, staff.role, "delete"), export: can(cfg, staff.role, "export"), block: can(cfg, staff.role, "block") },
    canned: [...custom.map((c) => ({ id: c.id, title: c.title, body: c.body, grp: c.grp })), ...BUILT_IN_TEMPLATES],
  };
  return <Inbox rows={data} me={staff.name} initialStatus={searchParams.status ?? ""} openId={searchParams.open ?? null} ai={aiConfigured()} info={info} initialQuery={q} />;
}
