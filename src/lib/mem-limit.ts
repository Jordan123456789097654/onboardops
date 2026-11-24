/**
 * A tiny in-memory rate limiter that works in the edge middleware and in route handlers. It costs no database query, so a flood
 * of requests never reaches the database. It is per server instance, which makes it a first line of defense, not an exact count:
 * the database-backed limiter in ./rate-limit.ts stays in charge of sensitive actions such as sign-in.
 */
type Bucket = { n: number; reset: number };
const buckets = new Map<string, Bucket>();
const MAX_KEYS = 20000;

/** Returns 0 when the request is allowed, or the number of seconds to wait. */
export function memHit(key: string, limit: number, windowMs: number, now = Date.now()): number {
  const b = buckets.get(key);
  if (!b || b.reset <= now) {
    if (buckets.size >= MAX_KEYS) sweep(now);
    buckets.set(key, { n: 1, reset: now + windowMs });
    return 0;
  }
  b.n++;
  return b.n > limit ? Math.max(1, Math.ceil((b.reset - now) / 1000)) : 0;
}

function sweep(now: number) {
  for (const [k, b] of buckets) if (b.reset <= now) buckets.delete(k);
  // Still full of live entries (a wide attack): drop the oldest half so memory stays bounded.
  if (buckets.size >= MAX_KEYS) {
    let i = 0;
    for (const k of buckets.keys()) { if (i++ >= MAX_KEYS / 2) break; buckets.delete(k); }
  }
}

export const _resetMemLimit = () => buckets.clear();
