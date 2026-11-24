export type VisitMeta = { ref?: string; utmSource?: string; utmMedium?: string; utmCampaign?: string; width?: number; country?: string };

const SEARCH: Record<string, string> = { google: "Google", bing: "Bing", duckduckgo: "DuckDuckGo", yahoo: "Yahoo", brave: "Brave", ecosia: "Ecosia", baidu: "Baidu", yandex: "Yandex" };
const SOCIAL: Record<string, string> = {
  facebook: "Facebook", fb: "Facebook", instagram: "Instagram", linkedin: "LinkedIn", lnkd: "LinkedIn", twitter: "X", x: "X", t: "X", reddit: "Reddit",
  youtube: "YouTube", youtu: "YouTube", tiktok: "TikTok", pinterest: "Pinterest", nextdoor: "Nextdoor", whatsapp: "WhatsApp", discord: "Discord",
};

const clean = (s: string | undefined, max = 40) => (s ?? "").trim().toLowerCase().replace(/[^a-z0-9._ -]+/g, "").slice(0, max);

const titleCase = (s: string) => s.replace(/(^|[ _-])([a-z])/g, (_, a: string, b: string) => `${a === "_" || a === "-" ? " " : a}${b.toUpperCase()}`);

function labelFor(key: string): string {
  const k = key.replace(/^www\./, "").split(".")[0];
  return SEARCH[k] ?? SOCIAL[k] ?? "";
}

/** Where a visitor came from, in a few readable buckets. A campaign tag (utm_source) wins over the referring site. */
export function classifySource(meta: VisitMeta, ownHosts: string[]): string {
  const utm = clean(meta.utmSource);
  if (utm) return labelFor(utm) || titleCase(utm);
  let host = "";
  try { host = meta.ref ? new URL(meta.ref).hostname.toLowerCase() : ""; } catch { host = ""; }
  if (!host) return "Direct";
  const bare = host.replace(/^www\./, "");
  if (ownHosts.some((h) => bare === h.replace(/^www\./, "") || bare.endsWith(`.${h.replace(/^www\./, "")}`))) return "Direct";
  const known = labelFor(bare) || labelFor(bare.split(".").slice(-2)[0]);
  return known || bare.slice(0, 40);
}

export function deviceOf(ua: string, width?: number): "Mobile" | "Tablet" | "Desktop" {
  if (/ipad|tablet|kindle|silk/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) return "Tablet";
  if (/mobi|iphone|ipod|android/i.test(ua)) return "Mobile";
  if (width && width < 700) return "Mobile";
  return "Desktop";
}

export const countryOf = (code: string | null | undefined) => (/^[A-Za-z]{2}$/.test(code ?? "") ? code!.toUpperCase() : "Unknown");

export const campaignOf = (meta: VisitMeta) => clean(meta.utmCampaign, 50);

/** The steps of a visit that matter for sign-ups. Each is counted once per visitor per day. */
export const FUNNEL_PAGES: Record<string, string> = { "/": "home", "/pricing": "pricing", "/features": "features", "/tutorial": "tutorial", "/register": "register" };
