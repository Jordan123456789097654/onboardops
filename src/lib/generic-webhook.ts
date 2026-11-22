import { createHmac } from "crypto";
import { lookup } from "dns/promises";
import { isIP } from "net";

function privateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const l = ip.toLowerCase();
    return l === "::1" || l === "::" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80") || l.startsWith("::ffff:127.") || l.startsWith("::ffff:10.") || l.startsWith("::ffff:192.168.");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/** Only public https endpoints: no IP literals, no internal names, and every resolved address must be public. */
export async function safePublicUrl(raw: string): Promise<{ ok: true; url: URL } | { ok: false; error: string }> {
  let u: URL;
  try { u = new URL(raw); } catch { return { ok: false, error: "Enter a full https:// URL." }; }
  if (u.protocol !== "https:") return { ok: false, error: "The URL must start with https://." };
  if (u.username || u.password) return { ok: false, error: "Remove the username and password from the URL." };
  const host = u.hostname.toLowerCase();
  if (isIP(host) || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".")) return { ok: false, error: "Use a public domain name, not an address or an internal host." };
  try {
    const addrs = await lookup(host, { all: true });
    if (!addrs.length || addrs.some((a) => privateIp(a.address))) return { ok: false, error: "That host resolves to a private address." };
  } catch {
    return { ok: false, error: "That host could not be found." };
  }
  return { ok: true, url: u };
}

/** Signed JSON webhook. Header X-OnboardOps-Signature is "sha256=" + HMAC-SHA256 of the raw body with your secret. Never throws. */
export async function sendGenericWebhook(url: string | null | undefined, secret: string, event: string, data: unknown): Promise<{ ok: boolean; error?: string }> {
  if (!url) return { ok: false, error: "No webhook configured" };
  const safe = await safePublicUrl(url);
  if (!safe.ok) return { ok: false, error: safe.error };
  const body = JSON.stringify({ event, at: new Date().toISOString(), data });
  try {
    const res = await fetch(safe.url, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      headers: { "Content-Type": "application/json", "User-Agent": "OnboardOps-Webhook/1", "X-OnboardOps-Event": event, ...(secret ? { "X-OnboardOps-Signature": `sha256=${createHmac("sha256", secret).update(body).digest("hex")}` } : {}) },
      body,
    });
    return res.ok ? { ok: true } : { ok: false, error: `Endpoint answered ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 120) : "Request failed" };
  }
}
