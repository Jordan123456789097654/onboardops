import { createHash, timingSafeEqual } from "crypto";
import { prisma } from "./prisma";
import { hit } from "./rate-limit";
import { resolvePlatformRole } from "./platform-role";
import type { Staff } from "./platform";

/**
 * Authentication for the staff Discord bot's API. The bot sends a shared secret (STAFF_BOT_KEY) and says which Discord user is acting.
 * The secret proves the request came from the bot. The Discord user is then mapped to a staff account, and that account's own role is what counts.
 */

export const hashCode = (code: string) => createHash("sha256").update(code.trim().toUpperCase()).digest("hex");

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export type BotCall = { discordId: string | null };

/** Returns the call details, or a ready-made error response. Never says which part failed. */
export async function authBot(req: Request, opts: { needsUser?: boolean } = {}): Promise<{ ok: true; call: BotCall } | { ok: false; res: Response }> {
  const key = process.env.STAFF_BOT_KEY?.trim();
  if (!key || key.length < 32) return { ok: false, res: Response.json({ error: "The staff bot is not configured." }, { status: 503 }) };
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!given || !sameSecret(given, key)) return { ok: false, res: Response.json({ error: "Not authorized." }, { status: 401 }) };
  const wait = await hit("staffbot:all", 300, 60);
  if (wait) return { ok: false, res: Response.json({ error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(wait) } }) };
  const raw = req.headers.get("x-discord-user") ?? "";
  const discordId = /^\d{15,25}$/.test(raw) ? raw : null;
  if (opts.needsUser && !discordId) return { ok: false, res: Response.json({ error: "Missing Discord user." }, { status: 400 }) };
  return { ok: true, call: { discordId } };
}

/** The staff account linked to a Discord user. Same rules as the staff console: a staff role, and two-step sign-in turned on. */
export async function actorFor(discordId: string): Promise<Staff | null> {
  const link = await prisma.discordLink.findUnique({ where: { discordId } });
  if (!link) return null;
  const u = await prisma.user.findUnique({ where: { id: link.userId }, select: { id: true, name: true, email: true, platformRole: true, emailVerifiedAt: true, totpEnabledAt: true, bannedAt: true } });
  if (!u || u.bannedAt) return null;
  const role = resolvePlatformRole(u);
  if (!role || !u.totpEnabledAt) return null;
  return { id: u.id, name: u.name, email: u.email, role };
}

export const noLink = () => Response.json({ error: "Link your staff account first with /link." }, { status: 403 });
