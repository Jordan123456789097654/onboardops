import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ComponentType,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
  type Guild,
  type ModalSubmitInteraction,
  type TextChannel,
} from "discord.js";

/* ---------------- Rate limit: 5 commands per 10 seconds per person ---------------- */

const recent = new Map<string, number[]>();
export function tooFast(userId: string, now = Date.now()): boolean {
  const hits = (recent.get(userId) ?? []).filter((t) => now - t < 10_000);
  hits.push(now);
  recent.set(userId, hits);
  return hits.length > 5;
}

/* ---------------- Confirmation prompt for anything that changes things ---------------- */

/** Asks the person to confirm with a button. Returns true only if they pressed Confirm within 30 seconds. */
export async function confirm(i: ChatInputCommandInteraction | ModalSubmitInteraction, text: string): Promise<boolean> {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("confirm:yes").setLabel("Confirm").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("confirm:no").setLabel("Cancel").setStyle(ButtonStyle.Secondary),
  );
  const msg = await i.reply({ content: text, components: [row], ephemeral: true, fetchReply: true });
  try {
    const b = await msg.awaitMessageComponent({ componentType: ComponentType.Button, filter: (x) => x.user.id === i.user.id, time: 30_000 });
    const yes = b.customId === "confirm:yes";
    await b.update({ content: yes ? "Confirmed. Working…" : "Cancelled. Nothing was changed.", components: [] });
    return yes;
  } catch {
    await i.editReply({ content: "Timed out. Nothing was changed.", components: [] });
    return false;
  }
}

/* ---------------- Command log: who ran what, written to #bot-log ---------------- */

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export async function logCommand(guild: Guild, i: ChatInputCommandInteraction, outcome: "ok" | "error" | "denied", detail = ""): Promise<void> {
  const options = i.options.data.map((o) => `${o.name}: ${String(o.value)}`).join(", ");
  console.log(`[${new Date().toISOString()}] ${i.user.id} /${i.commandName} ${outcome}`);
  const ch = guild.channels.cache.find((c): c is TextChannel => c.type === ChannelType.GuildText && c.name === "bot-log");
  if (!ch) return;
  const embed = new EmbedBuilder()
    .setColor(outcome === "ok" ? 0x16a34a : outcome === "denied" ? 0xea580c : 0xdc2626)
    .setTitle(`/${i.commandName}`)
    .addFields({ name: "Who", value: `<@${i.user.id}>`, inline: true }, { name: "Result", value: outcome, inline: true })
    .setTimestamp(new Date());
  if (options) embed.addFields({ name: "Options", value: clip(options, 200) });
  if (detail) embed.addFields({ name: "Detail", value: clip(detail, 300) });
  await ch.send({ embeds: [embed] }).catch(() => undefined);
}

/* ---------------- Pop-up forms: used for anything sensitive, so it never shows in a channel ---------------- */

export type ModalField = { id: string; label: string; paragraph?: boolean; required?: boolean; max?: number; value?: string; placeholder?: string };

export function buildModal(customId: string, title: string, fields: ModalField[]): ModalBuilder {
  const m = new ModalBuilder().setCustomId(customId).setTitle(title.slice(0, 45));
  for (const f of fields) {
    const t = new TextInputBuilder().setCustomId(f.id).setLabel(f.label.slice(0, 45)).setStyle(f.paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short).setRequired(f.required ?? true).setMaxLength(f.max ?? (f.paragraph ? 1000 : 200));
    if (f.value) t.setValue(f.value.slice(0, f.max ?? (f.paragraph ? 1000 : 200)));
    if (f.placeholder) t.setPlaceholder(f.placeholder.slice(0, 100));
    m.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(t));
  }
  return m;
}

/* ---------------- Log for button and form actions (commands log themselves) ---------------- */

export async function logEvent(guild: Guild, userId: string, title: string, outcome: "ok" | "error" | "denied", detail = ""): Promise<void> {
  console.log(`[${new Date().toISOString()}] ${userId} ${title} ${outcome}`);
  const ch = guild.channels.cache.find((c): c is TextChannel => c.type === ChannelType.GuildText && c.name === "bot-log");
  if (!ch) return;
  const embed = new EmbedBuilder().setColor(outcome === "ok" ? 0x16a34a : outcome === "denied" ? 0xea580c : 0xdc2626).setTitle(title).addFields({ name: "Who", value: `<@${userId}>`, inline: true }, { name: "Result", value: outcome, inline: true }).setTimestamp(new Date());
  if (detail) embed.addFields({ name: "Detail", value: clip(detail, 300) });
  await ch.send({ embeds: [embed] }).catch(() => undefined);
}
