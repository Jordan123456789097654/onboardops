import dns from "node:dns/promises";
import { aiConfigured } from "@/lib/ai/groq";
import type { ComponentHealth } from "./status";

/**
 * Extra health checks for monitors. Each one is cheap, has a short timeout, sends no secrets and never calls a paid endpoint.
 * They are served one at a time at /api/status/<name> (and /status/<name> on the API host), and are deliberately kept out of the
 * overall status so a problem at an outside provider cannot turn the whole status page red.
 */
type Mk = (status: ComponentHealth["status"], message: string) => ComponentHealth;
const maker = (service: string, start: number): Mk => (status, message) => ({ service, status, ok: status !== "down", latencyMs: Date.now() - start, message, timestamp: new Date().toISOString() });

/** Any answer below 500 means the other side is reachable. */
async function reach(url: string, ms = 6000): Promise<{ ok: boolean; ms: number; code?: number }> {
  const t = Date.now();
  try {
    const r = await fetch(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(ms), headers: { "User-Agent": "OnboardOps-status-check" } });
    return { ok: r.status < 500, ms: Date.now() - t, code: r.status };
  } catch {
    return { ok: false, ms: Date.now() - t };
  }
}

/** AI features: is the provider reachable, and is AI turned on here. Never sends a prompt or uses a key. */
export async function checkAi(): Promise<ComponentHealth> {
  const mk = maker("ai", Date.now());
  if (!aiConfigured()) return mk("up", "AI features are turned off");
  const r = await reach("https://api.groq.com/");
  if (!r.ok) return mk("degraded", "The AI provider is not answering, so AI helpers may be unavailable");
  return mk(r.ms > 3000 ? "degraded" : "up", r.ms > 3000 ? `The AI provider is slow (${r.ms} ms)` : "AI provider reachable");
}

/** Sign-in with Google and GitHub: only checks the providers that are switched on. */
export async function checkOauth(): Promise<ComponentHealth> {
  const mk = maker("oauth", Date.now());
  const on = [
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? { name: "Google", url: "https://accounts.google.com/.well-known/openid-configuration" } : null,
    process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET ? { name: "GitHub", url: "https://github.com/login" } : null,
  ].filter((x): x is { name: string; url: string } => !!x);
  if (!on.length) return mk("up", "No social sign-in providers are turned on");
  const res = await Promise.all(on.map(async (p) => ({ ...p, r: await reach(p.url) })));
  const bad = res.filter((x) => !x.r.ok).map((x) => x.name);
  return bad.length ? mk("degraded", `${bad.join(" and ")} sign-in may not work right now`) : mk("up", `${on.map((p) => p.name).join(" and ")} sign-in reachable`);
}

/** Discord: the notice webhooks are set and Discord itself answers. */
export async function checkDiscord(): Promise<ComponentHealth> {
  const mk = maker("discord", Date.now());
  const hooks = Object.keys(process.env).filter((k) => k.startsWith("DISCORD_WEBHOOK_") && process.env[k]).length;
  const r = await reach("https://discord.com/api/v10/gateway");
  if (!r.ok) return mk("degraded", "Discord is not answering, so staff notices may be delayed");
  return mk("up", hooks ? `Discord reachable, ${hooks} notice channel${hooks === 1 ? "" : "s"} set up` : "Discord reachable, no notice channels set up");
}

const txt = async (name: string): Promise<string[]> => (await dns.resolveTxt(name).catch(() => [] as string[][])).map((a) => a.join(""));

/** Email authentication for our own domain: SPF, DKIM and DMARC. Missing or wrong records make mail land in spam or get rejected (for example by Gmail). */
export async function checkMailAuth(): Promise<ComponentHealth> {
  const mk = maker("mailauth", Date.now());
  let host = "onboardops.org";
  try { host = new URL(process.env.APP_URL || "https://onboardops.org").hostname.replace(/^www\./, ""); } catch { /* keep default */ }
  const [root, dmarc, mx] = await Promise.all([txt(host), txt(`_dmarc.${host}`), dns.resolveMx(host).catch(() => [])]);
  const spf = root.find((r) => r.toLowerCase().startsWith("v=spf1"));
  const dkim = (await Promise.all(["zmail", "zoho", "resend", "default", "google", "selector1", "s1"].map(async (s) => ((await txt(`${s}._domainkey.${host}`)).length ? s : null)))).filter(Boolean);
  const problems: string[] = [];
  if (!spf) problems.push("no SPF record");
  else if (!/include:|ip4:|ip6:|\ba\b|\bmx\b/i.test(spf)) problems.push("the SPF record does not authorise any sender");
  else if (!/zoho|zmail/i.test(spf)) problems.push("SPF does not authorise Zoho");
  if (!dkim.length) problems.push("no DKIM key found");
  if (!dmarc.some((r) => r.toLowerCase().startsWith("v=dmarc1"))) problems.push("no DMARC record");
  if (!mx.length) problems.push("no MX records");
  if (problems.length) return mk("degraded", `Email authentication needs attention: ${problems.join(", ")}`);
  return mk("up", `SPF, DKIM (${dkim.join(", ")}) and DMARC are in place`);
}
