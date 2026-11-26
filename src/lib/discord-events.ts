/**
 * Posts short notices into the staff Discord server through channel webhooks.
 * Each channel's webhook address is a setting (DISCORD_WEBHOOK_SUPPORT and so on). If it is missing, nothing is sent.
 * Notices carry references and counts only: never customer names, emails or message text.
 */

export type DiscordChannel = "support" | "urgent" | "status" | "modlog" | "appeals" | "alerts" | "deploys";

const HOOK_RE = /^https:\/\/(?:discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/;

export type DiscordButton = { id: string; label: string; style?: "primary" | "secondary" | "success" | "danger" };
export type DiscordNotice = {
  title: string;
  description?: string;
  fields?: { name: string; value: string }[];
  url?: string;
  tone?: "info" | "good" | "warn" | "bad";
  /** Buttons the bot answers. The webhook must have been created by the bot for these to work. */
  buttons?: DiscordButton[];
  /** Ping the on-call role (set DISCORD_ONCALL_ROLE_ID). */
  pingOnCall?: boolean;
};

const COLORS = { info: 0x2563eb, good: 0x16a34a, warn: 0xea580c, bad: 0xdc2626 } as const;
const STYLE = { primary: 1, secondary: 2, success: 3, danger: 4 } as const;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Best effort: never throws and never waits more than a few seconds, so a Discord outage cannot slow down or break the site. */
export async function postDiscord(channel: DiscordChannel, n: DiscordNotice): Promise<void> {
  try {
    const url = process.env[`DISCORD_WEBHOOK_${channel.toUpperCase()}`]?.trim();
    if (!url || !HOOK_RE.test(url)) return;
    const roleId = n.pingOnCall ? process.env.DISCORD_ONCALL_ROLE_ID?.trim() : undefined;
    const pingRole = roleId && /^\d{15,25}$/.test(roleId) ? roleId : undefined;
    await fetch(`${url}?wait=false&with_components=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "OnboardOps",
        content: pingRole ? `<@&${pingRole}>` : undefined,
        allowed_mentions: pingRole ? { roles: [pingRole] } : { parse: [] },
        embeds: [{ title: clip(n.title, 200), description: n.description ? clip(n.description, 1000) : undefined, url: n.url, color: COLORS[n.tone ?? "info"], fields: n.fields?.slice(0, 6).map((f) => ({ name: clip(f.name, 100), value: clip(f.value, 300), inline: true })), timestamp: new Date().toISOString() }],
        components: n.buttons?.length ? [{ type: 1, components: n.buttons.slice(0, 5).map((b) => ({ type: 2, style: STYLE[b.style ?? "secondary"], label: clip(b.label, 80), custom_id: clip(b.id, 100) })) }] : undefined,
      }),
      redirect: "manual",
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    /* ignore */
  }
}

/** Copies a chat message into a ticket's Discord thread, so staff see the whole conversation there. Best effort: never blocks the chat. */
export async function mirrorToTicketThread(threadId: string, author: string, body: string): Promise<void> {
  try {
    const url = process.env.DISCORD_WEBHOOK_SUPPORT?.trim();
    if (!url || !HOOK_RE.test(url) || !/^\d{15,25}$/.test(threadId)) return;
    const text = body.length > 1700 ? `${body.slice(0, 1699)}…` : body;
    await fetch(`${url}?thread_id=${threadId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "OnboardOps tickets", content: `**${author.slice(0, 80)}:** ${text}`, allowed_mentions: { parse: [] } }),
      redirect: "manual",
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    /* ignore: the message is already saved on the ticket */
  }
}
