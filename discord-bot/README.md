# OnboardOps staff bot

A Discord bot for the OnboardOps staff server. It sets the server up, links staff to their website accounts, and runs staff commands.

## Commands

| Who | Command | What it does |
|---|---|---|
| Everyone | `/ping`, `/help` | Check the bot is alive, list commands |
| Staff | `/link`, `/unlink`, `/me` | Link your Discord account to your staff account on the website |
| Staff | `/status` | Live health: database, incidents, maintenance, open tickets, failed emails |
| Staff | `/standup` | Start today's standup thread |
| Staff | `/loa start` / `end` | Mark yourself on leave, or back |
| Staff | `/userinfo` | A member's roles and join date |
| Admins | `/setup` | Create the roles, categories and channels. Use `dry_run` first. Safe to run again. |
| Admins | `/permcheck` | Check the bot's own permissions |
| Admins | `/backup-config` | Export roles and channels so the server can be rebuilt |
| Admins | `/webhooks` | Create the webhooks the website uses to post notices here |
| Admins | `/announce` | Post in #announcements |
| Admins | `/oncall set` / `clear` | Set who is on call |
| Admins | `/purge`, `/slowmode` | Clean up or slow down a channel |
| Staff | `/ticket`, `/mytickets`, `/saved` | Look up a ticket, your open tickets, the saved replies |
| Staff | `/reply` | Reply to a ticket by email (pick a saved reply to start from) |
| Staff | `/solve` | Mark a ticket solved |
| Staff | `/lookup`, `/warn` | An account's moderation record, or a warning (private form) |
| Admins | `/ban`, `/unban`, `/suspend`, `/reinstate` | Account bans and workspace suspensions (private form, with confirmation) |
| Admins | `/maintenance` | Turn website maintenance mode on or off (confirmation) |

"Admins" means the server owner, anyone with Administrator, and the Owner or Admin roles. Every command is logged to `#bot-log`, rate limited, and anything destructive asks for confirmation.

The bot uses only the **Guilds** intent. It never reads messages and never sees the member list.

## Buttons and notices from the website

New support tickets appear in #support-tickets (security reports in #support-urgent and ping the on-call role) with **Claim** and **Mark solved** buttons. New appeals appear in #appeals with **Overturn** and **Uphold** buttons that open a form asking why. When there are two or more owners, a ban started here waits in #mod-log for a **different** owner to press **Approve ban** (it expires after 24 hours). With one owner it happens straight away. Incidents, maintenance, monitor alerts and every moderation action are posted automatically.

Every button and form runs as the person who pressed it, and the website checks that person's own staff role. Customer emails are typed into private forms, never into a channel.

## Scheduled jobs (UTC)

- Every 5 minutes: alerts in #alerts if the website can't be reached, the database is down, emails are failing, or sign-ups spike. A recovery message follows.
- Every 30 minutes: a reminder in #support-tickets for tickets open longer than `STALE_TICKET_HOURS`.
- Daily at `SUMMARY_HOUR_UTC`: a support summary. Mondays: a weekly digest in #uptime-reports.
- Weekdays at `STANDUP_HOUR_UTC`: a standup thread in #standup.

## 1. Create the bot in Discord

1. Open the Discord Developer Portal and create a **New Application**.
2. Under **Bot**, create the bot and copy the token. You see it once.
3. Leave all three Privileged Gateway Intents **off**.
4. Under **OAuth2 > URL Generator**, choose scopes `bot` and `applications.commands`, and the **Administrator** permission.
5. Open the generated link and add the bot to your staff server.

Administrator means a leaked token could do anything in the server, so keep the token private. Reset it in the Developer Portal if it is ever exposed. (The bot only needs Manage Roles, Manage Channels, Manage Webhooks, Manage Messages and the basic message permissions, if you ever want to cut it down. `/permcheck` shows what it has.)

## 2. Settings

Set these in the host's environment settings (see `.env.example`):

| Name | Where to find it |
|---|---|
| `DISCORD_TOKEN` | Developer Portal, Bot, token |
| `DISCORD_CLIENT_ID` | Developer Portal, General Information, Application ID |
| `DISCORD_GUILD_ID` | Discord, turn on Developer Mode, right-click the server, Copy Server ID |
| `STAFF_BOT_KEY` | A long random secret you make. Use the **same value** on the website (Vercel) |
| `SITE_URL` | Optional. Defaults to `https://www.onboardops.org` |

Never paste these into a chat or commit them.

## 3. Run it

```
npm install
npm start
```

On the host, upload the contents of this `discord-bot` folder (not `node_modules`), set the start command to `npm start`, and add the settings above. Check the host's current limits for memory, storage and uptime before relying on it.

## 4. First use

1. Run `/setup` with `dry_run: true`, read the list, then run it for real and press **Confirm**.
2. Give people their staff roles.
3. Run `/permcheck`.
4. Run `/webhooks`. It shows `DISCORD_WEBHOOK_...` lines **only to you**. Add them to the website's environment settings in Vercel and redeploy. Then new support tickets, appeals and moderation actions post into the right channels, with references only and never customer details.
5. Each staff member runs `/link`, then enters the code at **Admin > Link Discord** on the website while signed in. Linked staff can use `/status`, and later commands that act on the website run with their own staff role.

## Changing the layout

Edit `src/layout.ts` (roles, channels, who can see and write), then run `/setup` again.
