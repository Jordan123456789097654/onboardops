import { ChannelType, EmbedBuilder, type Client, type Guild, type TextChannel } from "discord.js";
import { api } from "./api";

/**
 * Jobs the bot runs on a timer: health alerts, stale-ticket reminders, a daily support summary, a weekly digest and a daily standup thread.
 * Times are in UTC. State is kept in memory, so after a restart an hour that already passed today is treated as done rather than posted twice.
 */

const num = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};
const STALE_HOURS = num("STALE_TICKET_HOURS", 24);
const SUMMARY_HOUR = num("SUMMARY_HOUR_UTC", 13); // 9 am Eastern in winter, 8 am in summer
const STANDUP_HOUR = num("STANDUP_HOUR_UTC", 14);
const SPIKE_SIGNUPS = num("SIGNUP_SPIKE_PER_HOUR", 30);

type Signals = {
  database: boolean;
  failedEmailsLastHour: number;
  newAccountsLastHour: number;
  openTickets: number;
  solvedLast24h: number;
  newLast24h: number;
  stale: { ref: string; ageHours: number; priority: string; assignee: string | null; url: string }[];
};
type Digest = { days: number; newAccounts: number; newWorkspaces: number; ticketsOpened: number; ticketsSolved: number; newSubscribers: number; newsletterIssues: number };

const channel = (g: Guild, name: string) => g.channels.cache.find((c): c is TextChannel => c.type === ChannelType.GuildText && c.name === name);
const post = (g: Guild, name: string, embed: EmbedBuilder) => channel(g, name)?.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => undefined);

const today = () => new Date().toISOString().slice(0, 10);
const alreadyPast = (hour: number) => new Date().getUTCHours() >= hour;

export function startScheduler(client: Client, guildId: string): void {
  const guild = () => client.guilds.cache.get(guildId);
  const active = new Set<string>(); // alerts currently raised, so each is posted once and its recovery once
  const staleSeen = new Map<string, number>();
  let lastSummary = alreadyPast(SUMMARY_HOUR) ? today() : "";
  let lastDigest = alreadyPast(SUMMARY_HOUR) ? today() : "";
  let lastStandup = alreadyPast(STANDUP_HOUR) ? today() : "";

  const raise = (g: Guild, key: string, bad: boolean, title: string, detail: string) => {
    if (bad && !active.has(key)) { active.add(key); void post(g, "alerts", new EmbedBuilder().setColor(0xdc2626).setTitle(title).setDescription(detail).setTimestamp(new Date())); }
    if (!bad && active.has(key)) { active.delete(key); void post(g, "alerts", new EmbedBuilder().setColor(0x16a34a).setTitle(`Recovered: ${title}`).setTimestamp(new Date())); }
  };

  /** Every 5 minutes: health, failed emails, sign-up spikes. */
  async function health() {
    const g = guild();
    if (!g) return;
    const r = await api<Signals>(`ops/signals?staleHours=${STALE_HOURS}`, "");
    if (r.status === 0 || r.status >= 500) { raise(g, "site", true, "The website did not answer the bot", "The bot could not reach OnboardOps, or it returned an error."); return; }
    if (r.status !== 200 || !r.data) return;
    const s = r.data;
    raise(g, "site", false, "The website did not answer the bot", "");
    raise(g, "db", !s.database, "Database is unreachable", "The signals check could not reach the database.");
    raise(g, "email", s.failedEmailsLastHour >= 5, "Emails are failing", `${s.failedEmailsLastHour} emails failed in the last hour.`);
    raise(g, "signups", s.newAccountsLastHour >= SPIKE_SIGNUPS, "Unusual number of sign-ups", `${s.newAccountsLastHour} new accounts in the last hour.`);
  }

  /** Every 30 minutes: tickets that have waited too long. Each is mentioned at most every 12 hours. */
  async function stale() {
    const g = guild();
    if (!g) return;
    const r = await api<Signals>(`ops/signals?staleHours=${STALE_HOURS}`, "");
    if (r.status !== 200 || !r.data) return;
    let posted = 0;
    for (const t of r.data.stale) {
      if (posted >= 5) break;
      if (Date.now() - (staleSeen.get(t.ref) ?? 0) < 12 * 3600_000) continue;
      staleSeen.set(t.ref, Date.now());
      posted++;
      await post(g, "support-tickets", new EmbedBuilder().setColor(0xea580c).setTitle(`Ticket ${t.ref} is still open`).setURL(t.url).setDescription(`Open for ${t.ageHours} hours. Priority ${t.priority}. ${t.assignee ? `Assigned to ${t.assignee}.` : "Nobody has claimed it."}`));
    }
  }

  async function daily() {
    const g = guild();
    if (!g) return;
    const now = new Date();
    const hour = now.getUTCHours();
    if (hour === SUMMARY_HOUR && lastSummary !== today()) {
      lastSummary = today();
      const r = await api<Signals>(`ops/signals?staleHours=${STALE_HOURS}`, "");
      if (r.status === 200 && r.data) {
        const s = r.data;
        await post(g, "support-tickets", new EmbedBuilder().setColor(0x2563eb).setTitle("Support summary").addFields(
          { name: "Open now", value: String(s.openTickets), inline: true },
          { name: "New (24h)", value: String(s.newLast24h), inline: true },
          { name: "Solved (24h)", value: String(s.solvedLast24h), inline: true },
          { name: "Waiting over " + STALE_HOURS + "h", value: String(s.stale.length), inline: true },
        ).setTimestamp(now));
      }
    }
    if (hour === SUMMARY_HOUR && now.getUTCDay() === 1 && lastDigest !== today()) {
      lastDigest = today();
      const r = await api<Digest>("ops/digest?days=7", "");
      if (r.status === 200 && r.data) {
        const d = r.data;
        await post(g, "uptime-reports", new EmbedBuilder().setColor(0x2563eb).setTitle("Weekly digest").addFields(
          { name: "New accounts", value: String(d.newAccounts), inline: true },
          { name: "New workspaces", value: String(d.newWorkspaces), inline: true },
          { name: "Tickets opened", value: String(d.ticketsOpened), inline: true },
          { name: "Tickets solved", value: String(d.ticketsSolved), inline: true },
          { name: "New subscribers", value: String(d.newSubscribers), inline: true },
          { name: "Newsletter issues", value: String(d.newsletterIssues), inline: true },
        ).setFooter({ text: "Last 7 days" }).setTimestamp(now));
      }
    }
    const weekday = now.getUTCDay() >= 1 && now.getUTCDay() <= 5;
    if (hour === STANDUP_HOUR && weekday && lastStandup !== today()) {
      lastStandup = today();
      const ch = channel(g, "standup");
      const name = `Standup ${today()}`;
      if (ch && !ch.threads.cache.some((t) => t.name === name)) {
        const t = await ch.threads.create({ name, autoArchiveDuration: 1440, reason: "Daily standup" }).catch(() => null);
        await t?.send("**Standup.** Reply with: 1) what you finished, 2) what you are doing today, 3) anything blocking you.");
      }
    }
  }

  const safe = (name: string, fn: () => Promise<void>) => () => void fn().catch((e) => console.error(`${name} failed:`, e instanceof Error ? e.message : e));
  setInterval(safe("health", health), 5 * 60_000);
  setInterval(safe("stale", stale), 30 * 60_000);
  setInterval(safe("daily", daily), 60_000);
  console.log("Scheduler started.");
}
