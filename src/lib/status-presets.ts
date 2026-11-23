/**
 * Detailed, customer-ready status page and maintenance templates.
 * Staff can click any preset to pre-fill a comprehensive multi-paragraph message and customize before publishing.
 */

export type IncidentPreset = {
  label: string;
  category: "Major" | "Platform" | "Integrations";
  title: string;
  status: "downtime" | "degraded";
  /** Resource public names to auto-tick on Better Stack. */
  resources: string[];
  message: string;
};

export type UpdatePreset = {
  label: string;
  status: "downtime" | "degraded" | "resolved";
  message: string;
};

export type MaintenancePreset = {
  label: string;
  title: string;
  eta: string;
  durationMinutes: number;
  message: string;
};

export const INCIDENT_PRESETS: IncidentPreset[] = [
  {
    label: "Major Platform Outage",
    category: "Major",
    title: "Major service disruption across core OnboardOps services",
    status: "downtime",
    resources: ["Website", "Sign-in", "Core API", "Database", "Overall status"],
    message: [
      "We are currently investigating a major service disruption affecting core OnboardOps infrastructure. Automated monitoring detected elevated failures across sign-in, workspace dashboards, and core API services.",
      "Current impact: Users may be unable to sign in, load employee records, submit shift checklists, complete training quizzes, or access admin tools. Existing workspace data, audit logs, and uploaded documents remain completely intact.",
      "Our engineering team is actively analyzing live telemetry, database connectivity, and upstream infrastructure to isolate the root cause and restore service as quickly as possible. We will post our next update within 15–20 minutes or as soon as we have confirmed findings.",
    ].join("\n\n"),
  },
  {
    label: "Database Connectivity Disruption",
    category: "Major",
    title: "Database connectivity disruption affecting workspace access",
    status: "downtime",
    resources: ["Database", "Sign-in", "Core API", "File storage", "Overall status"],
    message: [
      "We are investigating a database connectivity issue that is preventing OnboardOps from reading and saving workspace records reliably.",
      "Current impact: Signing in, viewing employee dossiers, logging infractions, submitting training quizzes, and downloading stored files are temporarily unavailable or failing with errors. No data loss has occurred—all committed records remain safely stored.",
      "Our team is working directly with our database provider to diagnose connection pool saturation and restore healthy query latency. We will share another update as soon as connectivity stabilizes.",
    ].join("\n\n"),
  },
  {
    label: "Sign-In, 2FA & SSO Issues",
    category: "Major",
    title: "Elevated errors affecting sign-in, two-factor verification, and SSO",
    status: "downtime",
    resources: ["Sign-in", "Overall status"],
    message: [
      "We are investigating an issue causing sign-in requests, magic sign-in links, two-factor verification codes, and single sign-on (Google, GitHub, and workspace SSO) redirects to fail or time out.",
      "Current impact: Users attempting to start a new session may see an error or be redirected back to the login screen. Users who already have an active browser session may continue to experience limited interruption depending on their workspace.",
      "Our engineering team is reviewing authentication service logs and identity provider callbacks to pinpoint the root cause. We will provide a progress update shortly.",
    ].join("\n\n"),
  },
  {
    label: "Core & Public API Outage",
    category: "Platform",
    title: "Service disruption affecting Core API and Public API (api.onboardops.org)",
    status: "downtime",
    resources: ["Core API", "Public API", "Overall status"],
    message: [
      "We are currently investigating an outage affecting our API endpoints at api.onboardops.org as well as internal workspace API operations.",
      "Current impact: Automated integrations using Public API v1 keys (employee sync, shifts, assignments, infractions, and audit reads), calendar subscription feeds, and some in-app actions may fail with HTTP 5xx or 404 errors. Marketing pages remain accessible.",
      "Our team is inspecting deployment routing, edge logs, and backend health checks to restore full API availability. Please pause non-idempotent write retries until we confirm recovery.",
    ].join("\n\n"),
  },
  {
    label: "Elevated Latency & Slowness",
    category: "Platform",
    title: "Degraded performance and slower page loads across OnboardOps",
    status: "degraded",
    resources: ["Website", "Core API", "Database", "Overall status"],
    message: [
      "We are investigating reports of noticeably slower response times across OnboardOps web pages, workspace dashboards, and API endpoints.",
      "Current impact: Pages, reports, and form submissions may take longer than usual to load, and occasional requests may time out and need to be retried. Core functionality remains available and your workspace data is unaffected.",
      "Our engineering team is profiling slow queries, serverless cold starts, and upstream hosting performance to return response times to normal levels. We will post another update as soon as latency improves.",
    ].join("\n\n"),
  },
  {
    label: "Email Delivery Delays",
    category: "Integrations",
    title: "Outbound email delivery delays and intermittent send failures",
    status: "degraded",
    resources: ["Email", "Overall status"],
    message: [
      "We are investigating an issue with outbound email delivery from notifications@onboardops.org.",
      "Current impact: Staff invite emails, magic sign-in links, password resets, infraction acknowledgments, and training notifications may be delayed or fail to deliver. All core workspace features inside the web app continue to operate normally.",
      "Our team is inspecting our mail transport logs and working with our email delivery provider (Resend) to clear queued messages and restore immediate delivery. Affected emails can be safely resent once resolved.",
    ].join("\n\n"),
  },
  {
    label: "File Storage & Uploads Degraded",
    category: "Platform",
    title: "Degraded performance on document uploads and file downloads",
    status: "degraded",
    resources: ["File storage", "Overall status"],
    message: [
      "We are investigating elevated error rates and slow transfers affecting encrypted document storage, policy PDFs, checklist photo evidence, and case attachments.",
      "Current impact: Uploading new employee documents or downloading existing stored files may fail intermittently or time out. Existing uploaded files remain encrypted and intact, and all other workspace workflows remain operational.",
      "Our team is checking storage database throughput and encryption workers to stabilize file operations and will update this report as soon as we know more.",
    ].join("\n\n"),
  },
  {
    label: "Custom Domains & Subdomain Routing",
    category: "Integrations",
    title: "Routing and SSL issues affecting custom domains and workspace subdomains",
    status: "degraded",
    resources: ["Domains", "Overall status"],
    message: [
      "We are investigating a DNS and edge-routing disruption affecting workspace subdomains (*.onboardops.org) and verified customer custom domains.",
      "Current impact: Staff visiting a custom workspace URL may encounter SSL handshake errors or page-not-found responses. Workaround: teams can still sign in through the main site at https://www.onboardops.org/login or their /w/<slug> workplace link while we resolve routing.",
      "Our engineering team is reviewing DNS records and edge domain provisioning with our hosting and DNS providers and will post an update shortly.",
    ].join("\n\n"),
  },
  {
    label: "Upstream Cloud Provider Degradation",
    category: "Major",
    title: "Intermittent errors caused by an upstream hosting provider disruption",
    status: "degraded",
    resources: ["Website", "Sign-in", "Core API", "Public API", "Overall status"],
    message: [
      "We are tracking an ongoing service degradation at our upstream cloud hosting and edge network provider that is affecting connectivity to OnboardOps.",
      "Current impact: Visitors and workspace users in affected regions may experience intermittent connection resets, elevated latency, or failed requests. Your workspace data and audit records remain completely safe.",
      "We are actively monitoring our provider's incident updates and evaluating mitigation options on our side. We will continue posting updates here as service stabilizes.",
    ].join("\n\n"),
  },
  {
    label: "Webhook & Integration Sync Delays",
    category: "Integrations",
    title: "Delayed outbound webhooks and third-party integration syncs",
    status: "degraded",
    resources: ["Core API", "Public API"],
    message: [
      "We are investigating delays in outbound Discord, Slack, Microsoft Teams, and JSON webhook deliveries as well as third-party HRIS sync actions.",
      "Current impact: Events logged inside OnboardOps (certifications, infractions, checklist verifications, and requests) are still being saved normally in your workspace and audit log, but real-time external webhook notifications may arrive late or require a retry.",
      "Our team is checking outbound delivery queues and will update this incident once real-time delivery has caught up.",
    ].join("\n\n"),
  },
];

export const UPDATE_PRESETS: UpdatePreset[] = [
  {
    label: "Investigating (Detailed Triage)",
    status: "downtime",
    message: [
      "Update — Still Investigating: Our engineering team is actively reviewing live service logs, database connection telemetry, and edge routing diagnostics to isolate the root cause of this disruption.",
      "Impact remains ongoing for the affected services listed above. We have confirmed that workspace data, encrypted employee records, and audit trails are intact and have not been compromised.",
      "We are treating this as our highest priority and will publish our next update within 15–20 minutes with further technical findings or an estimated recovery timeline.",
    ].join("\n\n"),
  },
  {
    label: "Extended Investigation Update",
    status: "downtime",
    message: [
      "Update — Investigation Continuing: We have narrowed the disruption down to a subset of backend requests and are continuing deep diagnostics across our application runtime and database layer.",
      "While we isolate the exact trigger, users may continue to see errors or timeouts on affected workflows. No manual action is needed on your part, and your workspace data remains safely stored.",
      "Thank you for your continued patience—we will share another update as soon as we confirm the root cause and begin rolling out a fix.",
    ].join("\n\n"),
  },
  {
    label: "Root Cause Identified — Fix in Progress",
    status: "downtime",
    message: [
      "Update — Root Cause Identified: Our engineering team has identified the underlying cause of the disruption and is actively preparing and testing a fix.",
      "Affected services remain unavailable while we validate the patch to make sure recovery is clean and does not introduce secondary issues. All customer data remains safe.",
      "We expect to begin rolling out the fix shortly and will update this report as soon as deployment begins.",
    ].join("\n\n"),
  },
  {
    label: "Upstream Provider Issue Confirmed",
    status: "degraded",
    message: [
      "Update — Upstream Dependency Confirmed: We have confirmed that the degraded performance and intermittent errors are originating from an ongoing incident at an upstream infrastructure provider.",
      "Our provider has acknowledged the issue and is actively implementing remediation across affected regions. OnboardOps services remain online where routing is healthy, though some requests may still need a retry.",
      "We are watching their recovery closely and will verify all OnboardOps health checks as soon as their fix completes.",
    ].join("\n\n"),
  },
  {
    label: "Partial Mitigation Applied",
    status: "degraded",
    message: [
      "Update — Partial Mitigation Live: We have applied an initial mitigation that is restoring access for most users and reducing error rates across affected services.",
      "Some requests may still experience elevated latency or occasional errors while traffic rebalances and queued background work clears. If a screen fails to load, refreshing the page should now succeed in most cases.",
      "Our team is continuing to work on the permanent fix and will post another update as recovery progresses.",
    ].join("\n\n"),
  },
  {
    label: "Fix Deploying Now",
    status: "degraded",
    message: [
      "Update — Fix Rolling Out: A verified fix is currently deploying across our production infrastructure.",
      "During the rollout over the next few minutes, you should begin seeing normal responses return across sign-in, workspace dashboards, and API endpoints. We will keep this incident open while we observe error rates and latency.",
      "We will post a confirmation update once all automated monitors report healthy across every region.",
    ].join("\n\n"),
  },
  {
    label: "Monitoring Recovery",
    status: "degraded",
    message: [
      "Update — Monitoring: The fix has been fully deployed and primary health checks, database latency, and error rates have returned to normal baselines.",
      "Users should now be able to sign in and use all OnboardOps features normally. We are keeping this incident in Monitoring for a short observation window to ensure stability holds under normal load.",
      "If you continue to see any unexpected errors, please hard-refresh your browser and contact us at https://www.onboardops.org/contact.",
    ].join("\n\n"),
  },
  {
    label: "Resolved — Full Post-Incident Summary",
    status: "resolved",
    message: [
      "This incident has been resolved.",
      "What happened: Affected OnboardOps services experienced an interruption that prevented normal requests from completing reliably. Our engineering team isolated the root cause, deployed a verified fix, and confirmed recovery across all monitoring regions.",
      "Data safety & verification: All automated health checks (database, authentication, core API, email, storage, and domains) are back to normal operational baselines. Your workspace records, audit logs, and files were not lost or altered during this event.",
      "Next steps: If you still see an error in an open tab, please refresh the page and try again. If anything continues to behave unexpectedly, reach out at https://www.onboardops.org/contact and our team will look into it immediately. We sincerely apologize for the disruption and appreciate your patience.",
    ].join("\n\n"),
  },
  {
    label: "Resolved — Upstream Provider Recovery",
    status: "resolved",
    message: [
      "This incident has been resolved.",
      "The elevated latency and intermittent service errors across OnboardOps were caused by a temporary disruption at our upstream infrastructure provider. Once the provider completed remediation, response times and request success rates returned to normal across all regions.",
      "We have verified that every OnboardOps service and external monitor is healthy and operational, and we are continuing to monitor telemetry closely. No workspace data was affected.",
      "If any page still appears stale, please refresh your browser. Thank you for your patience while this was resolved.",
    ].join("\n\n"),
  },
];

export const MAINTENANCE_PRESETS: MaintenancePreset[] = [
  {
    label: "Scheduled Platform Upgrade",
    title: "Scheduled platform upgrade",
    eta: "~30 minutes",
    durationMinutes: 30,
    message:
      "OnboardOps is currently undergoing a scheduled platform upgrade to improve speed, reliability, and workspace workflows. Access is temporarily paused while we deploy updates and run automated health checks. All employee records, training history, audit logs, and uploaded files are completely safe, and services will reopen automatically as soon as verification finishes.",
  },
  {
    label: "Database Maintenance & Indexing",
    title: "Scheduled database maintenance and optimization",
    eta: "~45 minutes",
    durationMinutes: 45,
    message:
      "We are performing scheduled PostgreSQL database maintenance, schema upgrades, and index optimization to keep OnboardOps fast and dependable as workspaces grow. Workspaces are temporarily locked during this window so no in-flight writes are interrupted. Every record, certificate, and audit trail entry remains intact and backed up.",
  },
  {
    label: "Security Patch & Hardening",
    title: "Routine security patches and infrastructure hardening",
    eta: "~20 minutes",
    durationMinutes: 20,
    message:
      "We are deploying routine security patches, dependency updates, and encryption/authentication hardening across OnboardOps infrastructure. We briefly pause workspace traffic during security rollouts to ensure every server switches over cleanly. Your data is safe and full access will resume shortly.",
  },
  {
    label: "Major Feature Release",
    title: "New OnboardOps release rollout",
    eta: "~15 minutes",
    durationMinutes: 15,
    message:
      "We are rolling out a new OnboardOps release packed with new workspace tools, performance enhancements, and workflow improvements. Please hang tight for a few minutes while we complete the deployment and verify all services—you'll see a summary of what's new as soon as we're back online.",
  },
  {
    label: "Emergency Hotfix",
    title: "Emergency hotfix deployment",
    eta: "~15 minutes",
    durationMinutes: 15,
    message:
      "Our engineering team is applying an urgent hotfix to resolve a recently identified service issue and protect workspace reliability. Access is temporarily paused while we deploy and confirm the fix across all regions. Your data has not been affected and we appreciate your patience while we restore full operations.",
  },
  {
    label: "Infrastructure & Capacity Migration",
    title: "Server infrastructure and capacity upgrade",
    eta: "~1 hour",
    durationMinutes: 60,
    message:
      "We are upgrading and migrating core server infrastructure to expand platform capacity and improve regional response times. Workspaces are locked during the cutover to keep every employee record, shift schedule, and audit log 100% consistent. Normal service will resume automatically once verification completes.",
  },
  {
    label: "API & Domain Routing Upgrade",
    title: "API gateway and custom domain routing maintenance",
    eta: "~25 minutes",
    durationMinutes: 25,
    message:
      "We are performing scheduled maintenance on our API gateway (api.onboardops.org), webhook pipelines, and custom workspace domain routing. API integrations, webhooks, and custom domain logins may be unavailable during this window. Existing workspace data and API keys remain unchanged and will resume working automatically once complete.",
  },
  {
    label: "Auth, 2FA & SSO Maintenance",
    title: "Authentication and single sign-on system upgrade",
    eta: "~20 minutes",
    durationMinutes: 20,
    message:
      "We are upgrading our authentication, two-factor verification, and workspace SSO infrastructure to strengthen session security and reliability. New sign-ins are temporarily paused during this maintenance window. Your login credentials, 2FA enrollments, and SSO configurations remain unchanged.",
  },
  {
    label: "Storage & Document Pipeline Upgrade",
    title: "Encrypted file storage maintenance",
    eta: "~30 minutes",
    durationMinutes: 30,
    message:
      "We are performing scheduled maintenance on our encrypted file storage and document processing pipeline. Uploading or downloading employee documents, policies, and checklist photos is paused while we complete integrity checks. All existing files remain encrypted and untouched.",
  },
  {
    label: "Email & Notifications Upgrade",
    title: "Email delivery and notification system maintenance",
    eta: "~20 minutes",
    durationMinutes: 20,
    message:
      "We are updating our outbound email transport and workspace notification pipelines to improve deliverability and speed. Automated invites, resets, and notification emails may be paused or queued briefly during this window and will resume normally once maintenance concludes.",
  },
  {
    label: "Hosting Provider Maintenance",
    title: "Scheduled upstream cloud provider maintenance",
    eta: "~45 minutes",
    durationMinutes: 45,
    message:
      "Our upstream cloud and database hosting provider is performing scheduled network and hardware maintenance in our primary region. To prevent partial saves or interrupted sessions, OnboardOps is placed in maintenance mode until the provider completes their work and all health checks return green.",
  },
  {
    label: "Backup & Compliance Snapshot Window",
    title: "Scheduled backup verification and audit integrity check",
    eta: "~30 minutes",
    durationMinutes: 30,
    message:
      "We are conducting a scheduled full-platform backup verification and tamper-evident audit log integrity check. Access is briefly paused to capture a clean, consistent snapshot across all workspaces. Full access will be restored automatically shortly.",
  },
];

export const ANNOUNCEMENT_PRESETS: { label: string; message: string; tone: "info" | "warning" | "success"; linkUrl?: string; linkLabel?: string }[] = [
  {
    label: "New Release Live",
    message: "A new OnboardOps update is live with upgraded incident status tracking, AI course builder tools, and faster workspace controls.",
    tone: "success",
    linkUrl: "/changelog",
    linkLabel: "Read release notes",
  },
  {
    label: "Upcoming Maintenance",
    message: "Heads up: scheduled maintenance is planned tonight at 11:00 PM EST (~30 minutes). Please save your work beforehand—live updates will be posted on our status page.",
    tone: "warning",
    linkUrl: "https://status.onboardops.org",
    linkLabel: "View status page",
  },
  {
    label: "Degraded Performance Notice",
    message: "We're currently seeing slower than usual responses on some workspace pages and email deliveries. Our team is actively investigating—your data is safe.",
    tone: "warning",
    linkUrl: "https://status.onboardops.org",
    linkLabel: "Follow updates",
  },
  {
    label: "New Dedicated API Host",
    message: "Public API v1 endpoints now live at https://api.onboardops.org/v1 for faster, dedicated API traffic. Legacy URLs continue redirecting automatically.",
    tone: "info",
    linkUrl: "/support/api-reference",
    linkLabel: "API reference",
  },
  {
    label: "Enable 2FA Reminder",
    message: "Protect your workspace: two-factor authentication (2FA), Google/GitHub sign-in, and workspace SSO are now available in Account & Workspace Settings.",
    tone: "info",
    linkUrl: "/account",
    linkLabel: "Security settings",
  },
  {
    label: "Beta Feedback Callout",
    message: "We're actively building OnboardOps alongside our beta teams—share feature requests or bug reports anytime using Feedback in the top bar!",
    tone: "info",
  },
];
