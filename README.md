# OnboardOps

Staff records, infraction tracking and training/certification in one multi-tenant app. Next.js 14 (App Router), Prisma, Neon Postgres, Resend. Free plan only for now; the desktop (Electron) app is not included yet.

## Run locally

```powershell
npm install
copy .env.example .env      # fill in the values below
npx prisma db push
npx prisma db seed
npm run dev
```

`.env` needs:

- `DATABASE_URL`: Neon **pooled** connection string. `DIRECT_URL`: Neon **direct** connection string (used by `db push`).
- `SESSION_SECRET`: 32+ random characters.
- `APP_URL`: public base URL (used in emails).
- `RESEND_API_KEY` and `EMAIL_FROM`: optional. Without a key, emails are skipped. Use a sending domain verified in Resend.

## Demo data

`npx prisma db seed` creates **Northside Supply & Logistics** (8 employees, 3 departments, 3 courses, 2 infraction cases, checklists, audit log). Password for every demo login is `OnboardOps!2026`:

| Role | Email |
| --- | --- |
| Owner | dana@northside.example |
| Admin | helen@northside.example |
| Manager | marcus@northside.example |
| Supervisor | priya@northside.example |
| Employee | tomas@northside.example |

## Deploy to Vercel

1. Create a Neon project (Vercel's Neon integration works) and copy the pooled and direct strings.
2. Add `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `APP_URL`, and the Resend variables in Vercel project settings.
3. Run `npx prisma db push` once against Neon from your machine, then deploy. The build script runs `prisma generate`.

## How it is put together

- `src/lib/rbac.ts`: `requireWorkspaceRole` (actions and routes) and `requirePageRole` (pages). `serializeInfraction` is the single place confidential notes are removed for non-manager roles.
- `src/lib/automations.ts`: the three transactional state machines (role-based enrollment, quiz certification, infraction escalation). Webhooks and email run **after** commit and never roll back data; failures are recorded in the audit log.
- `src/lib/audit.ts`: append-only audit log; each entry's SHA-256 hash chains over the previous one. No action or route edits or deletes cases, timeline events or audit entries.
- `src/actions/*`: server actions, each starting with a role check and zod validation.

## Not included yet

- Desktop app (Electron) and paid plans (Pro/Scale) were deferred.
- Two-factor authentication, single sign-on and a public API.
- Files are stored in the database (4 MB limit). Move to object storage such as Vercel Blob if you need larger files.

## Domain: onboardops.org

Local development keeps using `http://localhost:3000` (`APP_URL` in your local `.env`). For production:

1. In Vercel, open the project, Settings, Domains, and add `onboardops.org` (and `www.onboardops.org` set to redirect to it). Add the DNS records Vercel shows at your registrar.
2. Set `APP_URL=https://onboardops.org` in Vercel environment variables. Emailed links (password reset, invites) and the sitemap use it.
3. In Resend, add and verify `onboardops.org` (SPF and DKIM records), then set `EMAIL_FROM="OnboardOps <notifications@onboardops.org>"`.
4. Create the mailbox you want on the Contact page, then set `NEXT_PUBLIC_CONTACT_EMAIL`, and optionally `SUPPORT_INBOX` to receive support form messages.
5. Set `CRON_SECRET` so the daily reminders job (`vercel.json`) is authorized.

## Scripts

- `node scripts/local-db.mjs`: embedded Postgres for local development (port 5433).
- `node scripts/screenshots.mjs`: re-captures the marketing screenshots from the running app.
- `node scripts/e2e-smoke.mjs`: end-to-end smoke test against a running, seeded local app.

## Staff console, custom domains and testing

- **Staff console** at `/admin`. Set `PLATFORM_OWNER_EMAILS` to your email to bootstrap an owner, then add teammates under Staff & roles. The local demo has `staff@onboardops.org` (owner) and `support@onboardops.org`, same demo password.
- **Custom domains.** Set `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID` (and `VERCEL_TEAM_ID` for a team project) so owners can connect domains from Settings, Sign-in & domain. Without them the panel still shows the DNS records and checks DNS, but the domain must be added to the Vercel project by hand. To test locally, visit `http://<workspace-slug>.localhost:3000` (for example `northside-supply-logistics.localhost:3000`).
- **Email.** `EMAIL_REDIRECT_TO` sends every outgoing email to one address for testing. Remove it in production. `npx tsx --env-file=.env scripts/test-emails.ts` sends one of every template. Email icons are regenerated with `node scripts/build-email-assets.mjs`.
