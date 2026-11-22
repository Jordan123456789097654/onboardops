/** One source for the Security page and the downloadable summary. Only list what is actually in the code. */
export const securityGroups: { title: string; items: [string, string][] }[] = [
  {
    title: "Access and sign-in",
    items: [
      ["Passwords", "Stored as bcrypt hashes. We never store or email a plain-text password."],
      ["Sessions", "Signed, HTTP-only cookies that expire after 14 days. Account settings list your signed-in devices so you can end any of them, and we email you when a new device signs in."],
      ["Lockout and rate limits", "Accounts lock after repeated wrong passwords. Sign-in, password reset, magic links, contact forms and search are rate limited per address."],
      ["Role checks on the server", "Every action and page checks your role before it reads or writes data. Hiding a button is not the control."],
      ["Confidential notes", "Removed on the server for employees and supervisors before the page is built."],
      ["Workspace isolation", "Every record carries a workspace ID and every query filters on it."],
      ["Support access", "Our staff can only view a workspace through time-limited, read-only access that the owner is emailed about and can see in their audit log."],
    ],
  },
  {
    title: "Records and audit",
    items: [
      ["Append-only history", "No action exists to edit or delete cases, timeline notes or audit entries."],
      ["Tamper-evident audit log", "Each entry's hash chains over the one before it and is signed with a secret key held outside the database. Someone who can edit the database but does not have the key cannot rewrite history without detection."],
      ["Verify and export", "Owners and admins can re-check the whole chain from the Audit page and export the log as CSV."],
    ],
  },
  {
    title: "Data and integrations",
    items: [
      ["Integration credentials", "SMS and BambooHR credentials that you connect are encrypted with AES-256-GCM before storage and are never shown again."],
      ["API keys", "Read-only, stored only as hashes, shown once when created, and revocable at any time."],
      ["Webhooks", "JSON webhooks are signed with HMAC-SHA256. Endpoints must be public https addresses, and internal addresses are refused."],
      ["Notifications", "Webhook and email messages leave out confidential notes."],
      ["Hosting", "Served over HTTPS from managed infrastructure. The database is a managed PostgreSQL service; encryption at rest is provided by the hosting provider."],
    ],
  },
  {
    title: "Browser protections",
    items: [
      ["Security headers", "A Content-Security-Policy, frame blocking, no content-type sniffing, a strict referrer policy and HSTS."],
    ],
  },
];

export const notYet = ["SOC 2 or ISO 27001 certification", "Single sign-on (SSO) and two-factor authentication", "Customer-managed encryption keys", "An independent third-party penetration test"];
