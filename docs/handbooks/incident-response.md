# OnboardOps Incident Response Handbook

Owner: Jordan Daniels (founder). Deputy: Alan (COO, Support lead). Review this handbook every quarter and after every Severity 1 or 2 incident.

## 1. Purpose and scope

An incident is anything that harms, or could harm, the availability, integrity or confidentiality of OnboardOps or our customers' data. This handbook covers outages, data problems, security events, email problems and failures at the companies we depend on. It tells the two of us who does what, in what order, and what we say to customers.

Principles:
1. **Protect people and data first**, restore service second, find the cause third.
2. **One person leads.** The other supports. Never two people changing the same system at once.
3. **Tell customers early and plainly.** Silence costs more trust than bad news.
4. **Write it down as it happens.** Memory is unreliable at 3 a.m.
5. **Blameless reviews.** We fix systems, not people.

## 2. Roles

We are a two-person staff, so each role has a named person and a backup.

| Role | Does | Default | Backup |
|---|---|---|---|
| Incident lead | Decides, assigns, keeps the clock | Jordan | Alan |
| Technical responder | Investigates and fixes | Jordan | Alan (with Jordan's guidance, or vendor support) |
| Communications lead | Customer updates, status messages, inbox | Alan | Jordan |
| Scribe | Keeps the timeline | Whoever is not leading | Either |

If one of us is unreachable, the other holds all four roles and uses the vendor support channels in section 11. The person who spots the problem first starts the response and tells the other immediately. Do not wait to be sure.

## 3. Severity levels

| Level | Meaning | Examples | First response | Customer update |
|---|---|---|---|---|
| **SEV 1** Critical | Whole service down, or confirmed exposure of customer data, or active attacker | Site and sign-in down; database unreachable; leaked credentials in use; data shown to the wrong workspace | Immediately, any hour | Within 30 minutes, then every 30 to 60 minutes |
| **SEV 2** Major | A major feature is broken or many customers are affected | Email not sending; training or checklists failing for everyone; sign-in failing for some | Within 30 minutes (waking hours), within 2 hours overnight | Within 1 hour, then every 2 hours |
| **SEV 3** Minor | Limited impact, workaround exists | One customer's workspace error; a slow page; a cosmetic bug in a key screen | Same business day | Reply to affected customers |
| **SEV 4** Low | No customer impact | Internal tooling, a test failing | Next working day | None |

When in doubt, rate it one level higher. You can downgrade later.

## 4. Detection

Sources, in the order we usually learn of problems:
- **Uptime and alert monitoring** (Better Stack, using the `/health/alerts` endpoint on the API host). Alerts go to both of us.
- **Customer reports** (support inbox, contact form, direct email).
- **Staff console** (the admin area): failed jobs, audit entries, ban and moderation activity, maintenance state.
- **Vendor notices** (hosting, database, email provider, domain registrar, DNS).
- **Our own use of the product.**

Every alert is checked. A false alarm gets a one-line note in the log so we can tune the monitor.

## 5. The first 15 minutes (all incidents)

1. **Acknowledge.** Reply to the alert so the other person knows someone has it. Say "I have it" in your team chat or by phone.
2. **Open the log.** Create a new entry from the template in section 12. Write the time, who found it, and what you see. Keep adding to it.
3. **Rate it.** Pick a severity from section 3.
4. **Assign roles.** Lead, technical, comms, scribe.
5. **Contain before you cure.** If data may be exposed or an attacker is active, stop the harm first: see the playbooks. For a plain outage, go to diagnosis.
6. **Post a first holding message** if it is SEV 1 or 2 (template in section 8). "We know, we are working on it, next update at HH:MM."
7. **Set the next check time** and keep to it.

## 6. Diagnosis checklist

Work from the outside in:
1. Is it only us? Check the vendors' status pages: hosting (Vercel), database (Neon), email (Resend and Zoho), domain and DNS, Cloudflare if in front, Groq for AI features.
2. What changed recently? Last deploy, last schema change, last environment variable change, last DNS or domain change, last key rotation. **Most incidents follow a change.**
3. Check the deploy logs and runtime logs for errors.
4. Check database health: connections, storage, and a simple query.
5. Check third-party credentials: expired or revoked keys and tokens are common causes.
6. Reproduce with a test account if the problem is account-specific.

If a recent deploy is the likely cause, **roll back first**, investigate after.

## 7. Playbooks

### 7.1 Site or sign-in is down (SEV 1)
1. Check the hosting provider status and the last deployment. If the last deploy is suspect, promote the previous good deployment (instant rollback).
2. If the error is from the database, go to 7.2.
3. If it is DNS or certificates, check the domain records and certificate status; confirm nobody changed a record recently.
4. If it will take more than 15 minutes, turn on maintenance mode in the staff console so customers see a clear message instead of errors.
5. When restored, verify: home page, sign-in, a workspace dashboard, creating a record, sending a test email.
6. Post the resolution message and schedule the review.

### 7.2 Database problem (SEV 1 or 2)
1. Check the database provider's status and dashboard (connections, storage, compute).
2. Too many connections: restart the serving instances or scale the pool; check for a runaway query or a loop.
3. Data looks wrong or missing: **stop writes** (maintenance mode), do not "fix" rows by hand yet. Use point-in-time restore on a separate branch to compare. Restore only after the lead agrees, and record exactly what window of data would be lost.
4. Never run schema changes during an incident unless they are the fix.

### 7.3 Email is not arriving (SEV 2)
Symptoms: invites, password resets, notifications or outreach bouncing, delayed or going to spam.
1. Check the email provider status and our sending logs (email log in the staff console).
2. Check authentication records for the sending domain: **SPF, DKIM and DMARC must pass.** Gmail rejects or rate-limits mail that fails SPF or DKIM (error 4.7.26).
3. Confirm the right sending service is in the SPF record and the DKIM key is published and valid.
4. If we are listed or throttled, stop bulk sending (including outreach), send only essential mail, and request a review.
5. Tell affected customers how to proceed (for example, use the sign-in link on the site instead of waiting for an email).
Outreach email uses a separate sending path from the product's own mail. Do not let outreach problems damage product mail.

### 7.4 Suspected security breach or data exposure (SEV 1)
**Contain, preserve, assess, notify.**
1. **Contain.** Revoke sessions of affected accounts; rotate any credential that may be exposed (see 7.5); disable the affected feature or enable maintenance mode; suspend the workspace if a customer account is the source.
2. **Preserve evidence.** Do not delete logs. Export the audit log and platform logs for the period. Note times in UTC.
3. **Assess.** What data, whose, how many people, how long, is it still happening, what is the way in?
4. **Fix the way in** before declaring it over.
5. **Notify.** Breach notification duties differ by place and by data type (for example US state laws, GDPR, and our contracts with customers). **Contact a lawyer promptly** to confirm who must be told and by when; do not guess. Some deadlines are as short as 72 hours.
6. Tell affected customers factually: what happened, what data, what we did, what they should do. No speculation, no blame, no minimising.
7. Write the full review and keep it for the record.

### 7.5 Leaked or lost key, secret or token (SEV 1 or 2)
Examples: API key pasted in chat or committed to a repository, laptop lost, vendor reports a leak.
1. **Rotate first, investigate second.** Issue a new key at the provider, update it in the hosting environment, redeploy, then revoke the old one.
2. Cover: database URL, session secret (rotating signs everyone out), master encryption key (follow the key-rotation script and procedure; do not improvise), email provider keys, AI provider keys, OAuth client secrets, the staff bot key, monitoring tokens.
3. Check the provider's logs for use of the old key by someone else.
4. If customers' own integration keys are stored encrypted, confirm the master key was not part of the leak. If it was, treat as 7.4.
5. Remove the secret from history and any shared place.

### 7.6 Account takeover or suspicious sign-ins (SEV 2 or 3)
1. Sign the person out everywhere (revoke sessions), force a password reset, and ask them to set up two-factor or a passkey.
2. Check the audit log for what the intruder did, and reverse it with the customer's agreement.
3. If many accounts are hit (credential stuffing), tighten rate limits and consider temporarily requiring two-factor.
4. Never reset two-factor for someone without verifying them through a second channel (section 4 of the Support Handbook).

### 7.7 Third-party outage (SEV 2 or 3)
1. Confirm on the vendor's status page and note the vendor ticket.
2. Switch on any fallback we have; otherwise post a customer message that names the affected feature and that the cause is outside our control, without blaming the vendor by name unless they have publicly said so.
3. Check for data that needs reprocessing afterwards (failed emails, failed AI jobs).

### 7.8 Abuse, harmful content or a malicious workspace (SEV 3, SEV 2 if urgent)
1. Use the moderation tools to suspend the workspace or ban the account; log the reason.
2. Preserve evidence. Report to law enforcement if there is a threat to someone's safety or illegal content; get advice before sharing customer data.
3. Use the appeals process for later review.

### 7.9 Support access mistakes
If staff access to a customer workspace was used wrongly or a grant was misused, treat it as a possible exposure: record exactly what was seen, tell the customer, and follow 7.4.

## 8. Communication

Rules: be early, specific, honest, plain. Say what is affected, what we know, what we are doing, and when the next update comes. Never promise a time we cannot keep; promise the next update instead.

**Channels:** status page or maintenance banner, email to affected owners, reply to support tickets, and the website notice.

**First message (holding):**
> We are aware that [what is affected] is not working. We are investigating and will update you by [time]. You do not need to do anything.

**Update:**
> Update [time]: [what we found]. [What we are doing]. Next update by [time].

**Resolution:**
> [What was affected] is working again as of [time]. Cause: [one plain sentence]. [Any action customers should take]. We are sorry for the disruption. A full explanation will follow within [X] working days.

**Security notice:** use only facts we have confirmed, tell people what to do (change password, check recent activity), and have the lawyer read it first when personal data is involved.

Do not share internal detail, blame individuals or vendors, or post on social media before customers have been told directly.

## 9. Recovery and closure

An incident is over when: service is restored and verified, monitoring is green for 30 minutes, customers have the resolution message, the cause is understood well enough to prevent a repeat, and the log is complete. Switch maintenance mode off and tell the other person the incident is closed.

## 10. Post-incident review

Within 3 working days for SEV 1 and 2 (within a week for SEV 3). Blameless. Cover:
1. Summary and impact (who, how long, how many).
2. Timeline from the log.
3. Root cause and contributing causes (ask "why" five times).
4. What went well, what went badly, where we were lucky.
5. Actions, each with an owner and a date.
6. Customer follow-up sent.
Store the review in the incident folder and check the actions off at the next quarterly review.

## 11. Contacts and vendors

Keep this table current and stored where we can reach it if email is down.

| Who or what | For | How |
|---|---|---|
| Jordan | Incident lead | (add phone or messaging handle) |
| Alan | Deputy, comms | (add messaging handle) |
| Hosting (Vercel) | Deploys, domains | Dashboard, support form |
| Database (Neon) | Data, restores | Dashboard, support |
| Email (Resend, Zoho) | Product and staff mail | Dashboards, support |
| DNS and domain registrar | Records, certificates | Dashboard |
| Monitoring (Better Stack) | Alerts, on-call | Dashboard |
| Lawyer | Breach duties, customer notices | (add name and number) |
| Insurer | Cyber cover claim | (add policy and number) |

## 12. Incident log template

```
INCIDENT: [short name]            ID: INC-YYYYMMDD-N
Severity: [1-4]     Status: [Investigating / Fixing / Monitoring / Closed]
Lead: [ ]  Technical: [ ]  Comms: [ ]  Scribe: [ ]
Detected: [UTC time] by [who/what]
Impact: [who and what is affected]

TIMELINE (UTC)
HH:MM  what happened / what we did / who
HH:MM  ...

CUSTOMER COMMS SENT
HH:MM  channel, who, message link

DECISIONS
HH:MM  decision, who made it, why

RESOLUTION: [time, what fixed it]
ROOT CAUSE: [after review]
ACTIONS: [owner, due date]
```

## 13. Drills and upkeep

- **Each quarter:** run a 30-minute tabletop (pick a playbook, walk through it aloud) and fix gaps in this handbook.
- **Twice a year:** test restoring the database to a branch and test rolling back a deployment.
- **Each quarter:** check alert routing reaches both phones, review who has access to what, and confirm every vendor login still works.
- **After any change in staff or vendors:** update section 2 and section 11.
- Keep recovery codes and backup codes for the main accounts in the password manager, not only in email.
