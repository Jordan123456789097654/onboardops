/** Calls the OnboardOps staff-bot API. The shared key proves the call is from the bot; the Discord user id says who is acting. */

const SITE = (process.env.SITE_URL?.trim() || "https://www.onboardops.org").replace(/\/$/, "");

export type ApiResult<T> = { status: number; data: T | null };

export async function api<T>(path: string, discordId: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<ApiResult<T>> {
  const key = process.env.STAFF_BOT_KEY?.trim();
  if (!key) return { status: 503, data: null };
  try {
    const res = await fetch(`${SITE}/api/staff-bot/${path}`, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${key}`, ...(discordId ? { "X-Discord-User": discordId } : {}), ...(init.body ? { "Content-Type": "application/json" } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => null)) as T | null;
    return { status: res.status, data };
  } catch {
    return { status: 0, data: null };
  }
}

export const siteUrl = (path: string) => `${SITE}${path}`;

/** A plain explanation for the common failures, so commands don't each repeat them. */
export function apiProblem(status: number): string | null {
  if (status === 0) return "I couldn't reach the website. Try again in a moment.";
  if (status === 503) return "The bot's connection to the website isn't set up yet. An admin needs to add STAFF_BOT_KEY on both sides.";
  if (status === 401) return "The website didn't accept the bot's key. An admin needs to check STAFF_BOT_KEY.";
  if (status === 403) return "Link your staff account first with `/link`.";
  if (status === 429) return "The website is rate limiting the bot. Try again in a minute.";
  if (status >= 400) return "The website returned an error. Try again later.";
  return null;
}

/** The most useful message for a failed call: the website own explanation if it gave one. */
export function failure(r: ApiResult<unknown>): string {
  const e = r.data && typeof (r.data as { error?: unknown }).error === "string" ? (r.data as { error: string }).error : null;
  return e ?? apiProblem(r.status) ?? "Something went wrong.";
}
