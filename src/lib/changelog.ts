export type ChangelogEntry = { v: string; date: string; items: string[]; highlight?: string };

export const entries: ChangelogEntry[] = [
  {
    v: "0.11.1",
    date: "2026-11-22",
    highlight: "New video tutorial for setting up your workspace",
    items: [
      "A two minute video tutorial now walks through setting up a workspace: the setup wizard, inviting staff, your first course, discipline rules, Discord and Teams alerts, features and roles, and your own domain. Chapters are clickable, and it is linked from the footer and the launch checklist.",
    ],
  },
  {
    v: "0.11.0",
    date: "2026-11-21",
    highlight: "Stronger encryption, employee portal tabs and free manager tools",
    items: [
      "Database security improved: the site now locks sensitive records with a separate key per workspace, the keys themselves are locked by a master key kept outside the database, and rows already stored are being re-encrypted. Even a copy of the database alone no longer shows these notes or files in readable form.",
      "Stronger encryption: sensitive notes, case and incident text, injury details, contact numbers and every uploaded file are now encrypted before they are stored, with a separate key for each workspace.",
      "A new, simpler maintenance page that checks on its own and reloads when we are back.",
      "Legal documents are much longer and more detailed, and now say plainly that no system can be guaranteed to be 100% secure.",
      "The employee portal is now split into tabs: Home, Schedule, Training, Policies, Checklists, Requests and Records, with counts on the tabs that need attention.",
      "Careers is now in the main navigation.",
      "Employees can add a written response to any case, and managers can keep private coaching notes that are never infractions.",
      "Incident reports can include photos and be filed anonymously. Managers can assign an investigator and due date, and record injury details. Injury log export (CSV) for the year.",
      "Case trends page: cases by month, severity, policy, department and manager, with appeal overturn rate.",
      "Read-only API keys with /api/v1/employees and /api/v1/shifts, and a signed JSON webhook for operations and confidential events.",
      "Payroll hours export (CSV) from timesheets, and an Email me this summary button on Reports.",
      "Locations: add sites or stores and assign employees to them.",
      "Installable app (add to home screen) with an offline page. Checklists finished without a connection are saved on the device and sent when you are back online.",
      "When a new version of OnboardOps goes live, open tabs now show a short update screen with a one-line note of what is new, then refresh themselves, instead of breaking.",
      "Free tools for managers: a warning write-up helper, a \"should I write this up?\" helper, a policy builder with sign-off sheets, a discipline ladder builder and a handbook outline generator. Drafts you save can be added to a new workspace.",
      "Public certificate verification at /verify, free manager playbooks, migration guides from spreadsheets and paper, a 30-minute launch checklist, a Careers page with a staff-side applications inbox, partner badges with referral tracking, a brand page, \"Was this helpful?\" on help articles, and a friendlier 404 page.",
      "Employee portal Today view: your shift and who is on with you, a one-tap time clock, checklists due, things to sign, a to-do list with progress, and a 7-day strip. Plus a case progress tracker and a plain-language page of what is recorded about you.",
      "Every workspace can get its own address, like yourcompany.onboardops.org, created automatically. Owners can pick or change the name in Settings.",
      "New homepage: a new slogan, a security strip, role views, a beta explainer, a short FAQ, a waitlist and a phone-friendly sign-up button.",
      "New blog with practical HR guides, a public roadmap where signed-in users can vote, and an upgraded Security page with a printable summary.",
      "Microsoft Teams webhooks alongside Discord and Slack.",
      "Attach employee documents and policies by share link from Google Drive, SharePoint or OneDrive, Dropbox or Box, without uploading a copy.",
      "BambooHR sync: connect your own BambooHR account (key stored encrypted) to add new hires from its directory.",
      "Private calendar feed link (.ics) so shifts and approved time off appear in Google, Apple or Outlook calendar.",
      "Optional text messages for new shifts, swap answers and request decisions. Each workspace connects its own Twilio account (token stored encrypted), and employees opt in individually.",
      "Rate limiting on sign-in, password reset, magic links, contact and search, stricter security headers, and a keyed audit log you can verify.",
    ],
  },
  {
    v: "0.10.0",
    date: "2026-11-21",
    items: [
      "Appeals and evidence: employees can file an appeal from My Portal, reviewers uphold or overturn it from the case drawer (overturning restores strike points), and cases can hold witness statements and evidence.",
      "Progressive discipline rules and strike point decay: owners and admins can set escalation rules and apply a rolling decay window, configured under Settings.",
      "Time off: vacation, sick and personal requests with yearly allowances, days-left balances, a team calendar, and warnings when teammates request the same days.",
      "Shift schedule week view with drag-to-assign and drag-to-move, and shift swap requests that managers approve or deny. Employees see their upcoming shifts in My Portal.",
      "My Portal: time clock widget, profile update requests (with a manager approval queue), checklist photo uploads and a Due today badge on recurring checklists.",
      "Checklists can repeat on chosen weekdays with a due time. Templates can be duplicated or deleted, and submission photos show as a gallery.",
      "Policy editor shows what changed from the saved version, and each policy has a printable sign-off sheet.",
      "Audit log: Verify chain re-checks the hash chain, and Export CSV downloads the full log.",
      "Account: per-type email notification toggles, quiet hours settings, and a list of signed-in devices you can end individually, with an email when a new device signs in.",
      "Custom employee fields (Settings) with values editable on each employee record, bulk document upload, and manual column matching when importing employees from CSV.",
      "Command Center alerts for overdue checklists and expiring credentials or documents, and Ctrl+K now searches people and cases.",
      "Workspace branding (accent color and tagline) and a strike decay window in Settings.",
    ],
  },
  {
    v: "0.9.0",
    date: "2026-11-21",
    items: [
      "One-click role assignment: promote or assign anyone as an Employee, Supervisor, Manager or Admin directly from the Staff Accounts table, the Employee Dossier, or when adding and bulk-inviting staff.",
      "OnboardOps subdomains & manual domain assignment: workspaces can now use <name>.onboardops.org subdomains (such as retailnetwork.onboardops.org) in addition to external custom domains, and site owners can manually connect and verify domains from the Staff Console.",
      "Shift Handoff Notes feed (/app/handoff): post department or general handoff notes between opening, mid-shift and closing teams, alongside handoff notes from shift checklists.",
      "Shift Scheduling (/app/schedule), Time Clock & Timesheets (/app/timesheets), and Equipment Sign-Out (/app/assets) pages are now live when enabled in Workspace Features.",
      "Credentials & Licenses (/app/credentials): add, track and remove employee licenses and certifications with 30-day expiry warnings.",
      "Corrective-action template picker when logging an infraction to pre-fill severity, strike points, policy violated and summary.",
      "Live system status page (/status) and BetterStack monitoring endpoints (/api/status, /api/status/frontend, /api/status/database, /api/status/auth, /api/status/api, /api/status/email, /api/status/storage, /api/status/domains, and /api/health).",
    ],
  },
  { v: "0.8.0", date: "2026-11-20", items: ["Account settings: profile picture, nickname, add and remove email addresses, make one primary, change your password, and sign out other devices. Any confirmed email can be used to sign in.", "Simpler navigation, with secondary pages under Resources, and a lighter home page.", "Legal pages are much longer and more detailed, with new Employee Privacy Notice and Data Retention and Deletion Policy documents."] },
  { v: "0.7.0", date: "2026-11-19", items: ["Magic links: sign in from an emailed link with no password, on the main sign in and on each workplace's staff sign in.", "New Why OnboardOps page with a side-by-side comparison, a time calculator and a fit check.", "Interactive home page: click through the workflow with real screens, explore what each role can see, and run the numbers for your team.", "Staff console access now requires a verified email."] },
  { v: "0.6.0", date: "2026-11-18", items: ["Employees can create their own account, verify their email, and see Workplaces I'm employed in. Employers that added their email appear to join.", "Workspace staff sign-in at /w/your-name, and custom domains connected through Vercel, with a branded sign-in and a workspace-only app on that address.", "Employees can request a leave of absence, retirement or resignation; managers approve or deny, and records update on the right dates.", "Staff Accounts page: send sign-in invites to many employees at once.", "Employees whose records are closed can no longer sign in.", "Account lockout after repeated wrong passwords.", "Emails are now designed HTML emails with icons."] },
  { v: "0.5.0", date: "2026-11-16", items: ["Staff console for the OnboardOps team: support inbox, workspace directory, time-limited read-only support access that customers can see, account recovery, workspace locking, privacy request queue, beta feedback board, email delivery log, metrics and an append-only staff activity log.", "Send feedback from inside the app."] },
  { v: "0.4.0", date: "2026-11-14", items: ["Password reset by email, and email invites so employees choose their own password. Changing a password signs out other devices.", "Bulk employee import from CSV with a preview and a line-by-line list of skipped rows.", "Due dates, training reminders, expiring certificates that re-enroll automatically, and a daily job to run them.", "In-app notification bell.", "Policies and handbooks with PDF upload, per-role assignment, versioning and signature tracking.", "Employee documents with restricted access, incident reports that can become cases, and performance reviews and 1:1 notes for managers.", "Reports page with charts and a printable compliance report.", "Full workspace export and an owner-only option to close and delete a workspace."] },
  { v: "0.3.0", date: "2026-11-12", items: ["New help center with step-by-step guides, search and a support contact form.", "Legal documents rewritten with numbered sections, plain-English summaries, a table of contents, processing details and a subprocessor list.", "Minimum age is now 13 (with parent or guardian permission under 18).", "Home page now uses real screenshots of the app, with a tabbed gallery.", "New logo, and animations throughout that respect the reduced-motion setting."] },
  { v: "0.2.0", date: "2026-11-10", items: ["Rebuilt the interface: accessible dialogs and drawers, icons, a light / system / dark theme switch, and a new Command Center with course completion and an attention list.", "New public pages: Solutions, Security, About, Contact and FAQ.", "Added Terms of Service, Terms of Use, Privacy Policy, Acceptable Use Policy, Cookie Policy, Data Processing Addendum and Beta Program Terms.", "Registration now requires accepting the Terms and Privacy Policy, and the acceptance is recorded in the audit log.", "Everything is free for beta testers."] },
  { v: "0.1.0", date: "2026-11-08", items: ["Staff directory, employee dossier and status changes with required reasons.", "Training academy: multi-lesson builder, server-graded quizzes, certificate codes (CERT-#####), compliance matrix.", "Infraction ledger with append-only case timeline, confidential notes (managers and above only) and employee acknowledgment.", "Auto-retraining on written infractions or 2+ points; auto-suspend at the workspace strike threshold.", "Shift checklists with supervisor verification.", "Audit log where each entry's SHA-256 hash chains over the previous entry.", "Operations and confidential webhooks for Discord and Slack, plus Resend email notifications."] },
  { v: "0.0.9", date: "2026-11-06", items: ["Fixed: changing a job role no longer duplicates enrollments for courses an employee already has.", "Quiz retake cooldown is now enforced on the server instead of the browser.", "Supervisors can no longer open confidential timeline notes through the case drawer."] },
];

/** One short line about the newest release, shown on the update screen. Uses the entry's highlight, or the start of its first item. */
export function latestHighlight(): string {
  const e = entries[0];
  if (!e) return "";
  if (e.highlight) return e.highlight;
  const first = e.items[0] ?? "";
  const cut = first.split(/[:.]/)[0].trim();
  return cut.length > 90 ? `${cut.slice(0, 87)}...` : cut;
}
