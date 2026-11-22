import { prisma } from "./prisma";
import { hit } from "./rate-limit";
import { createHash } from "crypto";
import { getMaintenanceCached } from "./maintenance";

/** Bearer-token auth for /api/v1. Keys are stored only as SHA-256 hashes. Returns the workspace or an error Response. */
export async function authApiKey(req: Request): Promise<{ workspaceId: string; keyId: string } | Response> {
  const mt = await getMaintenanceCached().catch(() => null);
  if (mt && mt.enabled && mt.areas.includes("api")) {
    const wait = mt.endsAt && Date.parse(mt.endsAt) > Date.now() ? Math.ceil((Date.parse(mt.endsAt) - Date.now()) / 1000) : 600;
    return Response.json({ error: "The API is down for maintenance. Try again later." }, { status: 503, headers: { "Retry-After": String(Math.min(wait, 3600)) } });
  }
  const m = /^Bearer (oo_live_[a-f0-9]{48})$/.exec(req.headers.get("authorization") ?? "");
  if (!m) return Response.json({ error: "Missing or malformed API key. Send Authorization: Bearer <key>." }, { status: 401 });
  const key = await prisma.apiKey.findUnique({ where: { keyHash: createHash("sha256").update(m[1]).digest("hex") } });
  if (!key || key.revokedAt) return Response.json({ error: "Invalid or revoked API key." }, { status: 401 });
  const wait = await hit(`api:${key.id}`, 120, 60);
  if (wait) return Response.json({ error: "Rate limit exceeded (120 requests a minute)." }, { status: 429, headers: { "Retry-After": String(wait) } });
  if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > 5 * 60_000) await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return { workspaceId: key.workspaceId, keyId: key.id };
}
