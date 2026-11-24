import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { open } from "./secret-box";

/**
 * Duo Security Universal Prompt (OIDC Web SDK v4, HS512 JWT client assertions).
 * Strictly validates apiHost against ^api-[a-z0-9-]+\.duosecurity\.com$ to prevent SSRF.
 */

export const DUO_HOST_RE = /^api-[a-z0-9-]+\.duosecurity\.com$/;
export const DUO_COOKIE = "oo_duo";
export const DUO_TTL_SECONDS = 300;
const JWT_EXP_SECONDS = 300;

export const DUO_ERRORS: Record<string, string> = {
  unreachable: "Duo Security could not be reached right now. Please try again in a moment.",
  not_configured: "Duo Security MFA is not configured or enabled for this workspace.",
  state: "Your Duo verification session expired or did not start here. Please try again.",
  denied: "Duo Security verification was denied or cancelled.",
  failed: "We could not complete Duo Security verification. Please try again.",
  rate: "Too many verification attempts. Wait a few minutes and try again.",
};

export type DuoStoredConfig = {
  enabled: boolean;
  apiHost: string;
  clientId: string;
  clientSecretEnc: string;
  updatedAt?: string;
};

export type DuoPublicConfig = {
  enabled: boolean;
  apiHost: string;
  clientId: string;
  configured: boolean;
  updatedAt?: string | null;
};

export type DuoCallConfig =
  | { apiHost: string; clientId: string; clientSecret: string }
  | { apiHost: string; clientId: string; clientSecretEnc: string };

export const duoRedirectUri = () =>
  `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/api/auth/duo/callback`;

/** Strictly validates a Duo API hostname (SSRF protection). */
export function normalizeDuoHost(raw: string): string {
  const host = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
  if (host.length > 80 || !DUO_HOST_RE.test(host)) {
    throw new Error("Enter a valid Duo API hostname matching api-xxxxxxxx.duosecurity.com.");
  }
  return host;
}

export function isValidDuoHost(host: string): boolean {
  return typeof host === "string" && host.length <= 80 && DUO_HOST_RE.test(host);
}

export function parseDuoStoredConfig(raw: unknown): DuoStoredConfig | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const apiHost = typeof o.apiHost === "string" ? o.apiHost.trim().toLowerCase() : "";
  const clientId = typeof o.clientId === "string" ? o.clientId.trim() : "";
  const clientSecretEnc = typeof o.clientSecretEnc === "string" ? o.clientSecretEnc : "";
  if (!apiHost || !isValidDuoHost(apiHost) || !clientId || !clientSecretEnc) return null;
  return {
    enabled: o.enabled === true,
    apiHost,
    clientId,
    clientSecretEnc,
    ...(typeof o.updatedAt === "string" ? { updatedAt: o.updatedAt } : {}),
  };
}

/** Public-safe view of a workspace's Duo configuration (never includes clientSecretEnc). */
export function getDuoPublicConfig(ws: { duoConfig: unknown } | null | undefined): DuoPublicConfig {
  const stored = parseDuoStoredConfig(ws?.duoConfig);
  if (!stored) {
    return { enabled: false, apiHost: "", clientId: "", configured: false, updatedAt: null };
  }
  return {
    enabled: stored.enabled,
    apiHost: stored.apiHost,
    clientId: stored.clientId,
    configured: true,
    updatedAt: stored.updatedAt ?? null,
  };
}

/** True when the workspace has a valid, enabled Duo Universal Prompt configuration. */
export function isDuoEnabled(ws: { duoConfig: unknown } | null | undefined): boolean {
  const stored = parseDuoStoredConfig(ws?.duoConfig);
  return !!stored?.enabled;
}

/** Decrypts and validates runtime Duo credentials for server-side OIDC calls. */
export function getDuoRuntimeConfig(
  ws: { duoConfig: unknown } | null | undefined,
): { enabled: boolean; apiHost: string; clientId: string; clientSecret: string } | null {
  const stored = parseDuoStoredConfig(ws?.duoConfig);
  if (!stored) return null;
  const secret = open(stored.clientSecretEnc);
  if (!secret) return null;
  return {
    enabled: stored.enabled,
    apiHost: stored.apiHost,
    clientId: stored.clientId,
    clientSecret: secret,
  };
}

function resolveCallConfig(cfg: DuoCallConfig): { apiHost: string; clientId: string; clientSecret: string } {
  const apiHost = normalizeDuoHost(cfg.apiHost);
  const clientId = cfg.clientId.trim();
  if (!clientId) throw new Error("Duo Client ID is required.");
  const clientSecret =
    "clientSecret" in cfg ? cfg.clientSecret : open(cfg.clientSecretEnc) ?? "";
  if (!clientSecret) throw new Error("Duo Client Secret could not be decrypted.");
  return { apiHost, clientId, clientSecret };
}

async function signClientAssertion(clientId: string, clientSecret: string, aud: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const key = new TextEncoder().encode(clientSecret);
  return new SignJWT({
    iss: clientId,
    sub: clientId,
    aud,
    jti: randomBytes(18).toString("hex"),
  })
    .setProtectedHeader({ alg: "HS512", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + JWT_EXP_SECONDS)
    .sign(key);
}

/** Calls Duo Universal Prompt /oauth/v1/health_check with HS512 JWT client_assertion. */
export async function duoHealthCheck(
  cfg: DuoCallConfig,
): Promise<{ ok: true; timestamp?: number } | { ok: false; error: string }> {
  try {
    const { apiHost, clientId, clientSecret } = resolveCallConfig(cfg);
    const endpoint = `https://${apiHost}/oauth/v1/health_check`;
    const assertion = await signClientAssertion(clientId, clientSecret, endpoint);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_assertion: assertion,
      }),
      signal: AbortSignal.timeout(8000),
    });

    const data = (await res.json().catch(() => ({}))) as {
      stat?: string;
      response?: { timestamp?: number };
      message?: string;
      message_detail?: string;
    };

    if (!res.ok || data.stat !== "OK") {
      const msg = [data.message, data.message_detail].filter(Boolean).join(": ");
      return { ok: false, error: msg || `Duo health check failed (HTTP ${res.status}).` };
    }
    return { ok: true, timestamp: data.response?.timestamp };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not reach Duo Security." };
  }
}

/** Builds the Duo Universal Prompt /oauth/v1/authorize redirect URL with HS512-signed request JWT. */
export async function duoAuthorizeUrl(
  cfg: DuoCallConfig,
  username: string,
  state: string,
  redirectUri: string = duoRedirectUri(),
): Promise<string> {
  const { apiHost, clientId, clientSecret } = resolveCallConfig(cfg);
  const now = Math.floor(Date.now() / 1000);
  const key = new TextEncoder().encode(clientSecret);

  const requestJwt = await new SignJWT({
    response_type: "code",
    scope: "openid",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    duo_uname: username,
    use_duo_code_attribute: true,
    iss: clientId,
    aud: `https://${apiHost}`,
  })
    .setProtectedHeader({ alg: "HS512", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + JWT_EXP_SECONDS)
    .sign(key);

  const u = new URL(`https://${apiHost}/oauth/v1/authorize`);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("request", requestJwt);
  return u.toString();
}

/** Exchanges a Duo authorization code at /oauth/v1/token and verifies the HS512 id_token, sub, and auth_result.result === "allow". */
export async function duoExchangeCode(
  cfg: DuoCallConfig,
  code: string,
  username: string,
  redirectUri: string = duoRedirectUri(),
): Promise<{ ok: true; sub: string; authTime?: number; factor?: string } | { ok: false; error: string }> {
  try {
    const { apiHost, clientId, clientSecret } = resolveCallConfig(cfg);
    const endpoint = `https://${apiHost}/oauth/v1/token`;
    const assertion = await signClientAssertion(clientId, clientSecret, endpoint);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        client_assertion: assertion,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const data = (await res.json().catch(() => ({}))) as {
      id_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!res.ok || !data.id_token) {
      return {
        ok: false,
        error: data.error_description || data.error || `Duo token exchange failed (HTTP ${res.status}).`,
      };
    }

    const key = new TextEncoder().encode(clientSecret);
    const { payload } = await jwtVerify(data.id_token, key, {
      algorithms: ["HS512"],
      audience: clientId,
      issuer: endpoint,
      clockTolerance: 60,
    });

    const sub = typeof payload.sub === "string" ? payload.sub.trim() : "";
    if (!sub || sub.toLowerCase() !== username.trim().toLowerCase()) {
      return { ok: false, error: "Duo identity subject did not match the signing-in user." };
    }

    const authResult = payload.auth_result as { result?: string; status?: string; status_msg?: string } | undefined;
    if (authResult?.result !== "allow") {
      return { ok: false, error: authResult?.status_msg || "Duo authentication was not allowed." };
    }

    const authContext = payload.auth_context as { factor?: string } | undefined;
    return {
      ok: true,
      sub,
      authTime: typeof payload.auth_time === "number" ? payload.auth_time : undefined,
      factor: typeof authContext?.factor === "string" ? authContext.factor : undefined,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Duo verification failed." };
  }
}

/* ---------------- Signed Duo state cookie ---------------- */

export type DuoFlow = {
  u: string;
  ws: string;
  state: string;
  username: string;
};

const duoStateKey = () =>
  new TextEncoder().encode(
    createHash("sha256")
      .update(`duo-state:${process.env.SESSION_SECRET || "dev-only-secret-change-me-please-32chars"}`)
      .digest("hex"),
  );

export const newDuoFlow = (u: string, ws: string, username: string): DuoFlow => ({
  u,
  ws,
  state: randomBytes(24).toString("base64url"),
  username,
});

export const signDuoFlow = (f: DuoFlow) =>
  new SignJWT({ purpose: "duo", ...f })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DUO_TTL_SECONDS}s`)
    .sign(duoStateKey());

export async function verifyDuoFlow(token: string | undefined | null): Promise<DuoFlow | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, duoStateKey());
    if (
      payload.purpose !== "duo" ||
      typeof payload.u !== "string" ||
      typeof payload.ws !== "string" ||
      typeof payload.state !== "string" ||
      typeof payload.username !== "string"
    ) {
      return null;
    }
    return {
      u: payload.u,
      ws: payload.ws,
      state: payload.state,
      username: payload.username,
    };
  } catch {
    return null;
  }
}

export const duoStateMatches = (a: string | null | undefined, b: string) =>
  !!a && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
