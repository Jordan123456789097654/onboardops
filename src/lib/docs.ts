export type Block =
  | { t: "p"; v: string }
  | { t: "h"; v: string }
  | { t: "ol"; v: string[] }
  | { t: "ul"; v: string[] }
  | { t: "note"; v: string }
  | { t: "table"; head: string[]; rows: string[][] };

export type Article = { slug: string; title: string; cat: string; summary: string; body: Block[] };

export const categories = ["Getting started", "People and roles", "Training", "Discipline", "Compliance and records", "Checklists", "Integrations", "Account and data", "Support"] as const;

const p = (v: string): Block => ({ t: "p", v });
const h = (v: string): Block => ({ t: "h", v });
const ol = (...v: string[]): Block => ({ t: "ol", v });
const ul = (...v: string[]): Block => ({ t: "ul", v });
const note = (v: string): Block => ({ t: "note", v });
const table = (head: string[], rows: string[][]): Block => ({ t: "table", head, rows });

export const articles: Article[] = [
  {
    slug: "api-keys", cat: "Integrations", title: "API keys: create, use, rotate and revoke", summary: "How to make a key, keep it safe, swap it without downtime, and shut it off.",
    body: [
      p("An API key lets one of your own systems (a payroll tool, a scheduler, a script) read or change your workspace. Keys belong to your workspace, not to a person, but every action a key takes is recorded in the audit log under the key's name, and a key can never do more than the person who created it."),
      h("Create a key"),
      ol("Sign in as an owner or admin and open Settings, then Integrations.", "Choose Create API key and give it a name that says what uses it, such as \"Payroll sync\".", "Tick only the scopes that system needs. Reading and writing are separate scopes, so most systems only need the read ones.", "Copy the key straight away. It is shown once. If you lose it, revoke it and create a new one."),
      note("Give each system its own key. If one key is ever exposed, you can shut it off without breaking the others."),
      h("Use a key"),
      p("Send the key in the Authorization header on every request, as a Bearer token: Authorization: Bearer oo_live_... Use HTTPS only. Never put a key in a URL, a web page, a screenshot, a support ticket, or a shared document."),
      h("Store it safely"),
      ul("Keep keys in your system's secret store or environment variables, not in code or config files you commit to a repository.", "Limit who can see the secret store. Anyone with the key can act with its scopes.", "If a key appears anywhere it should not have, revoke it first and investigate second."),
      h("Rotate a key without downtime"),
      ol("Create a new key with the same scopes and a name like \"Payroll sync (new)\".", "Update your system to use the new key and confirm it works (a read request is enough to test).", "Revoke the old key once nothing uses it. Revoking stops it working immediately, so do it after the switch."),
      h("Revoke a key"),
      p("Open Settings, then Integrations, and revoke the key. It stops working straight away, and the revoke is recorded in the audit log. Revoking cannot be undone, so create a replacement first if something still depends on it."),
      h("Troubleshooting"),
      table(["Response", "What it means", "What to do"], [
        ["401 missing_key", "No key was sent", "Check the Authorization header is present and starts with Bearer"],
        ["401 invalid_key", "The key is wrong, was copied incorrectly, or has been revoked", "Copy the full key again, or create a new one"],
        ["401 key_expired", "The key has passed its expiry date", "Create a new key and switch to it"],
        ["403 insufficient_scope", "The key's scope does not allow this request", "Create a key with the scope you need, or use a read-only key for reads"],
        ["429", "Too many requests in a minute", "Slow down and retry after the wait shown in the Retry-After header"],
      ]),
      p("Every error includes a requestId. Quote it when you contact support so we can find the exact request."),
      h("Good practice"),
      ul("Review keys every few months and revoke any you no longer use.", "Choose the smallest set of scopes that works.", "When someone who created a key leaves the workspace, the key can no longer write. Still replace it, so the system keeps working on purpose rather than by accident.", "See the full endpoint list and examples in the API reference."),
    ],
  },
  {
    slug: "api-reference", cat: "Integrations", title: "API reference (read and write)", summary: "Keys, scopes, every endpoint, errors, rate limits and examples.",
    body: [
      p("The API lets your own systems read and change data in your workspace. Everything it does is checked on the server the same way the app checks it, and every write is recorded in your audit log under the name of the key. Base URL: https://api.onboardops.org (legacy https://www.onboardops.org/api/v1/... URLs redirect permanently to api.onboardops.org)."),
      h("Keys and scopes"),
      ol("An owner or admin opens Settings, Integrations, and creates a key.", "Tick only the scopes the key needs. A key shows once; copy it then.", "Send it as Authorization: Bearer oo_live_... on every request. Revoke it any time and it stops working immediately."),
      table(["Scope", "Allows"], [["employees:read", "GET /v1/employees and /v1/employees/{id}"], ["employees:write", "POST /v1/employees, PATCH /v1/employees/{id}"], ["shifts:read", "GET /v1/shifts"], ["shifts:write", "POST /v1/shifts"], ["courses:assign", "POST /v1/assignments"], ["infractions:write", "POST /v1/infractions (verbal warning, written infraction, strike points)"], ["audit:read", "GET /v1/audit"]]),
      note("A key can never do more than the person who created it. If that person is demoted, the key's writes are limited to their new role. If they leave the workspace, the key can no longer write. Keys created before scopes existed are read-only."),
      h("Write endpoints"),
      ul("POST /v1/employees: fullName, email, and optionally phone, emergencyContact, departmentId, jobRoleId, hireDate (YYYY-MM-DD). Send an object, or an array of up to 100.", "PATCH /v1/employees/{id}: send only the fields to change. To change status, also send statusReason. Only an owner or admin can terminate.", "POST /v1/assignments: courseId, employeeIds (up to 100), reason, and optionally dueDate.", "POST /v1/infractions: employeeId, severity, policyViolated, summary, and optionally pointsAdded, evidenceUrls, confidentialManagerNotes. Suspensions and terminations cannot be logged through the API.", "POST /v1/shifts: startsAt and endsAt (ISO 8601), and optionally employeeId, departmentId, label, notes. Send an object or an array of up to 100."),
      p("Example: curl -X POST https://api.onboardops.org/v1/employees -H \"Authorization: Bearer oo_live_...\" -H \"Content-Type: application/json\" -d '{\"fullName\":\"Maya Chen\",\"email\":\"maya@example.com\"}'"),
      p("Bulk requests (an array) return one result per item: { index, ok, ... } or { index, ok: false, error }. One bad item does not stop the others."),
      h("Responses and errors"),
      p("Success: { data, requestId }. Lists: { data, nextCursor }. Errors: { error, code, requestId } with a matching HTTP status. Quote the requestId when you contact support."),
      table(["Status", "code", "Meaning"], [["400", "invalid_json, request_failed", "The body was not valid JSON, or the change could not be made"], ["401", "missing_key, invalid_key, key_expired", "The key is missing, wrong, revoked or expired"], ["403", "insufficient_scope, forbidden, key_owner_missing, workspace_suspended, severity_not_allowed", "The key or its creator may not do that"], ["404", "not_found, course_not_found", "No such record in your workspace"], ["409", "duplicate_email", "An employee with that email already exists"], ["413", "body_too_large", "Bodies are limited to 256 KB"], ["422", "validation_failed, unknown_department, unknown_job_role, unknown_employee, too_many_items", "A field failed validation"], ["429", "rate_limited", "Wait for the Retry-After seconds"]]),
      h("Limits"),
      ul("120 requests a minute per key, and 30 writes a minute per key.", "Up to 100 items in one bulk request, and 256 KB per request.", "Only your own workspace's records are ever visible or changeable. IDs from another workspace return not found."),
      note("Writes are not idempotent: sending the same create twice makes two records (duplicate emails are refused). Keep your own record of what you sent."),
    ],
  },
  {
    slug: "create-your-workspace", cat: "Getting started", title: "Create your workspace", summary: "Sign up, accept the terms and land in your Command Center.",
    body: [
      p("A workspace holds everything for one company: employees, courses, cases and settings. You become its Owner when you create it."),
      ol("Open the Register page and enter your name, company name, work email and a password of at least 8 characters.", "Tick the box to confirm you are 13 or older and agree to the Terms of Service, Privacy Policy and Beta Program Terms.", "Select Create workspace. You are signed in and taken to the Command Center."),
      note("Your acceptance of the terms is recorded in the audit log with the version date."),
      h("Next steps"),
      ul("Add departments and job roles in Settings.", "Build or publish a course, then tie it to a job role.", "Add your first employee."),
    ],
  },
  {
    slug: "set-up-departments-and-roles", cat: "Getting started", title: "Set up departments and job roles", summary: "Structure your team so new hires are enrolled in the right courses automatically.",
    body: [
      p("Open Settings, then the Departments & Job Roles tab. Only Owners and Admins can change these."),
      h("Departments"),
      p("Use departments for the places people work, such as Warehouse, Dispatch or Front Desk. Each gets a color that shows in tables, and shift checklists can be assigned to a department."),
      h("Job roles and required courses"),
      p("A job role lists the courses every person in that role must pass. When you assign the role to an employee, or change their role, OnboardOps enrolls them in every required course they do not already have and sets their readiness to Pending."),
      ol("Choose Add job role.", "Enter a title and short description.", "Tick the required courses and save."),
      note("Changing a role never removes existing enrollments or certificates."),
    ],
  },
  {
    slug: "add-an-employee", cat: "Getting started", title: "Add an employee", summary: "Create the record, assign a role and send the welcome email.",
    body: [
      p("Go to Staff Directory and choose Add employee. Managers, Admins and Owners can do this."),
      ol("Enter the full name and work email. Phone and emergency contact are optional.", "Pick a department and job role.", "Select Add employee."),
      p("The employee gets the next staff ID in your workspace (for example EMP-1009), starts with status Onboarding and readiness Pending, and is enrolled in the courses their role requires. If email is configured they receive a welcome message listing that training."),
      h("Employee statuses"),
      { t: "table", head: ["Status", "Meaning"], rows: [["Onboarding", "New hire who has not finished required training."], ["Active", "Working and trained. Set automatically when every required course is passed."], ["Leave of absence", "Away but still employed."], ["Suspended", "Set by a manager, or automatically at your strike-point limit."], ["Terminated", "No longer employed. Only Owners and Admins can set this."]] },
    ],
  },
  {
    slug: "give-employees-sign-in-access", cat: "Getting started", title: "Give an employee sign-in access", summary: "Create a login so someone can use the employee portal.",
    body: [
      p("An employee record does not need a login. Add one when you want the person to take courses, complete checklists and sign notices themselves."),
      ol("Open the employee's dossier.", "On the Overview tab, next to Sign-in access, choose Grant access.", "Leave the password blank and choose Grant access and send invite. The employee gets an email with a one-time link, valid for 7 days, to choose their own password.", "If email is not set up on your server, the link is shown to you so you can copy and share it yourself."),
      p("You can also type a temporary password instead. The employee signs in at the Login page and lands on My Portal, where they see only their own training, checklists, policies and notices."),
      note("If someone loses access, open their dossier and choose Send set-password link, or they can use Forgot password on the sign-in page."),
    ],
  },
  {
    slug: "roles-and-permissions", cat: "People and roles", title: "Roles and permissions", summary: "What Owners, Admins, Managers, Supervisors and Employees can do.",
    body: [
      p("Permissions are checked on the server for every action, not only in the menu."),
      { t: "table", head: ["Action", "Owner/Admin", "Manager", "Supervisor", "Employee"], rows: [["View staff directory", "Yes", "Yes", "Yes", "No"], ["Create and edit employees", "Yes", "Yes", "No", "No"], ["Build courses and quizzes", "Yes", "Yes", "No", "No"], ["Verbal and written warnings", "Yes", "Yes", "Yes", "No"], ["Strike points and suspensions", "Yes", "Yes", "No", "No"], ["Terminate staff", "Yes", "No", "No", "No"], ["Read confidential notes", "Yes", "Yes", "No", "No"], ["Verify checklists", "Yes", "Yes", "Yes", "No"], ["Read the audit log", "Yes", "No", "No", "No"], ["Change settings and webhooks", "Yes", "No", "No", "No"], ["Own courses, checklists, notices", "Yes", "Yes", "Yes", "Yes"]] },
      note("Only the Owner can create or promote Admins."),
    ],
  },
  {
    slug: "change-a-members-role", cat: "People and roles", title: "Assign or change someone's role", summary: "Promote or assign Employee, Supervisor, Manager or Admin roles in one click.",
    body: [
      p("You can assign or change a person's workspace access role in four places:"),
      ul(
        "Staff Accounts (/app/access): Every row has an inline Access role dropdown (EMPLOYEE, SUPERVISOR, MANAGER, ADMIN). Selecting a role updates their permissions immediately—and if they don't have a login yet, it automatically sends an invite or links their account with that role.",
        "Bulk Invites (/app/access): Select multiple employees, choose 'Invite as MANAGER', 'Invite as SUPERVISOR', etc., and send invites in one batch.",
        "Add Employee drawer (/app/directory): Choose the person's Workspace access role right when creating their employee profile.",
        "Employee Dossier (/app/employee/[id]): Change their Workspace access role directly on the Overview tab or when granting sign-in access."
      ),
      p("The Workspace Owner's role cannot be changed. Every role change takes effect immediately and is recorded in the append-only audit log."),
    ],
  },
  {
    slug: "build-a-course", cat: "Training", title: "Build a course", summary: "Lessons in Markdown, optional video and a graded quiz.",
    body: [
      p("Open Training Academy and choose New course (Managers and above)."),
      ol("Enter the title, description and category.", "Set the passing score and the retake cooldown in minutes.", "Add one or more lessons. Write the content in Markdown, add an optional YouTube or Vimeo link, and set the minimum read time in seconds.", "Add quiz questions. Each has four options, one correct answer and an explanation shown after grading.", "Choose Save draft or Save & publish."),
      h("Remedial courses"),
      p("Tick Remedial for a course that should be assigned automatically after a written infraction. If you have several, the oldest published remedial course is used."),
      note("Only published courses appear to employees and in the compliance matrix."),
    ],
  },
  {
    slug: "how-quizzes-are-graded", cat: "Training", title: "How quizzes are graded", summary: "Server-side grading, cooldowns and certificate codes.",
    body: [
      p("Quizzes are graded on the server. The correct answers are never sent to the browser while someone is taking the quiz."),
      ul("The score is the percentage of correct answers, rounded.", "A score at or above the passing score marks the course Passed and issues a certificate code such as CERT-48213.", "A lower score marks the course Failed. The employee can retake after the cooldown.", "Employees must read each lesson for its minimum time before moving on."),
      h("Becoming certified"),
      p("When an employee has passed every course they are enrolled in, their readiness becomes Certified, and if they were Onboarding their status becomes Active."),
    ],
  },
  {
    slug: "certificates-and-compliance", cat: "Training", title: "Certificates and the compliance matrix", summary: "Print certificates and see who is missing training.",
    body: [
      p("Passed courses show a certificate code on the employee's dossier and in their portal. Select the code to open a printable certificate, then use your browser's Print dialog and choose Save as PDF."),
      p("The Compliance Matrix lists every non-terminated employee against every published course. Green is passed with the score, amber is assigned or in progress, red is failed, and blank means not assigned."),
    ],
  },
  {
    slug: "log-an-infraction", cat: "Discipline", title: "Log an infraction", summary: "Record a warning, points, a suspension or a termination.",
    body: [
      ol("Open Infractions and choose Log Infraction.", "Pick the employee and severity.", "Add strike points if the case carries them.", "Name the policy violated and describe what happened. This text is visible to the employee.", "Add evidence links, one per line, and optional confidential manager notes.", "Submit."),
      { t: "table", head: ["Severity", "Who can issue it"], rows: [["Verbal warning", "Supervisor and above"], ["Written infraction", "Supervisor and above"], ["Strike points", "Manager and above"], ["Suspension", "Manager and above"], ["Termination", "Owner and Admin"]] },
      note("Cases cannot be edited or deleted. To correct something, add a timeline note."),
    ],
  },
  {
    slug: "strike-points-and-automation", cat: "Discipline", title: "Strike points and automatic actions", summary: "When retraining, suspension and termination happen on their own.",
    body: [
      p("Issuing a case adds its points to the employee's total and then applies these rules inside one database transaction:"),
      ul("A written infraction, or a case adding 2 or more points, sets readiness to Retraining Required and assigns the remedial course, if automatic retraining is turned on in Settings.", "Reaching your strike-point limit (default 5), or a Suspension case, sets status to Suspended.", "A Termination case sets status to Terminated.", "Every automatic action is written to the audit log and sent to your confidential webhook."),
      p("Change the limit or turn off automatic retraining in Settings, Automation & Webhooks."),
    ],
  },
  {
    slug: "acknowledgments-and-confidential-notes", cat: "Discipline", title: "Acknowledgments and confidential notes", summary: "How employees sign, and what they never see.",
    body: [
      h("Acknowledgment"),
      p("Employees with a login see new cases in My Portal under Needs your signature. They type their full name exactly as it appears on their record. The signature confirms receipt, not agreement, and the case records who signed and when."),
      h("Confidential notes"),
      p("Confidential manager notes and confidential timeline notes are visible only to Owners, Admins and Managers. The server removes them before sending data to employees and supervisors, and they are never included in webhook or email messages."),
    ],
  },
  {
    slug: "shift-checklists", cat: "Checklists", title: "Create and verify shift checklists", summary: "Opening, mid-shift and closing checklists with supervisor sign-off.",
    body: [
      ol("Open Shift Checklists, then Templates, and choose New template.", "Name it, choose Opening, Mid shift or Closing, and pick a department or All.", "Add items and mark which are required.", "Employees complete them from My Portal. Required items must be ticked before they can submit.", "Supervisors and above open Completed logs and choose Verify."),
      p("Employees see checklists for their own department and any marked All."),
    ],
  },
  {
    slug: "connect-a-discord-webhook", cat: "Integrations", title: "Connect a Discord webhook", summary: "Send operations and confidential HR events to Discord channels.",
    body: [
      p("OnboardOps has two webhook slots: Operations (hires and certifications) and Confidential HR (infractions and status changes). Use separate private channels."),
      ol("In Discord, open the channel's settings, then Integrations, then Webhooks, and choose New Webhook.", "Copy the webhook URL.", "In OnboardOps open Settings, Automation & Webhooks, paste the URL and choose Send Test Embed.", "Save settings."),
      note("Anyone with a webhook URL can post to the channel. Treat it like a password, and restrict the confidential channel to the people who may read HR matters."),
    ],
  },
  {
    slug: "connect-a-slack-webhook", cat: "Integrations", title: "Connect a Slack webhook", summary: "Use a Slack incoming webhook for the same events.",
    body: [
      ol("Create a Slack app (or open an existing one) and turn on Incoming Webhooks.", "Choose Add New Webhook to Workspace and pick the channel.", "Copy the URL, which starts with https://hooks.slack.com.", "Paste it into Settings in OnboardOps, send a test, and save."),
      p("Slack messages use plain text with the title and details instead of Discord's rich embeds."),
    ],
  },
  {
    slug: "email-notifications", cat: "Integrations", title: "Email notifications", summary: "Which emails OnboardOps sends.",
    body: [
      p("Email is sent after the change is saved, so a delivery problem never undoes your data."),
      ul("Welcome message with required courses when you add an employee with a job role.", "New course assigned, including automatic retraining.", "An infraction that needs the employee's signature (not sent for verbal warnings).", "A receipt to the issuer when the employee signs."),
      note("Email requires a Resend API key and a verified sending domain on the server. If you host OnboardOps yourself, set RESEND_API_KEY and EMAIL_FROM."),
    ],
  },
  {
    slug: "export-and-print", cat: "Account and data", title: "Export and print your data", summary: "CSV exports, dossiers and certificates.",
    body: [
      ul("Staff Directory, Export CSV: downloads the list with your current filters applied.", "Employee dossier, Export Printable PDF Dossier: opens a print view. Use Print, then Save as PDF. Confidential notes appear only if your role may see them.", "Certificates: open from a certificate code."),
      p("Owners and Admins can download a full workspace export from Settings, Data & privacy. It is a JSON file with every record, including confidential notes, so store it securely. Uploaded files are listed but not included. See Export or close your workspace."),
    ],
  },
  {
    slug: "sign-in-and-account-help", cat: "Account and data", title: "Sign-in and account help", summary: "Forgotten passwords, themes and sessions.",
    body: [
      ul("Sessions last up to 14 days, then you sign in again. Changing your password signs out every other device.", "Passwords are stored as one-way hashes. We cannot read or email your password.", "Forgot your password? On the sign-in page choose Forgot password, enter your email, and open the link we send. It works once and expires after 1 hour. For privacy, we show the same message whether or not an account exists.", "Use the sun, monitor and moon switch in the top bar to choose a light, system or dark theme. Your choice is saved in your browser."),
    ],
  },
  {
    slug: "import-employees-from-csv", cat: "Getting started", title: "Import employees from a CSV", summary: "Add up to 500 people at once from a spreadsheet.",
    body: [
      p("Open Staff Directory and choose Import CSV (Managers and above)."),
      ol("Choose Template to download a sample file, or use your own with a header row.", "Required columns: Full name and Email. Optional: Phone, Department, Job role, Hire date (YYYY-MM-DD) and Emergency contact.", "Upload the file. A preview shows the first rows and any column problems.", "Choose whether to create departments and job roles that do not exist yet, and whether to send welcome emails.", "Select Import."),
      p("Each new employee gets the next staff ID and is enrolled in their job role's required courses. Rows that cannot be imported, such as a duplicate email or an unknown department, are listed with the line number so you can fix them and try again."),
      note("Names must match your existing departments and job roles (not case sensitive). New job roles created by an import start with no required courses."),
    ],
  },
  {
    slug: "training-due-dates-reminders-and-expiry", cat: "Training", title: "Due dates, reminders and expiring certificates", summary: "How OnboardOps nudges people and keeps certifications current.",
    body: [
      h("Due dates"),
      p("Each course has a Due within setting (default 14 days) that sets the due date when it is assigned. When you assign a course by hand you can pick a specific date instead."),
      h("Reminders"),
      ul("A reminder goes out in the app and by email when training is due within 3 days.", "An overdue reminder goes out once training is late, and again every 7 days until it is done.", "Overdue training also shows on the Command Center and in Reports."),
      h("Expiring certificates"),
      p("Set Certificate valid (days) on a course, for example 365 for forklift certification. Passing the course sets an expiry date. 30 days and again 7 days before it, the employee is warned. When it expires, the employee is re-enrolled automatically, readiness returns to Pending, and managers are notified. The old certificate code is recorded in the audit log."),
      h("When it runs"),
      p("A daily job does the work. Owners and Admins can turn it off or run it immediately from Settings. Reminders need email to be configured to reach people's inboxes; in-app notifications always work."),
    ],
  },
  {
    slug: "policies-and-acknowledgments", cat: "Compliance and records", title: "Policies and handbook acknowledgments", summary: "Publish a policy, choose who signs, and track signatures.",
    body: [
      ol("Open Policies and choose New policy (Managers and above).", "Enter a title and either write the text in Markdown, upload a PDF (up to 4 MB), or both.", "Choose Everyone must sign, or pick the job roles.", "Publish. Employees in scope are notified in the app and by email."),
      p("Employees read and sign from My Portal by typing their full name. Each policy shows how many have signed and who has not."),
      h("New versions"),
      p("When you change a policy in a way that needs fresh signatures, edit it and tick This is a new version. Everyone in scope is asked to sign again, and the previous signatures stay on record."),
    ],
  },
  {
    slug: "employee-documents", cat: "Compliance and records", title: "Employee documents", summary: "Store licenses and signed forms with the right access.",
    body: [
      p("Open an employee's dossier and choose the Documents tab (Managers and above). Upload PDFs, images, DOCX or TXT files up to 4 MB, with a category and an optional expiry date."),
      { t: "table", head: ["Setting", "Who can open it"], rows: [["Normal document", "Owners, Admins and Managers. Optionally the employee, if you tick Let the employee see this."], ["Restricted document", "Owners and Admins only. Always used for work-authorization (I-9) documents."]] },
      note("Only keep what you are legally required or authorized to keep. Never upload Social Security cards, bank details or medical records. Files are stored in your workspace database and removed when you delete the document or close the workspace."),
    ],
  },
  {
    slug: "incident-reports", cat: "Compliance and records", title: "Incident reports", summary: "Anyone can report a near miss, hazard or concern. Managers review it.",
    body: [
      h("Filing a report"),
      p("In My Portal, choose Report an incident. Pick the type (near miss, injury, property damage, safety hazard, conduct or other), when and where it happened, and what happened. Managers and supervisors are notified."),
      h("Reviewing"),
      ol("Open Incident Reports and select a report.", "Add reviewer notes and mark it Reviewing or Closed.", "If someone's conduct needs documented follow-up, choose Turn into a case. The case goes through the same rules as any infraction, including automatic retraining and suspension thresholds."),
      note("Reports made in good faith, such as near-miss and stop-work reports, must not be punished. See the Acceptable Use Policy."),
    ],
  },
  {
    slug: "reviews-and-one-on-ones", cat: "Compliance and records", title: "Performance reviews and 1:1 notes", summary: "Private manager notes with optional sharing.",
    body: [
      p("On an employee's dossier, the Reviews & 1:1s tab is visible to Owners, Admins and Managers only, like confidential case notes. Supervisors and employees cannot see drafts or private notes."),
      ul("Choose 1:1 note or Review, add a period such as Q4 2026, an optional rating, and the summary, strengths, areas to improve and goals.", "Private notes are for managers and are never shared.", "Save as a draft to keep editing. Share with employee publishes everything except the private notes to their portal, notifies them, and locks the entry."),
      p("Shared entries cannot be edited. Create a new entry to add or correct anything."),
    ],
  },
  {
    slug: "notifications", cat: "Account and data", title: "The notification bell", summary: "In-app alerts for assignments, signatures and incidents.",
    body: [
      p("The bell in the top bar shows unread notifications. Select one to go to the related page and mark it read, or choose Mark all read."),
      ul("Employees: new training, retraining, due and overdue reminders, notices to sign, policies, shared reviews and documents.", "Managers: incidents, certifications, expired certificates and acknowledged cases."),
      p("Notifications appear in the app even when email is not configured."),
    ],
  },
  {
    slug: "reports", cat: "Compliance and records", title: "Reports and the compliance report", summary: "Charts for infractions and training, and a printable report.",
    body: [
      p("Open Reports (Managers and above) and choose 3, 6 or 12 months."),
      ul("Infractions by department by month.", "Training completions by month.", "Training compliance by department.", "Incident counts by type.", "Overdue training and certificates expiring within 30 days."),
      p("Printable compliance report opens a one-page-per-screen summary of every current employee: status, readiness, courses passed, overdue and expiring items, and policy signatures. Use Print, then Save as PDF to give to an insurer or auditor. It never includes confidential case notes."),
    ],
  },
  {
    slug: "export-or-close-your-workspace", cat: "Account and data", title: "Export or close your workspace", summary: "Download all your data, or delete it for good.",
    body: [
      h("Export"),
      p("Owners and Admins: Settings, Data & privacy, Download workspace export. You get a JSON file with employees, courses, enrollments, cases and timelines (including confidential notes), checklists, policies and signatures, incident reports, reviews and the audit log. Uploaded files are listed by name but not included. Each export is recorded in the audit log."),
      h("Close the workspace"),
      ol("Download the export first.", "Only the Owner can close the workspace. In Settings, Data & privacy, choose Close workspace.", "Type the workspace name and your password to confirm."),
      note("Closing permanently deletes the workspace and all of its data, and cannot be undone. People who belong to no other workspace have their login removed too."),
    ],
  },
  {
    slug: "employee-accounts-and-my-workplaces", cat: "People and roles", title: "Employee accounts and My workplaces", summary: "How employees create an account and find the workplaces they are employed in.",
    body: [
      h("If your employer sent you an invite"),
      p("Open the link in the email and choose a password. You land in your employer's portal. The link works once and expires after 7 days."),
      h("Creating your own account"),
      ol("Go to Register and choose I work for a company.", "Enter your name, the email your employer has for you, and a password.", "Open the verification link we email you. We only show and let you join employer records after the email is verified, so nobody can claim someone else's record.", "Open Workplaces I'm employed in. Employers that added your email appear under Employers that added you. Choose Join."),
      p("If you work for more than one company, each one appears in the list and you can switch between them."),
      note("Don't see your employer? Ask them to add you with the exact email you registered with, or to send you an invite."),
    ],
  },
  {
    slug: "staff-sign-in-and-custom-domains", cat: "Account and data", title: "Staff sign-in page and custom domains", summary: "Give your team a branded sign-in, on your own address or a partner subdomain.",
    body: [
      h("Staff sign-in link"),
      p("Every workspace has a staff sign-in page at /w/your-workspace-name. It shows your company name and signs people into your workspace only. Find the link in Settings, Sign-in & domain, or on the Staff Accounts page, and share it with your team. Employees can also search for it at Find your workplace sign in."),
      h("Custom domain (Owners and Admins)"),
      ol("Open Settings, then Sign-in & domain, and enter an address you own, such as hr.yourcompany.com.", "OnboardOps adds it to our hosting and shows the DNS records to create at your domain provider: a CNAME for a subdomain, or an A record for a bare domain, plus a verification TXT record if one is requested.", "Choose Check status. DNS changes can take a few minutes to a few hours. When it shows Connected, your staff sign-in is live on that address, with HTTPS."),
      h("Partner *.onboardops.org subdomains"),
      p("Partner workspaces can be assigned a dedicated <partner>.onboardops.org subdomain (such as retailnexus.onboardops.org) by the OnboardOps site owner from the Staff Console. These subdomains are reserved for partners and are verified immediately upon assignment."),
      p("Visitors to your custom or partner address see only your staff sign-in and the app for your workspace. If an invited employee whose invite email did not arrive signs in on your custom domain for the first time with an 8+ character password, their account is set up and linked to your workspace automatically."),
      note("Sessions are separate between onboardops.org and your own custom domain. A person signs in on each."),
    ],
  },
  {
    slug: "shift-handoff-notes", cat: "Checklists", title: "Shift handoff notes", summary: "Pass operational updates and checklist notes between opening, mid-shift and closing teams.",
    body: [
      p("Open Handoff Notes (/app/handoff) from the sidebar to view and post operational updates between shifts."),
      ul(
        "Post a handoff note for a specific department or for the entire workplace.",
        "Filter the handoff feed by department to see what happened on the previous shift.",
        "Handoff notes written by employees when submitting shift checklists appear automatically in the right-hand checklist notes panel."
      ),
      note("Managers and above can delete outdated handoff notes, and every new note is recorded in the workspace audit log."),
    ],
  },
  {
    slug: "scheduling-timesheets-and-equipment", cat: "Checklists", title: "Shift scheduling, time clock and equipment sign-out", summary: "Optional operations tools you can turn on in Workspace Features.",
    body: [
      p("Owners and Admins can enable these operational modules in Settings → Features:"),
      h("Shift scheduling (/app/schedule)"),
      p("Create shifts for specific employees or post open shifts by department with start/end times, shift labels (Opening, Mid, Closing) and notes."),
      h("Time clock & timesheets (/app/timesheets)"),
      p("Clock staff in and out, view active shifts in real time, and track shift durations and station notes."),
      h("Equipment sign-out (/app/assets)"),
      p("Register tools, keys, radios or vehicles with unique asset tags. Sign items out to employees with condition notes and check them back in when returned."),
    ],
  },
  {
    slug: "credentials-and-licenses", cat: "Compliance and records", title: "Credentials and license tracking", summary: "Track employee licenses, certifications and upcoming expiry dates.",
    body: [
      p("Open Credentials (/app/credentials) to see every license and certification across your staff, sorted by expiration date."),
      ol(
        "Select Add credential.",
        "Pick the employee and enter the credential or license name (for example, Forklift Operator License or Food Handler Permit).",
        "Optionally add the license number, issuing authority, issue date and expiration date.",
        "Save. Any credential expiring within 30 days is highlighted with an expiry warning badge."
      ),
    ],
  },
  {
    slug: "templates-library", cat: "Training", title: "Templates library and corrective-action templates", summary: "Install ready-made courses, policies, checklists and infraction wording in one click.",
    body: [
      p("Open Templates Library (/app/templates) to jump-start your workspace with pre-built templates:"),
      ul(
        "Courses: Workplace safety, customer service, data privacy and onboarding fundamentals.",
        "Policies: Code of conduct, attendance, safety and confidentiality.",
        "Shift checklists: Opening, mid-shift, closing and vehicle inspection checklists.",
        "Corrective-action templates: Pre-filled severity, strike points, policy violated and summary wording that managers can pick from a dropdown when logging an infraction."
      ),
    ],
  },
  {
    slug: "system-status-and-maintenance", cat: "Support", title: "System status, monitoring and maintenance mode", summary: "Live health checks, JSON monitoring endpoints and scheduled maintenance locks.",
    body: [
      h("Live status page and health endpoints"),
      p("Visit status.onboardops.org to see live health and incident history for OnboardOps. External uptime monitors poll our JSON health endpoints on api.onboardops.org (GET or HEAD, returning HTTP 200 when healthy and HTTP 503 if degraded):"),
      ul(
        "https://api.onboardops.org/status (or /health): Master status summary across all services.",
        "https://api.onboardops.org/status/frontend (or https://www.onboardops.org/api/status/frontend): Next.js App Router frontend, SSR and maintenance state.",
        "https://api.onboardops.org/status/database: Live PostgreSQL SELECT 1 ping and latency.",
        "https://api.onboardops.org/status/auth: JWT session signing and verification probe.",
        "https://api.onboardops.org/status/api: Core API routes and server actions readiness.",
        "https://api.onboardops.org/status/email: Resend email transport status (all emails send from notifications@onboardops.org).",
        "https://api.onboardops.org/status/storage: Document and file storage connectivity.",
        "https://api.onboardops.org/status/domains: Custom domain and partner subdomain routing."
      ),
      h("Full-site maintenance mode"),
      p("During scheduled upgrades, the OnboardOps site owner can place the website into Maintenance Mode from the Staff Console (/admin). Visitors and customers see a maintenance lock screen with the reason and estimated return time (ETA), while site owners see an Owner-only control card on the maintenance screen to jump directly into the Admin Panel or preview the site."),
    ],
  },
  {
    slug: "staff-accounts-and-invites", cat: "People and roles", title: "Create staff accounts and send invites", summary: "Managers can give many employees a login at once.",
    body: [
      ul("Add employee has a Send a sign-in invite option, on by default.", "Open Staff Accounts to see who can sign in and who cannot. Select people and choose Send invites to send each an email with a one-time link to choose a password.", "People who already have an OnboardOps account are linked automatically and see your workplace in My workplaces.", "If email is not fully set up, the links are shown so you can copy and share them privately."),
      p("Employees never receive a password from you. Use Send new link on a row if someone loses access."),
    ],
  },
  {
    slug: "leave-retirement-and-resignation-requests", cat: "People and roles", title: "Leave, retirement and resignation requests", summary: "Employees ask in the portal. Managers decide, and records update automatically.",
    body: [
      h("Employees"),
      p("In My Portal choose New request. Pick Leave of absence (with a start date and an optional expected return), Retirement (last working day), or Resignation (last day), and add a short reason. You can withdraw a pending request. Please keep medical details out of the reason and share them with your manager directly."),
      h("Managers"),
      p("Open Staff Requests. Managers, Admins and Owners can approve or deny leave. Only Owners and Admins can accept a retirement or resignation. Denying needs a note. The employee is notified in the app and by email."),
      h("What happens next"),
      ul("Approved leave sets the employee to Leave of absence on the start date and back to Active after the return date.", "An accepted retirement or resignation records the separation. On the last day the employee is marked as separated and can no longer sign in.", "Everything is written to the audit log."),
    ],
  },
  {
    slug: "support-access-explained", cat: "Support", title: "When OnboardOps staff can see your workspace", summary: "Support access is read-only, time-limited, and always visible to you.",
    body: [
      p("OnboardOps staff cannot open your employee data by default. To help with a problem, a staff member must start support access with a written reason:"),
      ul("It is read-only. They can look but not change anything.", "They see what a Supervisor sees: no confidential manager notes, documents, or reviews.", "It lasts 1 to 4 hours, then ends on its own.", "You are emailed and notified, and it appears in your audit log with the reason and the person's name.", "Every staff action is recorded in our own append-only log."),
      p("If you ever see support access you did not expect, tell us through the contact form with the topic Security report."),
    ],
  },
  {
    slug: "sign-in-with-a-magic-link", cat: "Account and data", title: "Sign in with a magic link", summary: "Get a one-time sign-in link by email instead of typing a password.",
    body: [
      ol("On the sign-in page, choose Email me a sign-in link, enter your email, and send.", "Open the email and press Continue to sign in. The link works once and expires after 15 minutes.", "On the next screen, press Continue to finish signing in on this device."),
      p("The extra button press stops email scanners from using up your link before you do. Using a magic link also verifies your email address."),
      note("To keep accounts private, we show the same message whether or not an account exists for the email you enter. On a workplace's staff sign-in page, a link is only sent to people who belong to that workplace."),
    ],
  },
  {
    slug: "account-settings", cat: "Account and data", title: "Account settings", summary: "Change your picture, nickname, email addresses and password.",
    body: [
      p("Open Account settings from the sidebar (your picture or the Account link), from My workplaces, or at /account. These settings belong to you and follow you across every workplace."),
      h("Profile"),
      ul("Upload a profile picture. It is cropped to a square and shrunk in your browser. It is visible to you and to people you share a workplace with.", "Your full name is used on records and in the audit log. Your nickname is what teammates see in the app."),
      h("Email addresses"),
      ul("Add up to 5 addresses. We email a link to confirm each one.", "A confirmed address can be used to sign in, and employers can match your records with it.", "Make a confirmed address your primary, or remove any secondary address you no longer use."),
      h("Password and sessions"),
      ul("Change your password with your current one. This signs out your other devices.", "If you only use email links, you can set a password at any time, or never.", "Use Sign out of other devices if you think someone else has access."),
      note("To delete your account or ask what we hold, use Make a privacy request on the account page. Records your employer keeps about you belong to them."),
    ],
  },
  {
    slug: "troubleshooting", cat: "Support", title: "Troubleshooting", summary: "Fixes for the most common problems.",
    body: [
      { t: "table", head: ["Problem", "Try this"], rows: [["I get a permission error", "Your role may not allow that action. Check Roles and permissions, then ask an Owner or Admin."], ["Employee cannot see a course", "The course must be published and the employee enrolled. Check the dossier's Training tab."], ["Quiz retake is locked", "A cooldown applies after a fail. The time is shown on the result screen."], ["Webhook test fails", "The URL must be an https Discord or Slack webhook. Recreate it if the channel was deleted."], ["No emails arrive", "Check spam. Email also needs a configured sending domain."], ["Employee has no My Portal", "They need sign-in access granted from their dossier."], ["Forgot password", "Use Forgot password on the sign-in page. The link works once and expires in 1 hour."], ["Employee created an account but sees no workplace", "They must verify their email, and the employer must have added the same email address. Ask them to check spam for the verification link."], ["Custom domain says Waiting for DNS", "Check the records match exactly, then wait and choose Check status again. Changes can take up to a few hours."], ["CSV import skipped rows", "The result lists each skipped line and why. Fix those rows and import the file again."], ["Strike points look wrong", "Open the employee's Infractions tab to see each case's points."]] },
      p("If none of this helps, send us the page, what you expected and what happened through the Contact support form."),
    ],
  },
  {
    slug: "support-policy", cat: "Support", title: "Support policy", summary: "How to reach us and what to expect during the beta.",
    body: [
      p("Support is by the contact form. We read every message."),
      ul("Hours: Monday to Friday, 9 am to 5 pm Eastern Time, excluding U.S. holidays.", "Response target: within 2 business days. This is a goal during the beta, not a guarantee or service-level agreement.", "Security issues and anything involving someone's safety or legal rights are handled first. Mark the topic accordingly.", "We cannot give legal, HR or compliance advice."),
      h("What to include"),
      ul("Your workspace name and the email you sign in with.", "The page or action involved and what you expected.", "Screenshots without confidential information."),
      p("Never send passwords or full employee records in a message."),
    ],
  },
];

export const bySlug = (s: string) => articles.find((a) => a.slug === s);
