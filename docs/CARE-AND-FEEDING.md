# OnboardOps care and feeding

Use this when the website is not being actively changed. Check it every three months.

## Things that expire or renew
| Item | Where | What to do |
|---|---|---|
| Domain onboardops.org | Spaceship | Renew before expiry. Keep DNSSEC on. Don't change nameservers without the DNS checklist below. |
| DNS / DNSSEC records | Spaceship | Export the zone monthly. Confirm the DS record matches the zone's signing key. |
| Resend (email) | Resend dashboard | Check sending domain verification and API key validity. |
| Groq AI keys | Vercel env `GROQ_API_KEYS` | Check quota and that the keys still work. |
| Neon database | Neon console | Check storage, compute and that backups/PITR are enabled. |
| Vercel | Vercel | Check the account owner, billing, and the custom domain status. |
| Better Stack | Better Stack | Check the monitors and that alerts reach a person. |

## Rotating secrets
1. Create the new secret in the provider.
2. Update it in Vercel (Production) and redeploy.
3. Revoke the old one. Never paste secrets in chat, tickets or repos.
Secrets that have been pasted anywhere should be rotated immediately.

## Restoring the database
1. Neon console: create a branch from a point before the problem (point-in-time restore).
2. Test the restored branch with `scripts/` read-only queries first.
3. Only then point production `DATABASE_URL` at it, or copy the needed rows back.
Practice this once a year so it works when it matters.

## DNS change checklist (the November 24 outage lesson)
1. Lower TTLs a day before the change.
2. If DNSSEC is on, update the DS record at the registrar FIRST, and only after it propagates change nameservers.
3. Test with several resolvers (Google 8.8.8.8, Cloudflare 1.1.1.1, Quad9 9.9.9.9) before and after.
4. Keep the old records until the new ones are confirmed.

## Alerts
- `/api/health/alerts` returns 503 when the database is down, email is failing, or the last job failed.
- Better Stack should poll it every minute and email/text the owner on failure.

## Who to call
- Owner: the workspace owner account (see Vercel team members)
- Provider support: Vercel, Neon, Resend, Spaceship, Better Stack.
