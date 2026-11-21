import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Profile pictures are visible to the owner and to people who share a workspace with them. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const viewer = await getSessionUserId(false);
  if (!viewer) return new Response("Unauthorized", { status: 401 });
  const u = await prisma.user.findUnique({ where: { id: params.id }, select: { avatarData: true, avatarMime: true } });
  if (!u?.avatarData || !u.avatarMime) return new Response("Not found", { status: 404 });
  if (viewer !== params.id) {
    const mine = await prisma.workspaceMember.findMany({ where: { userId: viewer }, select: { workspaceId: true } });
    const shared = await prisma.workspaceMember.count({ where: { userId: params.id, workspaceId: { in: mine.map((m) => m.workspaceId) } } });
    if (!shared) return new Response("Not found", { status: 404 });
  }
  return new Response(new Uint8Array(u.avatarData), { headers: { "Content-Type": u.avatarMime, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'" } });
}
