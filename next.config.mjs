const isDev = process.env.NODE_ENV !== "production";
const isApiRole = (process.env.SERVICE_ROLE || "").trim().toLowerCase() === "api";

// A value that is the same for every process of one deployment, so open tabs can tell when a new one is live.
const BUILD_ID = process.env.BUILD_ID_OVERRIDE || process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || "local";

const apiOrigins = ["https://api.onboardops.org"];
try {
  const configured = (process.env.NEXT_PUBLIC_API_URL || "").trim();
  if (configured) {
    const o = new URL(configured).origin;
    if (!apiOrigins.includes(o)) apiOrigins.push(o);
  }
} catch {}
const apiOriginList = apiOrigins.join(" ");

// Next.js needs inline scripts and styles for hydration, so a nonce-less CSP must allow 'unsafe-inline'.
// Everything else is locked to this site (and the dedicated API host): no framing, no plugins, no foreign form posts or base tags.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' ${apiOriginList} data: blob:`,
  "font-src 'self' data:",
  "frame-src https://www.youtube-nocookie.com",
  `connect-src 'self' ${apiOriginList}${isDev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // The status page now lives on Better Stack. Old links to /status on web go there (never on the API host, where /status is the JSON probe).
  async redirects() {
    if (isApiRole) return [];
    return [
      {
        source: "/status",
        missing: [{ type: "host", value: "api.onboardops.org" }],
        destination: "https://status.onboardops.org",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
export default nextConfig;
