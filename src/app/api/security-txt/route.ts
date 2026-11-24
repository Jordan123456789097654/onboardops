import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Served at /.well-known/security.txt and /security.txt (see next.config.mjs). Tells researchers how to report a problem privately. */
export function GET() {
  const base = SITE.url.startsWith("http://localhost") ? "https://www.onboardops.org" : SITE.url.replace(/\/$/, "");
  const expires = new Date(Date.now() + 180 * 86400000).toISOString();
  const lines = [
    ...(SITE.contactEmail ? [`Contact: mailto:${SITE.contactEmail}`] : []),
    `Contact: ${base}/support`,
    `Expires: ${expires}`,
    "Preferred-Languages: en",
    `Canonical: ${base}/.well-known/security.txt`,
    `Policy: ${base}/security`,
    "",
    "# Please report vulnerabilities privately and give us time to fix them before sharing details.",
    "# Do not access other people's data, disrupt the service, or test with real customer accounts.",
    "# We will acknowledge your report and keep you updated.",
  ];
  return new Response(lines.join("\n") + "\n", { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
