# OnboardOps Security and Access Handbook

Owner: Jordan Daniels. Applies to every staff member, contractor and tool with access to OnboardOps systems or customer data. Review every quarter.

## 1. Principles
1. **Least access.** Everyone and everything gets only what the job needs, for only as long as needed.
2. **Two factors everywhere.** Every account that can touch the product, hosting, database, email, DNS, domain, code or money uses two-factor sign-in. Prefer passkeys; use an authenticator app second; never SMS as the only factor.
3. **Secrets live in one place.** Never in chat, email, tickets, screenshots, code or documents.
4. **Assume mistakes happen.** Make them easy to see, easy to undo and cheap.
5. **If it looks wrong, say so.** Reporting a mistake is never a punishable act.

## 2. Accounts and sign-in
- Each person has their own named account everywhere. **No shared logins.**
- Use a password manager. Long, unique, generated passwords. One strong master passphrase, with two-factor on the manager itself.
- Passkeys on every service that offers them (Google, GitHub, Vercel, the staff console, the product).
- Keep recovery codes for each critical account in the password manager and a printed copy in a safe place.
- Staff use a work email on our domain for all vendor accounts, never a personal address.
- Lock your device when you step away. Use full-disk encryption and a screen lock under 5 minutes. Keep the operating system and browser updated.

## 3. Who has access to what

| System | Jordan | Alan | Notes |
|---|---|---|---|
| Staff console (admin) | Owner | Support level | Support level can help customers; only owner changes platform settings |
| Hosting (Vercel) | Owner | Viewer, deploy only with Jordan | Production environment variables are owner-only |
| Database (Neon) | Owner | No direct access | Staff reach data only through the staff console |
| Email (Zoho, Resend) | Admin | User | Admin changes DNS-related sending settings |
| DNS and domain | Owner | None | Changes need a second person to review |
| Code repository | Owner | Read | Changes go through review before deploy |
| Monitoring | Owner | Responder | Both receive alerts |
| Money and billing | Owner | View | Payment details are never emailed |

Review this table every quarter and whenever a role changes. Remove access the same day someone leaves.

## 4. Handling secrets
- Production keys exist only in the hosting provider's environment settings and the password manager.
- **Never paste a key into a chat, an AI tool, an issue, a screenshot or a document.** If it happened, treat it as leaked and rotate it (Incident Response Handbook 7.5).
- Rotate keys at least yearly, when someone with access leaves, and any time a leak is possible.
- Customers' own integration keys are stored encrypted. No staff member may read or copy them. The master key is owner-only and has its own rotation procedure.
- Local test environments use test keys and local data, never production credentials or a copy of production data.

## 5. Staff access to customer workspaces
- Look only with the customer's support access grant, or when fixing an incident the lead has authorised.
- Always write a real reason. Reasons are recorded and reviewed.
- Do not change customer data unless the customer asked or the incident lead ordered it, and say what you changed.
- Never sign in as a customer. Never ask for a customer's password.
- Never copy customer data to a laptop, personal cloud, chat tool or AI service.

## 6. Code and change safety
- Every production change is reviewed by a second person where possible; if you are alone, wait an hour, re-read it, and run the checks.
- Tests and the type-check must pass before a deploy. Database changes are applied deliberately and noted.
- Keep a way back: know the last good deployment and how to roll back before you ship.
- Do not deploy on Friday evening or just before travel unless it is a fix for an incident.
- Dependencies: update regularly; apply security updates promptly; remove packages we no longer use.

## 7. Devices, networks and travel
- Work on trusted, updated devices. No personal devices for admin work unless they meet section 2.
- Avoid public Wi-Fi for admin work; if you must, use a trusted VPN.
- If a device is lost or stolen: tell the incident lead at once, remotely sign out and wipe it, revoke sessions on every service and rotate any secret stored on it.

## 8. Phishing and social engineering
- Treat unexpected links, attachments and requests for urgency, money, passwords or codes as suspicious.
- Check the sender's real address and the real link target. Go to a service by typing its address, not by clicking.
- No one at OnboardOps will ask you for your password or code. Neither will any vendor.
- When someone asks us to change an account's email, reset two-factor, or transfer ownership, follow the strong verification in the Support Handbook, no matter how convincing or urgent they sound.
- Report suspected phishing to the other staff member immediately, even if you clicked.

## 9. Monitoring and logs
- The staff audit log records staff actions with a reason. Read it weekly.
- Alerts reach both of us. Unusual sign-ins, failed jobs, spikes in errors and email problems are checked the same day.
- Logs never contain passwords, secret keys or the content of customer documents.

## 10. Leaving and role changes
- On exit or role change: remove access the same day, rotate shared secrets, transfer ownership of accounts and documents, and collect or wipe devices.
- Keep a checklist of every system so none is forgotten.

## 11. Reporting a security concern
Message the other staff member straight away; do not post it in a public place. Include what you saw, when, and anything you did. For a customer-reported issue, follow the Support Handbook section 9. Good-faith reporters are thanked and never penalised.
