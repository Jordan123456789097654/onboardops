const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const WEAK_SSL = new Set(["disable", "allow", "prefer"]);

/**
 * Hardens the database address for production:
 * - Every connection must use SSL. A missing sslmode becomes "require"; an explicit weak one (disable, allow, prefer) is refused.
 * - Connections fail fast instead of hanging, and each server instance has a small pool, so a flood of requests cannot exhaust the database.
 * Local databases (localhost) and non-production builds are left alone.
 */
export function hardenDatabaseUrl(raw: string | undefined, env: string | undefined = process.env.NODE_ENV): string | undefined {
  if (!raw || env !== "production") return raw;
  let u: URL;
  try { u = new URL(raw); } catch { return raw; }
  if (!/^postgres(ql)?:$/.test(u.protocol) || LOOPBACK.has(u.hostname)) return raw;
  const ssl = u.searchParams.get("sslmode");
  if (ssl && WEAK_SSL.has(ssl.toLowerCase())) throw new Error(`DATABASE_URL uses sslmode=${ssl}. Production requires an encrypted connection (sslmode=require or stronger).`);
  if (!ssl) u.searchParams.set("sslmode", "require");
  if (!u.searchParams.has("connect_timeout")) u.searchParams.set("connect_timeout", "10");
  if (!u.searchParams.has("pool_timeout")) u.searchParams.set("pool_timeout", "10");
  if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", "5");
  return u.toString();
}
