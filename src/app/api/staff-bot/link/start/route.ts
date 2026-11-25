import { randomInt } from "crypto";
import { prisma } from "@/lib/prisma";
import { authBot, hashCode } from "@/lib/staff-bot";

export const dynamic = "force-dynamic";

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const MINUTES = 10;

/** The bot asks for a code for one Discord user. They type it into the staff console while signed in, which proves both accounts are theirs. */
export async function POST(req: Request) {
  const a = await authBot(req, { needsUser: true });
  if (!a.ok) return a.res;
  const discordId = a.call.discordId!;
  let code = "";
  for (let i = 0; i < 8; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  await prisma.discordLinkCode.deleteMany({ where: { OR: [{ discordId }, { expiresAt: { lt: new Date() } }] } });
  await prisma.discordLinkCode.create({ data: { codeHash: hashCode(code), discordId, expiresAt: new Date(Date.now() + MINUTES * 60_000) } });
  return Response.json({ code: `${code.slice(0, 4)}-${code.slice(4)}`, minutes: MINUTES }, { headers: { "Cache-Control": "no-store" } });
}
