import {
  AttachmentBuilder,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  type TextChannel,
} from "discord.js";
import { api, apiProblem, siteUrl } from "./api";
import { LEAVE_ROLE, ONCALL_ROLE, STAFF_ROLES, WEBHOOK_CHANNELS } from "./layout";
import { exportConfig, permissionCheck, runSetup, type Report } from "./setup";
import { confirm } from "./util";
import { opsCommands } from "./ops-commands";

/** "any": everyone in the server. "staff": members with a staff role. "manage": the server owner, administrators, and the Owner or Admin roles. */
export type Access = "any" | "staff" | "manage";

export type Command = {
  json: RESTPostAPIChatInputApplicationCommandsJSONBody;
  access: Access;
  run: (i: ChatInputCommandInteraction) => Promise<void>;
};

const roleNamesOf = (i: ChatInputCommandInteraction): string[] =>
  i.member && "roles" in i.member && !Array.isArray(i.member.roles) ? [...i.member.roles.cache.values()].map((r) => r.name) : [];

/** True for the server owner, anyone with Administrator, or a member with the Owner or Admin role. */
export function canManage(i: ChatInputCommandInteraction): boolean {
  if (!i.guild) return false;
  if (i.guild.ownerId === i.user.id || i.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  const r = roleNamesOf(i);
  return r.includes("Owner") || r.includes("Admin");
}

export function isStaff(i: ChatInputCommandInteraction): boolean {
  return canManage(i) || roleNamesOf(i).some((n) => (STAFF_ROLES as readonly string[]).includes(n));
}

export function allowed(i: ChatInputCommandInteraction, a: Access): boolean {
  return a === "any" ? true : a === "staff" ? isStaff(i) : canManage(i);
}

const textChannel = (i: ChatInputCommandInteraction, name: string) =>
  i.guild!.channels.cache.find((c): c is TextChannel => c.type === ChannelType.GuildText && c.name === name);

const role = (i: ChatInputCommandInteraction, name: string) => i.guild!.roles.cache.find((r) => r.name === name);

function formatReport(r: Report, dry: boolean): string {
  const head = dry
    ? `**Dry run.** Nothing was changed. ${r.created} to create, ${r.existing} already exist.`
    : `**Setup finished.** ${r.created} created, ${r.repaired} permissions re-applied, ${r.existing} already existed.`;
  let body = "";
  let shown = 0;
  for (const line of r.lines) {
    if ((body + line + "\n").length > 1500) break;
    body += `${line}\n`;
    shown++;
  }
  const more = r.lines.length - shown;
  return `${head}\n\`\`\`\n${body}${more > 0 ? `…and ${more} more\n` : ""}\`\`\`\n\`+\` created  \`~\` permissions  \`=\` already there`;
}

/* ---------------- Server setup ---------------- */

const setup: Command = {
  json: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Create the staff roles, categories and channels (safe to run again)")
    .addBooleanOption((o) => o.setName("dry_run").setDescription("List what would change without changing anything"))
    .setDMPermission(false)
    .toJSON(),
  access: "manage",
  async run(i) {
    const dry = i.options.getBoolean("dry_run") ?? false;
    if (dry) {
      await i.deferReply({ ephemeral: true });
      await i.editReply(formatReport(await runSetup(i.guild!, true), true));
      return;
    }
    const ok = await confirm(i, "This creates any missing roles, categories and channels, re-applies channel permissions, and posts the rules and role picker. **Nothing is deleted.** Continue?");
    if (!ok) return;
    await i.editReply({ content: formatReport(await runSetup(i.guild!, false), false), components: [] });
  },
};

const permcheck: Command = {
  json: new SlashCommandBuilder().setName("permcheck").setDescription("Check the bot's own permissions").setDMPermission(false).toJSON(),
  access: "manage",
  async run(i) {
    await i.deferReply({ ephemeral: true });
    await i.editReply(`\`\`\`\n${(await permissionCheck(i.guild!)).join("\n")}\n\`\`\``);
  },
};

const backup: Command = {
  json: new SlashCommandBuilder().setName("backup-config").setDescription("Export the server's roles and channels so it can be rebuilt").setDMPermission(false).toJSON(),
  access: "manage",
  async run(i) {
    await i.deferReply({ ephemeral: true });
    const file = new AttachmentBuilder(Buffer.from(JSON.stringify(await exportConfig(i.guild!), null, 2)), { name: `server-config-${new Date().toISOString().slice(0, 10)}.json` });
    await i.editReply({ content: "Here is the export. It has roles and channels only: no members and no messages. Keep it somewhere private.", files: [file] });
  },
};

/** Creates (or finds) one webhook per notice channel and shows the settings to paste into the website's environment. Shown only to the person who ran it. */
const webhooks: Command = {
  json: new SlashCommandBuilder().setName("webhooks").setDescription("Create the webhooks the website uses to post notices here").setDMPermission(false).toJSON(),
  access: "manage",
  async run(i) {
    await i.deferReply({ ephemeral: true });
    const lines: string[] = [];
    for (const [key, channelName] of Object.entries(WEBHOOK_CHANNELS)) {
      const ch = textChannel(i, channelName);
      if (!ch) { lines.push(`# #${channelName} is missing. Run /setup first.`); continue; }
      const mine = (await ch.fetchWebhooks()).find((w) => w.owner?.id === i.client.user.id && w.name === "OnboardOps");
      const hook = mine ?? (await ch.createWebhook({ name: "OnboardOps", reason: "Website notices" }));
      lines.push(`DISCORD_WEBHOOK_${key}=${hook.url}`);
    }
    await i.editReply({ content: `Add these to the website's environment settings (Vercel), then redeploy. **They are secret: don't paste them in chat.** Anyone with a link can post in that channel.\n\`\`\`\n${lines.join("\n")}\n\`\`\`` });
  },
};

/* ---------------- Link to the website ---------------- */

const link: Command = {
  json: new SlashCommandBuilder().setName("link").setDescription("Link your Discord account to your staff account on the website").setDMPermission(false).toJSON(),
  access: "staff",
  async run(i) {
    await i.deferReply({ ephemeral: true });
    const r = await api<{ code: string; minutes: number }>("link/start", i.user.id, { method: "POST" });
    const problem = apiProblem(r.status);
    if (problem || !r.data) { await i.editReply(problem ?? "Could not get a code."); return; }
    await i.editReply(`Your code is **${r.data.code}**. Open ${siteUrl("/admin/discord")} while signed in to the staff console and enter it there. It works for ${r.data.minutes} minutes.`);
  },
};

const unlink: Command = {
  json: new SlashCommandBuilder().setName("unlink").setDescription("Remove the link to your staff account").setDMPermission(false).toJSON(),
  access: "staff",
  async run(i) {
    await i.deferReply({ ephemeral: true });
    const r = await api<{ removed: boolean }>("unlink", i.user.id, { method: "POST" });
    const problem = apiProblem(r.status);
    await i.editReply(problem ?? (r.data?.removed ? "Unlinked. The bot can no longer act for you on the website." : "You weren't linked."));
  },
};

const me: Command = {
  json: new SlashCommandBuilder().setName("me").setDescription("See which staff account you're linked to").setDMPermission(false).toJSON(),
  access: "staff",
  async run(i) {
    await i.deferReply({ ephemeral: true });
    const r = await api<{ linked: boolean; name?: string; role?: string }>("me", i.user.id);
    const problem = apiProblem(r.status);
    if (problem || !r.data) { await i.editReply(problem ?? "Could not check."); return; }
    await i.editReply(r.data.linked ? `You're linked as **${r.data.name}** with the **${r.data.role}** role on the website.` : "You aren't linked yet. Run `/link`.");
  },
};

const status: Command = {
  json: new SlashCommandBuilder().setName("status").setDescription("Live health of the website and the support queue").setDMPermission(false).toJSON(),
  access: "staff",
  async run(i) {
    await i.deferReply({ ephemeral: true });
    const r = await api<{ database: boolean; openTickets: number | null; openIncidents: number; maintenance: boolean; failedEmailsLastHour: number | null }>("status", i.user.id);
    const problem = apiProblem(r.status);
    if (problem || !r.data) { await i.editReply(problem ?? "Could not check."); return; }
    const d = r.data;
    const bad = !d.database || d.openIncidents > 0 || (d.failedEmailsLastHour ?? 0) >= 5;
    const embed = new EmbedBuilder()
      .setTitle("OnboardOps status")
      .setColor(bad ? 0xdc2626 : d.maintenance ? 0xea580c : 0x16a34a)
      .addFields(
        { name: "Database", value: d.database ? "OK" : "DOWN", inline: true },
        { name: "Open incidents", value: String(d.openIncidents), inline: true },
        { name: "Maintenance mode", value: d.maintenance ? "ON" : "off", inline: true },
        { name: "Open tickets", value: d.openTickets === null ? "unknown" : String(d.openTickets), inline: true },
        { name: "Failed emails (1 hour)", value: d.failedEmailsLastHour === null ? "unknown" : String(d.failedEmailsLastHour), inline: true },
      )
      .setTimestamp(new Date());
    await i.editReply({ embeds: [embed] });
  },
};

/* ---------------- Team ---------------- */

const announce: Command = {
  json: new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Post an announcement in #announcements")
    .addStringOption((o) => o.setName("message").setDescription("What to announce").setRequired(true).setMaxLength(1500))
    .setDMPermission(false)
    .toJSON(),
  access: "manage",
  async run(i) {
    const ch = textChannel(i, "announcements");
    if (!ch) { await i.reply({ content: "There's no #announcements channel. Run `/setup` first.", ephemeral: true }); return; }
    await ch.send({ embeds: [new EmbedBuilder().setTitle("Announcement").setDescription(i.options.getString("message", true)).setColor(0x2563eb).setFooter({ text: `Posted by ${i.user.username}` }).setTimestamp(new Date())], allowedMentions: { parse: [] } });
    await i.reply({ content: "Posted in #announcements.", ephemeral: true });
  },
};

const standup: Command = {
  json: new SlashCommandBuilder().setName("standup").setDescription("Start today's standup thread").setDMPermission(false).toJSON(),
  access: "staff",
  async run(i) {
    const ch = textChannel(i, "standup");
    if (!ch) { await i.reply({ content: "There's no #standup channel. Run `/setup` first.", ephemeral: true }); return; }
    const date = new Date().toISOString().slice(0, 10);
    const thread = await ch.threads.create({ name: `Standup ${date}`, autoArchiveDuration: 1440, reason: "Daily standup" });
    await thread.send("**Standup.** Reply with: 1) what you finished, 2) what you're doing today, 3) anything blocking you.");
    await i.reply({ content: `Started ${thread.toString()}.`, ephemeral: true });
  },
};

const oncall: Command = {
  json: new SlashCommandBuilder()
    .setName("oncall")
    .setDescription("Set who is on call")
    .addSubcommand((s) => s.setName("set").setDescription("Put someone on call").addUserOption((o) => o.setName("user").setDescription("Who").setRequired(true)))
    .addSubcommand((s) => s.setName("clear").setDescription("Take someone off call").addUserOption((o) => o.setName("user").setDescription("Who").setRequired(true)))
    .setDMPermission(false)
    .toJSON(),
  access: "manage",
  async run(i) {
    const r = role(i, ONCALL_ROLE);
    if (!r) { await i.reply({ content: "The On call role doesn't exist yet. Run `/setup` first.", ephemeral: true }); return; }
    const user = i.options.getUser("user", true);
    const member = (await i.guild!.members.fetch(user.id).catch(() => null)) as GuildMember | null;
    if (!member) { await i.reply({ content: "I couldn't find that person in this server.", ephemeral: true }); return; }
    const on = i.options.getSubcommand() === "set";
    if (on) await member.roles.add(r, "On call set"); else await member.roles.remove(r, "On call cleared");
    await textChannel(i, "oncall-and-loa")?.send({ content: `${on ? "On call now:" : "No longer on call:"} <@${user.id}>`, allowedMentions: { parse: [] } });
    await i.reply({ content: on ? `${user.username} is now on call.` : `${user.username} is no longer on call.`, ephemeral: true });
  },
};

const loa: Command = {
  json: new SlashCommandBuilder()
    .setName("loa")
    .setDescription("Mark yourself as on leave, or back")
    .addSubcommand((s) => s.setName("start").setDescription("Go on leave").addStringOption((o) => o.setName("until").setDescription("When you're back, for example 'Dec 3'").setMaxLength(60)).addStringOption((o) => o.setName("note").setDescription("A short note (keep it brief and non-personal)").setMaxLength(120)))
    .addSubcommand((s) => s.setName("end").setDescription("Come back from leave"))
    .setDMPermission(false)
    .toJSON(),
  access: "staff",
  async run(i) {
    const r = role(i, LEAVE_ROLE);
    if (!r) { await i.reply({ content: "The On leave role doesn't exist yet. Ask an admin to run `/setup`.", ephemeral: true }); return; }
    const member = i.member as GuildMember;
    const channel = textChannel(i, "oncall-and-loa");
    if (i.options.getSubcommand() === "start") {
      await member.roles.add(r, "Leave started");
      const until = i.options.getString("until");
      const note = i.options.getString("note");
      await channel?.send({ content: `<@${i.user.id}> is on leave${until ? ` until ${until}` : ""}.${note ? ` ${note}` : ""}`, allowedMentions: { parse: [] } });
      await i.reply({ content: "You're marked as on leave. If support will be affected, ask an owner to post the support banner.", ephemeral: true });
    } else {
      await member.roles.remove(r, "Leave ended");
      await channel?.send({ content: `<@${i.user.id}> is back.`, allowedMentions: { parse: [] } });
      await i.reply({ content: "Welcome back.", ephemeral: true });
    }
  },
};

/* ---------------- Moderation of the server ---------------- */

const purge: Command = {
  json: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete recent messages in this channel")
    .addIntegerOption((o) => o.setName("count").setDescription("How many (1 to 100)").setRequired(true).setMinValue(1).setMaxValue(100))
    .setDMPermission(false)
    .toJSON(),
  access: "manage",
  async run(i) {
    const ch = i.channel;
    if (!ch || ch.type !== ChannelType.GuildText) { await i.reply({ content: "Use this in a text channel.", ephemeral: true }); return; }
    const count = i.options.getInteger("count", true);
    const ok = await confirm(i, `Delete the last **${count}** messages in this channel? Messages older than 14 days can't be deleted. This can't be undone.`);
    if (!ok) return;
    const deleted = await ch.bulkDelete(count, true);
    await i.editReply({ content: `Deleted ${deleted.size} messages.`, components: [] });
  },
};

const slowmode: Command = {
  json: new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Set slowmode in this channel")
    .addIntegerOption((o) => o.setName("seconds").setDescription("0 turns it off, up to 21600").setRequired(true).setMinValue(0).setMaxValue(21600))
    .setDMPermission(false)
    .toJSON(),
  access: "manage",
  async run(i) {
    const ch = i.channel;
    if (!ch || ch.type !== ChannelType.GuildText) { await i.reply({ content: "Use this in a text channel.", ephemeral: true }); return; }
    const s = i.options.getInteger("seconds", true);
    await ch.setRateLimitPerUser(s, `Set by ${i.user.username}`);
    await i.reply({ content: s === 0 ? "Slowmode is off." : `Slowmode is ${s} seconds.`, ephemeral: true });
  },
};

const userinfo: Command = {
  json: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Show a member's roles and join date")
    .addUserOption((o) => o.setName("user").setDescription("Who").setRequired(true))
    .setDMPermission(false)
    .toJSON(),
  access: "staff",
  async run(i) {
    const user = i.options.getUser("user", true);
    const member = await i.guild!.members.fetch(user.id).catch(() => null);
    const roles = member ? [...member.roles.cache.values()].filter((r) => r.id !== i.guild!.id).map((r) => r.name) : [];
    await i.reply({
      ephemeral: true,
      embeds: [new EmbedBuilder().setTitle(user.username).setColor(0x2563eb).addFields(
        { name: "Account created", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:D>`, inline: true },
        { name: "Joined server", value: member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>` : "unknown", inline: true },
        { name: "Roles", value: roles.length ? roles.join(", ") : "none" },
      )],
    });
  },
};

/* ---------------- Utility ---------------- */

const ping: Command = {
  json: new SlashCommandBuilder().setName("ping").setDescription("Check that the bot is alive").setDMPermission(false).toJSON(),
  access: "any",
  async run(i) {
    await i.reply({ content: `Pong. ${Math.round(i.client.ws.ping)} ms to Discord.`, ephemeral: true });
  },
};

const help: Command = {
  json: new SlashCommandBuilder().setName("help").setDescription("What this bot can do").setDMPermission(false).toJSON(),
  access: "any",
  async run(i) {
    await i.reply({
      ephemeral: true,
      content: [
        "**OnboardOps staff bot**",
        "**Everyone:** `/ping`, `/help`",
        "**Staff:** `/link`, `/unlink`, `/me`, `/status`, `/standup`, `/loa start|end`, `/userinfo`",
        "**Support:** `/ticket`, `/mytickets`, `/reply` (with saved replies), `/saved`, `/solve`. Use the Claim and Mark solved buttons on new tickets.",
        "**Moderation:** `/lookup`, `/warn`, `/ban`, `/unban`, `/suspend`, `/reinstate`. These open a private form. The website checks your own staff role.",
        "**Operations:** `/maintenance on|off` (owners).",
        "**Admins:** `/setup` (try `dry_run`), `/permcheck`, `/backup-config`, `/webhooks`, `/announce`, `/oncall set|clear`, `/purge`, `/slowmode`",
        "Pick your alert roles in #roles.",
      ].join("\n"),
    });
  },
};

export const commands = new Map<string, Command>(
  [setup, permcheck, backup, webhooks, link, unlink, me, status, announce, standup, oncall, loa, purge, slowmode, userinfo, ping, help, ...opsCommands].map((c) => [c.json.name, c]),
);
