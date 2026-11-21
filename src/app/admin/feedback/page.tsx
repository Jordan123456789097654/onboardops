import { prisma } from "@/lib/prisma";
import { requireStaffPage, SUPPORT_STAFF } from "@/lib/platform";
import { Board } from "./board";

export const metadata = { title: "Beta feedback" };

export default async function FeedbackPage() {
  await requireStaffPage(SUPPORT_STAFF);
  const rows = await prisma.supportRequest.findMany({ where: { topic: "Feedback" }, orderBy: { createdAt: "desc" }, take: 300 });
  const ids = Array.from(new Set(rows.map((r) => r.workspaceId).filter((x): x is string => !!x)));
  const ws = await prisma.workspace.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  const name = new Map(ws.map((w) => [w.id, w.name]));
  return <Board cards={rows.map((r) => ({ id: r.id, ref: r.id.slice(-8).toUpperCase(), name: r.name, message: r.message, workspaceId: r.workspaceId, workspace: r.workspaceId ? name.get(r.workspaceId) ?? null : null, status: r.boardStatus ?? "NEW", at: r.createdAt.toISOString() }))} />;
}
