import { actorFor, authBot } from "@/lib/staff-bot";

export const dynamic = "force-dynamic";

/** Who a Discord user is on the website: their name and staff role, never their email. */
export async function GET(req: Request) {
  const a = await authBot(req, { needsUser: true });
  if (!a.ok) return a.res;
  const s = await actorFor(a.call.discordId!);
  return Response.json(s ? { linked: true, name: s.name, role: s.role } : { linked: false }, { headers: { "Cache-Control": "no-store" } });
}
