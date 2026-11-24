/**
 * The visitor's real address and country, safe to use for rate limits.
 *
 * Normally Vercel sets x-forwarded-for / x-real-ip itself and a caller cannot fake them. If the site is put behind Cloudflare,
 * Vercel only sees Cloudflare's address, so the real one arrives in cf-connecting-ip. That header is only believable when the
 * request provably came through OUR Cloudflare, otherwise anyone could set it and dodge every limit. So we trust it only when
 * the request also carries a secret header that a Cloudflare rule adds (x-oo-origin-secret; its value is CF_ORIGIN_SECRET in Vercel).
 */
type Get = (name: string) => string | null | undefined;

export function viaOurCloudflare(get: Get, secret = process.env.CF_ORIGIN_SECRET): boolean {
  const sent = get("x-oo-origin-secret");
  if (!secret || secret.length < 16 || !sent || sent.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= secret.charCodeAt(i) ^ sent.charCodeAt(i);
  return diff === 0;
}

export function trustedClientIp(get: Get, secret = process.env.CF_ORIGIN_SECRET): string {
  if (viaOurCloudflare(get, secret)) {
    const cf = (get("cf-connecting-ip") ?? "").trim();
    if (cf) return cf.slice(0, 64);
  }
  return (get("x-forwarded-for") ?? get("x-real-ip") ?? "unknown").split(",")[0].trim().slice(0, 64) || "unknown";
}

export function trustedCountry(get: Get, secret = process.env.CF_ORIGIN_SECRET): string | undefined {
  const c = viaOurCloudflare(get, secret) ? get("cf-ipcountry") : get("x-vercel-ip-country");
  return c || undefined;
}
