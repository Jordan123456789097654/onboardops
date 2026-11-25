import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits as P,
  type ButtonInteraction,
  type CategoryChannel,
  type Guild,
  type GuildMember,
  type MessageCreateOptions,
  type OverwriteResolvable,
  type Role,
  type TextChannel,
} from "discord.js";
import { CATEGORIES, PICKER_FOOTER, PICKER_TITLE, PING_ROLES, ROLE_SPECS, RULES, RULES_FOOTER, RULES_TITLE, STAFF_ROLES, type ChannelSpec } from "./layout";

export type Report = { lines: string[]; created: number; repaired: number; existing: number };

const REASON = "OnboardOps staff setup";

/** Who can see and who can write in one channel. The server's @everyone is always locked out. */
function overwritesFor(guild: Guild, spec: ChannelSpec, roles: Map<string, Role>, botId: string): OverwriteResolvable[] {
  const read = new Set<string>([...spec.read, "Owner", "Admin"]);
  const post = new Set<string>(spec.post === undefined ? spec.read : spec.post);
  const out: OverwriteResolvable[] = [
    { id: guild.roles.everyone.id, deny: [P.ViewChannel] },
    { id: botId, allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks, P.AttachFiles, P.ReadMessageHistory, P.ManageMessages] },
  ];
  for (const name of read) {
    const role = roles.get(name);
    if (!role) continue;
    const canPost = post.has(name);
    out.push({
      id: role.id,
      allow: canPost ? [P.ViewChannel, P.ReadMessageHistory, P.SendMessages, P.SendMessagesInThreads, P.AddReactions] : [P.ViewChannel, P.ReadMessageHistory, P.AddReactions],
      deny: canPost ? [] : [P.SendMessages, P.SendMessagesInThreads, P.CreatePublicThreads, P.CreatePrivateThreads],
    });
  }
  return out;
}

/**
 * Creates every role, category and channel in the layout that is missing, and re-applies channel permissions to the ones that exist.
 * It never deletes anything and never edits an existing role, so running it again is safe. With `dry`, it only reports.
 */
export async function runSetup(guild: Guild, dry: boolean): Promise<Report> {
  const lines: string[] = [];
  let created = 0;
  let repaired = 0;
  let existing = 0;
  await guild.roles.fetch();
  await guild.channels.fetch();
  const me = guild.members.me ?? (await guild.members.fetchMe());

  const roles = new Map<string, Role>();
  for (const spec of ROLE_SPECS) {
    let role = guild.roles.cache.find((r) => r.name === spec.name);
    if (role) {
      existing++;
      lines.push(`= role ${spec.name}`);
    } else {
      created++;
      lines.push(`+ role ${spec.name}`);
      if (!dry) role = await guild.roles.create({ name: spec.name, color: spec.color, hoist: spec.hoist, mentionable: spec.mentionable, permissions: spec.permissions, reason: REASON });
    }
    if (role) roles.set(spec.name, role);
  }

  for (const cat of CATEGORIES) {
    let category = guild.channels.cache.find((c): c is CategoryChannel => c.type === ChannelType.GuildCategory && c.name === cat.name);
    if (category) {
      existing++;
      lines.push(`= category ${cat.name}`);
    } else {
      created++;
      lines.push(`+ category ${cat.name}`);
      if (!dry) category = await guild.channels.create({ name: cat.name, type: ChannelType.GuildCategory, permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [P.ViewChannel] }], reason: REASON });
    }
    for (const spec of cat.channels) {
      const found = category ? guild.channels.cache.find((c): c is TextChannel => c.type === ChannelType.GuildText && c.name === spec.name && c.parentId === category!.id) : undefined;
      if (found) {
        existing++;
        if (dry) {
          lines.push(`~ #${spec.name} (permissions would be re-applied)`);
        } else {
          await found.permissionOverwrites.set(overwritesFor(guild, spec, roles, me.id), REASON);
          if (found.topic !== spec.topic) await found.setTopic(spec.topic, REASON);
          repaired++;
          lines.push(`~ #${spec.name} permissions re-applied`);
        }
      } else {
        created++;
        lines.push(`+ #${spec.name}`);
        if (!dry && category) await guild.channels.create({ name: spec.name, type: ChannelType.GuildText, topic: spec.topic, parent: category.id, permissionOverwrites: overwritesFor(guild, spec, roles, me.id), reason: REASON });
      }
    }
  }

  if (!dry) {
    lines.push(`${await ensureRules(guild)} rules message in #welcome-rules`);
    lines.push(`${await ensurePicker(guild)} role picker in #roles`);
  } else {
    lines.push("~ rules message and role picker would be posted or refreshed");
  }
  return { lines, created, repaired, existing };
}

/** Finds the bot's own message in a channel by its footer, so the message is edited, never duplicated. */
async function upsertEmbed(guild: Guild, channelName: string, footer: string, payload: MessageCreateOptions): Promise<"Posted" | "Updated" | "Skipped"> {
  const ch = guild.channels.cache.find((c): c is TextChannel => c.type === ChannelType.GuildText && c.name === channelName);
  if (!ch) return "Skipped";
  const recent = await ch.messages.fetch({ limit: 25 });
  const mine = recent.find((m) => m.author.id === guild.client.user.id && m.embeds[0]?.footer?.text === footer);
  if (mine) {
    await mine.edit({ embeds: payload.embeds, components: payload.components });
    return "Updated";
  }
  await ch.send(payload);
  return "Posted";
}

export const ensureRules = (guild: Guild) =>
  upsertEmbed(guild, "welcome-rules", RULES_FOOTER, { embeds: [new EmbedBuilder().setTitle(RULES_TITLE).setDescription(RULES.join("\n\n")).setColor(0x2563eb).setFooter({ text: RULES_FOOTER })] });

export const ensurePicker = (guild: Guild) =>
  upsertEmbed(guild, "roles", PICKER_FOOTER, {
    embeds: [new EmbedBuilder().setTitle(PICKER_TITLE).setDescription("Press a button to start getting pinged for that kind of alert. Press it again to stop.").setColor(0x2563eb).setFooter({ text: PICKER_FOOTER })],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(PING_ROLES.map((name) => new ButtonBuilder().setCustomId(`pickrole:${name}`).setLabel(name).setStyle(ButtonStyle.Secondary)))],
  });

/** A picker button: only staff can use it, and it only ever toggles one of the alert roles. */
export async function handlePickRole(i: ButtonInteraction): Promise<void> {
  const name = i.customId.slice("pickrole:".length);
  const member = i.member as GuildMember | null;
  if (!member || !i.guild || !(PING_ROLES as readonly string[]).includes(name)) {
    await i.reply({ content: "That button isn't valid.", ephemeral: true });
    return;
  }
  const isStaff = member.roles.cache.some((r) => (STAFF_ROLES as readonly string[]).includes(r.name));
  if (!isStaff) {
    await i.reply({ content: "Only staff can pick alert roles.", ephemeral: true });
    return;
  }
  const role = i.guild.roles.cache.find((r) => r.name === name);
  if (!role) {
    await i.reply({ content: "That role doesn't exist yet. Ask an admin to run /setup.", ephemeral: true });
    return;
  }
  if (member.roles.cache.has(role.id)) {
    await member.roles.remove(role, "Role picker");
    await i.reply({ content: `You will no longer be pinged for **${name}**.`, ephemeral: true });
  } else {
    await member.roles.add(role, "Role picker");
    await i.reply({ content: `You will now be pinged for **${name}**.`, ephemeral: true });
  }
}

/** Roles and channels as plain data, so the server can be rebuilt. It contains no members and no message content. */
export async function exportConfig(guild: Guild) {
  await guild.roles.fetch();
  await guild.channels.fetch();
  const nameOf = (id: string) => guild.roles.cache.get(id)?.name ?? (id === guild.roles.everyone.id ? "@everyone" : id);
  return {
    exportedAt: new Date().toISOString(),
    server: guild.name,
    roles: guild.roles.cache
      .filter((r) => !r.managed && r.id !== guild.roles.everyone.id)
      .map((r) => ({ name: r.name, color: r.color, hoist: r.hoist, mentionable: r.mentionable, permissions: r.permissions.bitfield.toString(), position: r.position }))
      .sort((a, b) => b.position - a.position),
    channels: guild.channels.cache
      .filter((c) => c.type === ChannelType.GuildCategory || c.type === ChannelType.GuildText)
      .map((c) => ({
        name: c.name,
        type: c.type === ChannelType.GuildCategory ? "category" : "text",
        parent: c.parentId ? (guild.channels.cache.get(c.parentId)?.name ?? null) : null,
        topic: c.type === ChannelType.GuildText ? c.topic : null,
        overwrites: "permissionOverwrites" in c ? c.permissionOverwrites.cache.filter((o) => o.type === 0).map((o) => ({ role: nameOf(o.id), allow: o.allow.bitfield.toString(), deny: o.deny.bitfield.toString() })) : [],
      })),
  };
}

/** What the bot has, what it is missing, and anything worth knowing about its power. */
export async function permissionCheck(guild: Guild): Promise<string[]> {
  const me = guild.members.me ?? (await guild.members.fetchMe());
  const has = me.permissions;
  const need: [string, bigint][] = [
    ["Manage Roles", P.ManageRoles],
    ["Manage Channels", P.ManageChannels],
    ["Manage Webhooks", P.ManageWebhooks],
    ["View Channels", P.ViewChannel],
    ["Send Messages", P.SendMessages],
    ["Embed Links", P.EmbedLinks],
    ["Read Message History", P.ReadMessageHistory],
  ];
  const lines: string[] = [];
  for (const [label, flag] of need) lines.push(`${has.has(flag) ? "OK     " : "MISSING"} ${label}`);
  if (has.has(P.Administrator)) lines.push("NOTE    The bot has Administrator, so it can do anything in this server. Keep its token private and reset it in the Developer Portal if it is ever exposed.");
  const top = me.roles.highest.position;
  const above = ROLE_SPECS.filter((s) => (guild.roles.cache.find((r) => r.name === s.name)?.position ?? -1) >= top).map((s) => s.name);
  if (above.length) lines.push(`WARNING These roles sit at or above the bot's role, so it can't manage them: ${above.join(", ")}. Move the bot's role higher.`);
  return lines;
}
