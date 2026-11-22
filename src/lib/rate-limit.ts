import { headers } from "next/headers";
import { prisma } from "./prisma";

export class RateLimitError extends Error {
  retryAfter: number;
  constructor(retryAfter: number) {
    super(`Too many attempts. Try again in ${retryAfter > 90 ? `${Math.ceil(retryAfter / 60)} minutes` : `${retryAfter} seconds`}.`);
    this.retryAfter = retryAfter;
  }
}

export function clientIp(h?: Headers): string {
  const hh = h ?? headers();
  return (hh.get("x-forwarded-for") ?? hh.get("x-real-ip") ?? "unknown").split(",")[0].trim().slice(0, 64) || "unknown";
}

/**
 * Fixed-window counter in the database (works across serverless instances).
 * Returns the seconds to wait when over the limit, or 0 when allowed. Fails open if the database call fails.
 */
export async function hit(key: string, limit: number, windowSec: number): Promise<number> {
  try {
    const rows = await prisma.$queryRaw<{ count: number; ttl: number }[]>`
      INSERT INTO "RateLimit" ("key", "count", "resetAt")
      VALUES (${key}, 1, now() + (${windowSec} * interval '1 second'))
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimit"."resetAt" < now() THEN 1 ELSE "RateLimit"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" < now() THEN now() + (${windowSec} * interval '1 second') ELSE "RateLimit"."resetAt" END
      RETURNING "count", GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("resetAt" - now()))))::int AS ttl`;
    if (Math.random() < 0.01) prisma.$executeRaw`DELETE FROM "RateLimit" WHERE "resetAt" < now() - interval '1 day'`.catch(() => {});
    const r = rows[0];
    return r && r.count > limit ? Number(r.ttl) : 0;
  } catch {
    return 0;
  }
}

/** Per-IP limit for server actions. Throws a friendly error (caught by run()) when exceeded. */
export async function enforceRate(name: string, limit: number, windowSec: number, extra?: string) {
  const wait = await hit(`${name}:ip:${clientIp()}`, limit, windowSec);
  if (wait) throw new RateLimitError(wait);
  if (extra) {
    const w2 = await hit(`${name}:id:${extra.toLowerCase().slice(0, 120)}`, Math.max(3, Math.floor(limit / 2)), windowSec);
    if (w2) throw new RateLimitError(w2);
  }
}
