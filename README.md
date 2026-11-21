# OnboardOps

Staff records, infraction tracking, training/certification, shift checklists, handoff notes, and operational tools in one multi-tenant workspace platform. Built with **Next.js 14 (App Router)**, **Prisma**, **Neon Postgres**, **Resend**, and **Tailwind CSS**.

---

## Core Features

### 1. People, Roles & One-Click Access Management
- **Staff Directory (`/app/directory`):** Track employee status (`ONBOARDING`, `ACTIVE`, `LOA`, `SUSPENDED`, `TERMINATED`), readiness (`PENDING`, `CERTIFIED`, `RETRAINING_REQUIRED`), strike points, emergency contacts, documents, performance reviews, and immutable per-employee audit trails.
- **One-Click Role Assignment (`/app/access`, `/app/directory`, `/app/employee/[id]`):**
  - Assign or promote anyone to `EMPLOYEE`, `SUPERVISOR`, `MANAGER`, or `ADMIN` directly from the **Staff Accounts** table dropdown, the **Add Employee** drawer, the **Employee Dossier** Overview card, or when **Bulk Inviting** staff.
  - Selecting a role for an employee without a login automatically creates/links their account and sends an invite with that role in one click.
- **Custom Roles & Feature Toggles (`/app/settings`):** Create custom roles (e.g., *Safety Lead*) with granular permission checklists and toggle individual workspace modules on or off.

### 2. Training Academy & Compliance
- **Course Builder (`/app/training/builder`):** Multi-lesson Markdown courses with video embeds, minimum read timers, and server-graded multiple-choice quizzes with retake cooldowns.
- **Auto-Enrollment & Certificates (`/print/certificate/[id]`):** Assigning a job role automatically enrolls the employee in required courses. Passing issues a verifiable `CERT-#####` certificate and transitions onboarding staff to `ACTIVE` + `CERTIFIED`.
- **Compliance Matrix (`/app/training/compliance`) & Templates Library (`/app/templates`):** Real-time matrix across all staff and one-click installation of pre-built courses, policies, checklists, and corrective-action templates.

### 3. Discipline, Infractions & Policies
- **Infraction Ledger (`/app/infractions`):** Append-only case numbers (`CASE-####`), timeline events, evidence links, employee signature acknowledgments, and confidential manager notes (stripped on the server for non-managers via `serializeInfraction`).
- **Corrective-Action Template Picker:** Pre-fill severity, strike points, policy violated, and summary from saved templates when logging a case.
- **Automated Escalations:** Auto-assigns remedial training on written infractions or `2+` points, and auto-suspends/terminates at the workspace strike threshold.
- **Incident Reports (`/app/incidents`) & Policies (`/app/policies`):** Anyone can file near-misses or hazards from My Portal; managers review and convert them into cases. Publish versioned handbooks/policies and track employee signatures.

### 4. Shift Operations
- **Shift Checklists (`/app/checklists`):** Opening, mid-shift, and closing checklists by department with supervisor verification.
- **Shift Handoff Notes (`/app/handoff`):** Shared operational feed passed between shifts, filterable by department, alongside handoff notes attached to checklist submissions.
- **Shift Schedule (`/app/schedule`):** Schedule employee or open shifts by department with start/end times and shift labels.
- **Time Clock & Timesheets (`/app/timesheets`):** Clock staff in and out and track active shift durations.
- **Equipment Sign-Out (`/app/assets`):** Register tools, keys, radios, or vehicles by asset tag, sign them out to employees with condition notes, and check them back in.
- **Credentials & Licenses (`/app/credentials`):** Track external licenses and certifications across all staff with 30-day expiry warnings.

---

## Staff Console (`/admin`), Maintenance Mode & Custom Domains

### Permanent Site Owner & Staff Roles
- `jordanedanield13@gmail.com` is configured as a permanent 24/7 platform `OWNER` in `src/lib/platform-role.ts` (and protected from removal in `src/actions/admin.ts`). Additional bootstrap owners can be listed in `PLATFORM_OWNER_EMAILS`.
- Platform staff roles (`OWNER`, `SUPPORT`, `VIEWER`) can manage support requests, beta feedback, privacy exports/deletions, email delivery logs, workspace locks, and time-limited read-only support access grants.

### Full-Site Maintenance Mode
- Controlled from the top of the **Staff Console Dashboard (`/admin`)**:
  - Choose from **6 premade maintenance reasons** (*Scheduled Upgrade*, *Database Maintenance*, *Security Patch*, *New Feature Rollout*, *Emergency Hotfix*, *Infrastructure Migration*) or write a custom message and estimated return time (**ETA**).
  - Locks the **entire website** (homepage, marketing pages, registration, customer workspaces, and custom domains) with a full-screen maintenance lock screen.
  - **Owner Controls on the Lock Screen:** Site owners also see the live maintenance lock screen when visiting regular pages, complete with an **Owner-Only Control Card** containing **"Access Admin Panel"** (`/admin`) and **"Preview Site"** buttons.

### Custom Domains & Partner-Only `*.onboardops.org` Subdomains
- **Default Staff Portal:** Every workspace gets `/w/<workspace-slug>`.
- **Customer Custom Domains:** Workspace owners can connect external domains they own (e.g., `hr.yourcompany.com`) in **Settings → Sign-in & domain**.
- **Partner-Only `*.onboardops.org` Subdomains:** Subdomains such as `retailnexus.onboardops.org` are reserved exclusively for partners and do **not** auto-default. The Site Owner can manually assign and immediately verify a `*.onboardops.org` subdomain (or any custom domain) for a workspace from **`/admin/workspaces/<id>` → Connect custom domain…**.
- **Resilient Custom-Domain Sign-In:** If an invited employee signs in on their workplace's custom domain for the first time before receiving an invite email, their password (8+ characters) is set and their membership is linked automatically.

---

## Forced `notifications@onboardops.org` Email Sender

All outgoing emails via Resend (`src/lib/email.ts`) force `notifications@onboardops.org` as the sender address (ignoring `process.env.EMAIL_FROM` so misconfigured environment variables never cause Resend `Invalid 'from' field` errors):
- **Workspace emails** (invites, training assignments, infractions, magic links):
  `"<Workspace Name> via OnboardOps <notifications@onboardops.org>"`
- **System emails** (account verification, password resets, staff console notifications):
  `"OnboardOps <notifications@onboardops.org>"`

---

## BetterStack Status & Health Endpoints

All status endpoints support `GET` and `HEAD`, return `HTTP 200` when healthy (`HTTP 503` when down), set `Cache-Control: no-store`, and return structured JSON with latency metrics:

| Service | Endpoint | Description |
| :--- | :--- | :--- |
| **Master Status** | `/api/status` (or `/api/health`) | Aggregated health, uptime, maintenance state, and all subsystem checks |
| **Frontend & SSR** | `/api/status/frontend` | Next.js App Router, SSR, and active maintenance state |
| **Database** | `/api/status/database` | Live PostgreSQL `SELECT 1` ping and latency (`latencyMs`) |
| **Auth & JWT** | `/api/status/auth` | Session JWT signing and verification probe |
| **Core API** | `/api/status/api` | API routes and server actions readiness |
| **Email Transport** | `/api/status/email` | Resend configuration and email subsystem health |
| **File Storage** | `/api/status/storage` | Document storage database connectivity |
| **Custom Domains** | `/api/status/domains` | Custom domain and partner subdomain routing status |
| **Visual Status Page** | `/status` | Public system status page with live latency and endpoint links |

---

## Run Locally

```powershell
npm install
copy .env.example .env      # fill in DATABASE_URL, DIRECT_URL, SESSION_SECRET, APP_URL
npx prisma db push
npx prisma db seed
npm run dev
```

### Environment Variables (`.env`)
- `DATABASE_URL`: Neon **pooled** Postgres connection string.
- `DIRECT_URL`: Neon **direct** Postgres connection string (used by `prisma db push`).
- `SESSION_SECRET`: 32+ random characters for JWT session signing.
- `APP_URL`: Public base URL (e.g., `https://onboardops.org` in production, `http://localhost:3000` locally).
- `RESEND_API_KEY`: Resend API key for sending emails from `notifications@onboardops.org`.
- `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` *(optional)*: For automated Vercel custom domain attachment.
