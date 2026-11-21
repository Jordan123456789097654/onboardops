import { prisma } from "@/lib/prisma";
import { requireStaffPage, SUPPORT_STAFF } from "@/lib/platform";
import { Inbox, type Req } from "./inbox";

export const metadata = { title: "Support inbox" };

export default async function InboxPage({ searchParams }: { searchParams: { status?: string; open?: string } }) {
  const staff = await requireStaffPage(SUPPORT_STAFF);
  const rows = await prisma.supportRequest.findMany({
    where: { NOT: { topic: "Privacy request" } },
    include: { messages: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const wsIds = Array.from(new Set(rows.map((r) => r.workspaceId).filter((x): x is string => !!x)));
  const wss = await prisma.workspace.findMany({ where: { id: { in: wsIds } }, select: { id: true, name: true } });
  const wname = new Map(wss.map((w) => [w.id, w.name]));
  const data: Req[] = rows.map((r) => ({
    id: r.id, ref: r.id.slice(-8).toUpperCase(), name: r.name, email: r.email, topic: r.topic, message: r.message, status: r.status, source: r.source, assignee: r.assignee,
    workspaceId: r.workspaceId, workspaceName: r.workspaceId ? wname.get(r.workspaceId) ?? "Deleted workspace" : null, createdAt: r.createdAt.toISOString(),
    messages: r.messages.map((m) => ({ id: m.id, kind: m.kind, author: m.authorName, body: m.body, emailed: m.emailed, at: m.createdAt.toISOString() })),
  }));
  return <Inbox rows={data} me={staff.name} initialStatus={searchParams.status ?? ""} openId={searchParams.open ?? null} />;
}
