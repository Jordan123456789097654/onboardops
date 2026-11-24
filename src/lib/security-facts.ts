/** One source for the Security page and the downloadable summary. Only list what is actually in the code. */
export const securityGroups: { title: string; items: [string, string][] }[] = [
  {
    title: "Access and sign-in",
    items: [
      ["Passwords", "Stored as bcrypt hashes. We never store or email a plain-text password."],
      ["Sessions", "Signed, HTTP-only cookies that expire after 14 days. Account settings list your signed-in devices so you can end any of them, and we email you when a new device signs in."],
      ["Single sign-on", "Owners can set up Google Workspace or Microsoft Entra ID, test it, then turn it on. Only people who already have an account and a membership in the workspace can sign in; a company domain alone never grants access. Client secrets are stored encrypted and never shown again. Owners can always use a password, so a failing identity provider cannot lock everyone out."],
      ["Two-factor authentication", "Optional for everyone, and an owner can require it for the whole workspace. It uses an authenticator app (TOTP) and works after a password, an email link, a reset link, or Google or GitHub sign-in. Secrets are stored encrypted, backup codes are shown once and stored only as keyed hashes, a code cannot be used twice, and five wrong codes lock it for 15 minutes."],
      ["Sign in with Google or GitHub", "Optional, and only offered when the operator has configured it. We check the provider's signed response, a one-time state value and a PKCE challenge, and use the provider's verified email. A provider is linked to an existing account only when that account's email is also verified, so nobody can take over an account by registering its address first."],
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
      ["Encryption of sensitive records", "Confidential manager notes, case and incident text, injury details, coaching and review notes, appeal text, leave reasons, phone numbers, emergency contacts, custom field values and every uploaded file are encrypted with AES-256-GCM in our application before they are stored. Each workspace has its own random key, which is kept only in locked form and is locked by a master key held outside the database. Deleting a workspace deletes its key. Names, email addresses, staff IDs, dates and titles are not encrypted, so search and sign-in keep working, and encryption does not protect against someone who controls the running application."],
      ["Integration credentials", "SMS and BambooHR credentials that you connect are encrypted with AES-256-GCM before storage and are never shown again."],
      ["API keys", "Separate read and write scopes, optional expiry, stored only as hashes, shown once when created, and revocable at any time. A write is limited by the role of the person who made the key, suspensions and terminations cannot be logged through the API, and every write is recorded in the audit log under the key's name."],
      ["Customer-supplied encryption key", "An owner can protect the workspace key with a key they supply, rotate it, or revoke it to lock the encrypted records until the key is provided again. While active we keep an encrypted copy so the app can work; revoking deletes it. Earlier backups from the database provider expire on its normal cycle."],
      ["AI features", "On by default, and owners can turn them off. Most are limited per person and per workspace; the website chat is not. They send only what a user submits, the chat questions a visitor types, and a signed-in user's own account facts for account questions. Drafts are reviewed by a person, no AI feature makes a decision about an employee, and none changes a record by itself. Use is counted and audit-logged without the text. Provider keys live only in the server environment."],
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

export const notYet = ["SOC 2 or ISO 27001 certification", "An independent third-party penetration test"];
