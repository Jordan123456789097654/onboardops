/** Edge-safe helpers (used by middleware). */
export function cleanHost(h: string | null | undefined) {
  return (h ?? "").split(",")[0].toLowerCase().split(":")[0].trim();
}

const base = () => {
  try { return new URL(process.env.APP_URL || "http://localhost:3000").hostname.toLowerCase(); } catch { return "localhost"; }
};

/** True for the main OnboardOps site: production domain, www, localhost, vercel preview URLs and anything in MAIN_HOSTS. */
export function isMainHost(host: string) {
  if (!host) return true;
  const extra = (process.env.MAIN_HOSTS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const b = base();
  if ([b, `www.${b}`, "onboardops.org", "www.onboardops.org", "localhost", "127.0.0.1", "::1", ...extra].includes(host)) return true;
  if (host.endsWith(".vercel.app")) return true;
  return false; // includes custom domains and *.localhost (used to test custom domains locally)
}

export const MARKETING_PREFIXES = ["/why", "/features", "/solutions", "/security", "/pricing", "/changelog", "/support", "/faq", "/about", "/contact", "/legal", "/register", "/staff", "/w/", "/workplaces"];
