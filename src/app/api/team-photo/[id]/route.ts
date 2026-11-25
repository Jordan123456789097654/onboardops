import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** A team member's photo. The address carries a version (?v=) so a changed photo is fetched again. Hidden members' photos are not served. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const t = await prisma.teamMember.findUnique({ where: { id: params.id }, select: { photo: true, photoMime: true, visible: true } }).catch(() => null);
  if (!t?.photo || !t.photoMime || !t.visible) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(t.photo), { headers: { "Content-Type": t.photoMime, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
}
