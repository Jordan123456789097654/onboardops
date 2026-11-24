import { createHash, randomBytes } from "crypto";
import { lookup } from "dns/promises";
import { isIP } from "net";
import { basePrisma } from "./prisma-base";
import { open } from "./secret-box";

export const SIEM_PROVIDERS = ["splunk", "datadog", "sentinel", "crowdstrike", "webhook"] as const;
export type SiemProvider = (typeof SIEM_PROVIDERS)[number];

export type SiemStoredConfig = {
  enabled: boolean;
  provider: SiemProvider;
  endpointUrl: string;
  tokenEnc: string;
  indexName?: string;
  sourceTag?: string;
  updatedAt?: string;
};

export type SiemPublicConfig = {
  enabled: boolean;
  provider: SiemProvider;
  endpointUrl: string;
  configured: boolean;
  indexName: string;
  sourceTag: string;
  updatedAt: string | null;
};

export type SiemAuditEvent = {
  id: string;
  actionType: string;
  targetType: string;
  targetId: string;
  actorName: string;
  summary: string;
  hash: string;
  createdAt: Date | string;
  metadata?: unknown;
};

export function isSiemProvider(v: unknown): v is SiemProvider {
  return typeof v === "string" && (SIEM_PROVIDERS as readonly string[]).includes(v);
}

export function parseSiemStoredConfig(raw: unknown): SiemStoredConfig | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const provider: SiemProvider = isSiemProvider(o.provider) ? o.provider : "splunk";
  const endpointUrl = typeof o.endpointUrl === "string" ? o.endpointUrl.trim() : "";
  const tokenEnc = typeof o.tokenEnc === "string" ? o.tokenEnc.trim() : "";
  if (!endpointUrl || !tokenEnc) return null;
  return {
    enabled: o.enabled === true,
    provider,
    endpointUrl,
    tokenEnc,
    indexName: typeof o.indexName === "string" ? o.indexName.trim() : "",
    sourceTag: typeof o.sourceTag === "string" ? o.sourceTag.trim() : "",
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : undefined,
  };
}

export function getSiemPublicConfig(raw: unknown): SiemPublicConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      enabled: false,
      provider: "splunk",
      endpointUrl: "",
      configured: false,
      indexName: "",
      sourceTag: "",
      updatedAt: null,
    };
  }
  const o = raw as Record<string, unknown>;
  const provider: SiemProvider = isSiemProvider(o.provider) ? o.provider : "splunk";
  const endpointUrl = typeof o.endpointUrl === "string" ? o.endpointUrl.trim() : "";
  const tokenEnc = typeof o.tokenEnc === "string" ? o.tokenEnc.trim() : "";
  return {
    enabled: o.enabled === true && Boolean(endpointUrl && tokenEnc),
    provider,
    endpointUrl,
    configured: Boolean(endpointUrl && tokenEnc),
    indexName: typeof o.indexName === "string" ? o.indexName.trim() : "",
    sourceTag: typeof o.sourceTag === "string" ? o.sourceTag.trim() : "",
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : null,
  };
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return true;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = nums;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

function isPrivateIp(rawIp: string): boolean {
  const ip = rawIp.replace(/^\[|\]$/g, "").toLowerCase();
  if (ip.includes(":")) {
    if (ip === "::1" || ip === "::" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe8") || ip.startsWith("fe9") || ip.startsWith("fea") || ip.startsWith("feb") || ip.startsWith("ff")) {
      return true;
    }
    if (ip.startsWith("::ffff:")) {
      const mapped = ip.slice(7);
      if (mapped.includes(".")) return isPrivateIpv4(mapped);
      // Hex form of IPv4-mapped IPv6, e.g. ::ffff:7f00:1 or ::ffff:c0a8:101
      const segs = mapped.split(":");
      if (segs.length === 2) {
        const hi = parseInt(segs[0], 16);
        const lo = parseInt(segs[1], 16);
        if (!Number.isNaN(hi) && !Number.isNaN(lo)) {
          const ipv4 = `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
          return isPrivateIpv4(ipv4);
        }
      }
      return true;
    }
    return false;
  }
  return isPrivateIpv4(ip);
}

/** Validates a SIEM endpoint URL synchronously for HTTPS-only & SSRF safety. */
export function validateSiemEndpointUrl(raw: string): { ok: true; url: URL } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "Enter a SIEM endpoint URL." };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: "Enter a valid https:// URL." };
  }
  if (url.protocol !== "https:") {
    return { ok: false, error: "SIEM endpoint URL must use https://." };
  }
  if (url.username || url.password) {
    return { ok: false, error: "Remove embedded credentials from the SIEM endpoint URL." };
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  ) {
    return { ok: false, error: "Localhost and internal hostnames are not allowed." };
  }
  const ipType = isIP(host);
  if (ipType !== 0) {
    if (isPrivateIp(host)) {
      return { ok: false, error: "Private, loopback, and link-local IP addresses are not allowed." };
    }
  } else if (!host.includes(".")) {
    return { ok: false, error: "Enter a fully qualified public hostname." };
  }
  return { ok: true, url };
}

async function resolveAndVerifyPublicHost(url: URL): Promise<{ ok: true } | { ok: false; error: string }> {
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (isIP(host) !== 0) {
    return isPrivateIp(host) ? { ok: false, error: "Private IP address blocked." } : { ok: true };
  }
  try {
    const addrs = await lookup(host, { all: true });
    if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
      return { ok: false, error: "Endpoint host resolved to a private or loopback IP address." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not resolve SIEM endpoint hostname." };
  }
}

export function formatSiemPayload(
  config: Pick<SiemStoredConfig, "provider" | "indexName" | "sourceTag">,
  token: string,
  event: SiemAuditEvent,
): { headers: Record<string, string>; body: string } {
  const createdDate = event.createdAt instanceof Date ? event.createdAt : new Date(event.createdAt);
  const createdIso = Number.isNaN(createdDate.getTime()) ? new Date().toISOString() : createdDate.toISOString();
  const epochSec = Math.floor(new Date(createdIso).getTime() / 1000);
  const normalized = {
    id: event.id,
    actionType: event.actionType,
    targetType: event.targetType,
    targetId: event.targetId,
    actorName: event.actorName,
    summary: event.summary,
    hash: event.hash,
    createdAt: createdIso,
    ...(event.metadata !== undefined ? { metadata: event.metadata } : {}),
  };

  const baseHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "OnboardOps-SIEM/1",
  };

  switch (config.provider) {
    case "splunk":
      return {
        headers: { ...baseHeaders, Authorization: `Splunk ${token}` },
        body: JSON.stringify({
          time: epochSec,
          host: "onboardops",
          source: config.sourceTag || "onboardops-audit",
          sourcetype: "_json",
          ...(config.indexName ? { index: config.indexName } : {}),
          event: normalized,
        }),
      };
    case "datadog":
      return {
        headers: { ...baseHeaders, "DD-API-KEY": token },
        body: JSON.stringify([
          {
            ddsource: config.sourceTag || "onboardops",
            service: "onboardops-audit",
            ddtags: "env:prod",
            message: normalized.summary,
            ...normalized,
          },
        ]),
      };
    case "sentinel":
      return {
        headers: { ...baseHeaders, Authorization: `Bearer ${token}` },
        body: JSON.stringify([normalized]),
      };
    case "crowdstrike":
      return {
        headers: { ...baseHeaders, Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          events: [{ timestamp: createdIso, attributes: normalized }],
        }),
      };
    case "webhook":
    default:
      return {
        headers: { ...baseHeaders, Authorization: `Bearer ${token}` },
        body: JSON.stringify(normalized),
      };
  }
}

async function recordDelivery(
  workspaceId: string,
  provider: string,
  result: { ok: boolean; statusCode: number | null; eventCount?: number; error?: string },
): Promise<void> {
  try {
    await basePrisma.siemDelivery.create({
      data: {
        workspaceId,
        provider,
        ok: result.ok,
        statusCode: result.statusCode,
        eventCount: result.eventCount ?? 1,
        error: result.error ? result.error.slice(0, 300) : null,
      },
    });
    const stale = await basePrisma.siemDelivery.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      skip: 200,
      select: { id: true },
    });
    if (stale.length > 0) {
      await basePrisma.siemDelivery.deleteMany({
        where: { id: { in: stale.map((r) => r.id) } },
      });
    }
  } catch {
    // Delivery log failures must never propagate to audit writes.
  }
}

async function deliverSingleEvent(
  workspaceId: string,
  config: SiemStoredConfig,
  event: SiemAuditEvent,
): Promise<{ ok: boolean; statusCode: number | null; error?: string }> {
  const urlCheck = validateSiemEndpointUrl(config.endpointUrl);
  if (!urlCheck.ok) {
    const out = { ok: false, statusCode: null, error: urlCheck.error };
    await recordDelivery(workspaceId, config.provider, out);
    return out;
  }

  const dnsCheck = await resolveAndVerifyPublicHost(urlCheck.url);
  if (!dnsCheck.ok) {
    const out = { ok: false, statusCode: null, error: dnsCheck.error };
    await recordDelivery(workspaceId, config.provider, out);
    return out;
  }

  const token = open(config.tokenEnc);
  if (!token) {
    const out = { ok: false, statusCode: null, error: "Stored SIEM token could not be decrypted." };
    await recordDelivery(workspaceId, config.provider, out);
    return out;
  }

  const { headers, body } = formatSiemPayload(config, token, event);

  try {
    const res = await fetch(urlCheck.url, {
      method: "POST",
      redirect: "error",
      headers,
      body,
      signal: AbortSignal.timeout(4000),
    });
    let error: string | undefined;
    if (!res.ok) {
      let detail = "";
      try {
        detail = (await res.text()).replace(/\s+/g, " ").trim().slice(0, 160);
      } catch {}
      error = detail ? `HTTP ${res.status}: ${detail}` : `Endpoint answered HTTP ${res.status}`;
    }
    const out = { ok: res.ok, statusCode: res.status, ...(error ? { error } : {}) };
    await recordDelivery(workspaceId, config.provider, out);
    return out;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "SIEM delivery failed";
    const out = { ok: false, statusCode: null, error: msg.slice(0, 240) };
    await recordDelivery(workspaceId, config.provider, out);
    return out;
  }
}

/**
 * Dispatches a single audit log entry to the workspace's configured SIEM.
 * Never throws so audit writes can never fail due to SIEM downtime or network issues.
 */
export async function dispatchAuditToSiem(workspaceId: string, event: SiemAuditEvent): Promise<void> {
  try {
    const ws = await basePrisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { siemConfig: true },
    });
    const config = parseSiemStoredConfig(ws?.siemConfig);
    if (!config || !config.enabled) return;
    await deliverSingleEvent(workspaceId, config, event);
  } catch {
    // Intentionally swallowed: SIEM delivery is best-effort and must never fail audit writes.
  }
}

/** Sends a synthetic SIEM_TEST_EVENT to verify endpoint connectivity and records a SiemDelivery row. */
export async function sendSiemTestEvent(
  workspaceId: string,
  actorName: string,
): Promise<{ ok: boolean; statusCode: number | null; error?: string }> {
  const ws = await basePrisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { siemConfig: true },
  });
  const config = parseSiemStoredConfig(ws?.siemConfig);
  if (!config) {
    return { ok: false, statusCode: null, error: "Save a SIEM endpoint URL and token before sending a test event." };
  }
  const now = new Date();
  const event: SiemAuditEvent = {
    id: `siem_test_${randomBytes(6).toString("hex")}`,
    actionType: "SIEM_TEST_EVENT",
    targetType: "Workspace",
    targetId: workspaceId,
    actorName,
    summary: `Synthetic SIEM connectivity test triggered by ${actorName}`,
    hash: createHash("sha256").update(`siem-test:${workspaceId}:${now.toISOString()}`).digest("hex"),
    createdAt: now.toISOString(),
    metadata: { synthetic: true, provider: config.provider },
  };
  return deliverSingleEvent(workspaceId, config, event);
}
