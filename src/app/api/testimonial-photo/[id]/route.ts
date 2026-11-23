import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** The small photo or logo for a testimonial. The address carries a version (?v=) so a changed photo is fetched again. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const t = await prisma.testimonial.findUnique({ where: { id: params.id }, select: { photo: true, photoMime: true, visible: true } }).catch(() => null);
  if (!t?.photo || !t.photoMime) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(t.photo), { headers: { "Content-Type": t.photoMime, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff", "Access-Control-Allow-Origin": "*" } });
}
