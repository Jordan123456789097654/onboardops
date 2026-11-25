import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type AutocompleteInteraction,
  type ButtonInteraction,
  type ModalSubmitInteraction,
} from "discord.js";
import { api, failure } from "./api";
import { buildModal, confirm, logEvent } from "./util";

/** Buttons on notices the website posts, and the pop-up forms the commands open. Every action runs as the person who pressed it. */

const solveRow = (id: string) =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`ticket:solve:${id}`).setLabel("Mark solved").setStyle(ButtonStyle.Secondary));

/** Rewrites the notice the button was on, adding a line about what just happened. */
async function stamp(i: ButtonInteraction, text: string, keepRow?: ActionRowBuilder<ButtonBuilder>) {
  const base = i.message.embeds[0];
  const embed = base ? EmbedBuilder.from(base).addFields({ name: "Update", value: text }) : new EmbedBuilder().setDescription(text);
  await i.editReply({ embeds: [embed], components: keepRow ? [keepRow] : [] });
}

export async function handleTicketButton(i: ButtonInteraction): Promise<void> {
  const [, action, id] = i.customId.split(":");
  if (!id || (action !== "claim" && action !== "solve")) { await i.reply({ content: "That button isn't valid.", ephemeral: true }); return; }
  await i.deferUpdate();
  const r = await api<{ ok: boolean }>(`support/${action}`, i.user.id, { method: "POST", body: { id } });
  if (r.status !== 200) {
    await i.followUp({ content: failure(r), ephemeral: true });
    if (i.guild) await logEvent(i.guild, i.user.id, `ticket ${action}`, r.status === 403 ? "denied" : "error", failure(r));
    return;
  }
  if (action === "claim") await stamp(i, `Claimed by <@${i.user.id}>`, solveRow(id));
  else await stamp(i, `Marked solved by <@${i.user.id}>`);
  if (i.guild) await logEvent(i.guild, i.user.id, `ticket ${action}`, "ok");
}

/** Appeal buttons open a form asking why, because the person who is appealing is emailed the answer. */
export async function handleAppealButton(i: ButtonInteraction): Promise<void> {
  const [, verdict, id] = i.customId.split(":");
  if (!id || (verdict !== "overturn" && verdict !== "uphold")) { await i.reply({ content: "That button isn't valid.", ephemeral: true }); return; }
  await i.showModal(buildModal(`appealnote:${verdict}:${id}`, verdict === "overturn" ? "Overturn this appeal" : "Uphold this decision", [{ id: "note", label: "Reason (10+ characters)", paragraph: true, max: 500, placeholder: "The person is emailed this." }]));
}

export async function handleBanRequestButton(i: ButtonInteraction): Promise<void> {
  const [, verdict, id] = i.customId.split(":");
  if (!id || (verdict !== "approve" && verdict !== "deny")) { await i.reply({ content: "That button isn't valid.", ephemeral: true }); return; }
  await i.deferUpdate();
  const r = await api<{ ok: boolean }>("moderation/banreq", i.user.id, { method: "POST", body: { id, approve: verdict === "approve" } });
  if (r.status !== 200) {
    await i.followUp({ content: failure(r), ephemeral: true });
    if (i.guild) await logEvent(i.guild, i.user.id, `ban request ${verdict}`, r.status === 403 ? "denied" : "error", failure(r));
    return;
  }
  await stamp(i, verdict === "approve" ? `Approved by <@${i.user.id}>. The account is banned.` : `Denied by <@${i.user.id}>.`);
  if (i.guild) await logEvent(i.guild, i.user.id, `ban request ${verdict}`, "ok");
}

const field = (i: ModalSubmitInteraction, id: string) => i.fields.getTextInputValue(id).trim();

export async function handleModal(i: ModalSubmitInteraction): Promise<void> {
  const parts = i.customId.split(":");
  const kind = parts[0];
  const log = (title: string, ok: boolean, detail = "") => (i.guild ? logEvent(i.guild, i.user.id, title, ok ? "ok" : "error", detail) : Promise.resolve());

  if (kind === "reply") {
    await i.deferReply({ ephemeral: true });
    const r = await api<{ ref: string; emailed: boolean }>("support/reply", i.user.id, { method: "POST", body: { ref: parts[1], body: field(i, "body") } });
    await i.editReply(r.status === 200 ? (r.data?.emailed ? "Sent. The customer was emailed." : "Saved on the ticket, but the email could not be sent. Check the ticket in the admin panel.") : failure(r));
    await log("reply", r.status === 200, r.status === 200 ? `ticket ${parts[1]}` : failure(r));
    return;
  }

  if (kind === "appealnote") {
    const overturn = parts[1] === "overturn";
    const r = await api<{ ok: boolean }>("moderation/appeal", i.user.id, { method: "POST", body: { id: parts[2], overturn, note: field(i, "note") } });
    if (r.status !== 200) { await i.reply({ content: failure(r), ephemeral: true }); await log("appeal decision", false, failure(r)); return; }
    if (i.isFromMessage()) await i.update({ components: [], embeds: i.message.embeds.map((e) => EmbedBuilder.from(e).addFields({ name: "Update", value: `${overturn ? "Overturned" : "Upheld"} by <@${i.user.id}>` })) });
    else await i.reply({ content: "Done.", ephemeral: true });
    await log("appeal decision", true, overturn ? "overturned" : "upheld");
    return;
  }

  if (kind === "mod") {
    const action = parts[1];
    if (action === "lookup") {
      await i.deferReply({ ephemeral: true });
      const r = await api<{ found: boolean; banned?: boolean; banReason?: string; created?: string; counts?: Record<string, number>; pendingAppeals?: number }>(`moderation/lookup?email=${encodeURIComponent(field(i, "email"))}`, i.user.id);
      if (r.status !== 200 || !r.data) { await i.editReply(failure(r)); return; }
      const d = r.data;
      if (!d.found) { await i.editReply("No account with that email."); return; }
      const c = d.counts ?? {};
      await i.editReply(`${d.banned ? `**Banned.** ${d.banReason ?? ""}` : "**Not banned.**"}\nWarnings: ${c.WARN ?? 0} · Bans: ${c.BAN ?? 0} · Restores: ${c.UNBAN ?? 0} · Pending appeals: ${d.pendingAppeals ?? 0}\nAccount created: <t:${Math.floor(new Date(d.created ?? 0).getTime() / 1000)}:D>`);
      await log("lookup", true);
      return;
    }

    if (action === "ban") {
      const ok = await confirm(i, `Ban **${field(i, "email")}**? They are signed out everywhere and emailed the reason. With two or more owners, a different owner must approve it first.`);
      if (!ok) return;
      const r = await api<{ executed: boolean }>("moderation/ban", i.user.id, { method: "POST", body: { email: field(i, "email"), reason: field(i, "reason") } });
      await i.editReply({ content: r.status === 200 ? (r.data?.executed ? "The account is banned." : "Sent to a second owner for approval in #mod-log.") : failure(r), components: [] });
      await log("ban", r.status === 200, r.status === 200 ? "" : failure(r));
      return;
    }

    if (action === "suspend") {
      const ok = await confirm(i, `Suspend workspace **${field(i, "slug")}**? Nobody in it can use it, and its owners are emailed the reason.`);
      if (!ok) return;
      const r = await api<{ name: string }>("moderation/workspace", i.user.id, { method: "POST", body: { slug: field(i, "slug"), action: "suspend", reason: field(i, "reason") } });
      await i.editReply({ content: r.status === 200 ? `Suspended ${r.data?.name ?? "the workspace"}.` : failure(r), components: [] });
      await log("suspend workspace", r.status === 200, r.status === 200 ? "" : failure(r));
      return;
    }

    await i.deferReply({ ephemeral: true });
    const body = action === "reinstate" ? { slug: field(i, "slug"), action: "reinstate" } : { email: field(i, "email"), reason: field(i, "reason") };
    const path = action === "reinstate" ? "moderation/workspace" : `moderation/${action}`;
    if (!["warn", "unban", "reinstate"].includes(action)) { await i.editReply("That form isn't valid."); return; }
    const r = await api<{ ok: boolean; name?: string }>(path, i.user.id, { method: "POST", body });
    await i.editReply(r.status === 200 ? (action === "warn" ? "Warning sent." : action === "unban" ? "The account is restored." : `Reinstated ${r.data?.name ?? "the workspace"}.`) : failure(r));
    await log(action, r.status === 200, r.status === 200 ? "" : failure(r));
  }
}

/** Suggests saved replies while someone types the saved option of /reply. */
export async function handleAutocomplete(i: AutocompleteInteraction): Promise<void> {
  if (i.commandName !== "reply") { await i.respond([]); return; }
  const typed = i.options.getFocused().toLowerCase();
  const r = await api<{ replies: { id: string; title: string }[] }>("support/canned", i.user.id);
  const choices = (r.data?.replies ?? []).filter((x) => x.title.toLowerCase().includes(typed)).slice(0, 25).map((x) => ({ name: x.title.slice(0, 100), value: x.id }));
  await i.respond(choices).catch(() => undefined);
}
