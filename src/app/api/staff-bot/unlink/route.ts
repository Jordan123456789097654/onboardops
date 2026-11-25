import { prisma } from "@/lib/prisma";
import { authBot } from "@/lib/staff-bot";

export const dynamic = "force-dynamic";

/** Someone removes the link for their own Discord account. */
export async function POST(req: Request) {
  const a = await authBot(req, { needsUser: true });
  if (!a.ok) return a.res;
  const r = await prisma.discordLink.deleteMany({ where: { discordId: a.call.discordId! } });
  return Response.json({ removed: r.count > 0 }, { headers: { "Cache-Control": "no-store" } });
}
