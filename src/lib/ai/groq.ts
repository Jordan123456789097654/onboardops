/**
 * Groq client (OpenAI-compatible API). Plain fetch, no SDK.
 * Keys come only from the environment (GROQ_API_KEYS, comma separated). They are tried in turn; a key that is rate limited or refused is skipped for a while.
 * Prompts, replies and keys are never logged. Only the key's position and the HTTP status are.
 */

export type Tier = "smart" | "fast" | "vision" | "audio";

export const MODELS: Record<Tier, () => string> = {
  smart: () => process.env.GROQ_MODEL_SMART || "openai/gpt-oss-120b",
  fast: () => process.env.GROQ_MODEL_FAST || "openai/gpt-oss-20b",
  vision: () => process.env.GROQ_MODEL_VISION || "qwen/qwen3.8-27b",
  audio: () => process.env.GROQ_MODEL_AUDIO || "whisper-large-v3-turbo",
};

export type AiErrorCode = "unavailable" | "rate" | "bad_output" | "too_large" | "timeout" | "not_configured";
export class AiError extends Error {
  constructor(public code: AiErrorCode, message?: string) { super(message ?? FRIENDLY[code]); this.name = "AiError"; }
}
const FRIENDLY: Record<AiErrorCode, string> = {
  unavailable: "The AI service is not responding right now. Try again in a minute.",
  rate: "The AI service is busy. Wait a moment and try again.",
  bad_output: "The AI gave an answer we could not use. Try again, or change your text a little.",
  too_large: "That is too much text for the AI at once. Shorten it and try again.",
  timeout: "The AI took too long. Try again with a shorter text.",
  not_configured: "AI is not set up on this server.",
};

const base = () => (process.env.NODE_ENV !== "production" && process.env.GROQ_BASE_URL) || "https://api.groq.com/openai/v1";
const keys = (): string[] => (process.env.GROQ_API_KEYS ?? process.env.GROQ_API_KEY ?? "").split(",").map((s) => s.trim()).filter(Boolean);
export const aiConfigured = () => keys().length > 0 && process.env.AI_DISABLED !== "1";

// A key that was refused or rate limited is skipped until this time. Per server instance, which is fine: a new instance just tries again.
const parkedUntil = new Map<number, number>();
let cursor = 0;
/** Test helper. */
export const _resetKeyState = () => { parkedUntil.clear(); cursor = 0; };

type Init = { path: string; body?: BodyInit; headers?: Record<string, string>; timeoutMs?: number };

async function call({ path, body, headers = {}, timeoutMs = 30_000 }: Init): Promise<Response> {
  const ks = keys();
  if (!ks.length || process.env.AI_DISABLED === "1") throw new AiError("not_configured");
  let sawRate = false;
  // Try every key at most once per call, starting after the one used last.
  for (let n = 0; n < ks.length; n++) {
    const i = (cursor + n) % ks.length;
    if ((parkedUntil.get(i) ?? 0) > Date.now()) continue;
    try {
      const res = await fetch(`${base()}${path}`, { method: "POST", body, signal: AbortSignal.timeout(timeoutMs), headers: { authorization: `Bearer ${ks[i]}`, "user-agent": "OnboardOps/1.0", ...headers } });
      if (res.status === 429) { sawRate = true; parkedUntil.set(i, Date.now() + Math.min(60, Number(res.headers.get("retry-after")) || 20) * 1000); console.error(`ai: key #${i} rate limited`); continue; }
      if (res.status === 401 || res.status === 403) { parkedUntil.set(i, Date.now() + 10 * 60_000); console.error(`ai: key #${i} refused (${res.status})`); continue; }
      if (res.status >= 500) { console.error(`ai: key #${i} server error ${res.status}`); continue; }
      cursor = (i + 1) % ks.length;
      return res;
    } catch (e) {
      if ((e as Error)?.name === "TimeoutError") throw new AiError("timeout");
      console.error(`ai: key #${i} network error`);
    }
  }
  throw new AiError(sawRate ? "rate" : "unavailable");
}

export type Usage = { input: number; output: number };
type ChatOpts = { tier?: Tier; system: string; user: string; json?: boolean; maxTokens?: number; temperature?: number; effort?: "low" | "medium" | "high"; image?: string };

/** One chat completion. With json (the default) the reply must be a JSON object; the caller still validates its shape. */
export async function chat(o: ChatOpts): Promise<{ text: string; usage: Usage }> {
  const tier: Tier = o.image ? "vision" : o.tier ?? "fast";
  const userContent = o.image ? [{ type: "text", text: o.user }, { type: "image_url", image_url: { url: o.image } }] : o.user;
  const body: Record<string, unknown> = { model: MODELS[tier](), messages: [{ role: "system", content: o.system }, { role: "user", content: userContent }], max_tokens: o.maxTokens ?? 4000, temperature: o.temperature ?? 0.3 };
  if (o.json !== false) body.response_format = { type: "json_object" };
  // gpt-oss models spend part of the token budget on reasoning; keep it modest so answers are quick.
  if (tier === "smart" || tier === "fast") body.reasoning_effort = o.effort ?? "low";
  const res = await call({ path: "/chat/completions", body: JSON.stringify(body), headers: { "content-type": "application/json" }, timeoutMs: tier === "smart" || tier === "vision" ? 55_000 : 30_000 });
  if (res.status === 413 || res.status === 400) {
    const t = await res.text().catch(() => "");
    throw new AiError(/too large|context|token/i.test(t) ? "too_large" : "bad_output");
  }
  if (!res.ok) throw new AiError("unavailable");
  const j = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } } | null;
  const text = j?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new AiError("bad_output");
  return { text, usage: { input: j?.usage?.prompt_tokens ?? 0, output: j?.usage?.completion_tokens ?? 0 } };
}

/** Speech to text (Whisper). */
export async function transcribe(file: Blob, filename: string, language?: string): Promise<string> {
  if (file.size > 20 * 1024 * 1024) throw new AiError("too_large");
  const fd = new FormData();
  fd.set("file", file, filename);
  fd.set("model", MODELS.audio());
  fd.set("response_format", "json");
  if (language) fd.set("language", language);
  const res = await call({ path: "/audio/transcriptions", body: fd, timeoutMs: 60_000 });
  if (!res.ok) throw new AiError("unavailable");
  const j = (await res.json().catch(() => null)) as { text?: string } | null;
  if (typeof j?.text !== "string") throw new AiError("bad_output");
  return j.text.trim();
}
