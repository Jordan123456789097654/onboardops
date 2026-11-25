import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { api, failure } from "./api";
import { buildModal, confirm } from "./util";
import type { Command } from "./commands";

/**
 * Commands that act on the website. They run as the linked staff member, and the website checks that person's own role,
 * so a command the Discord server allows can still be refused there.
 * Anything with a customer's email goes through a pop-up form, so the email never appears in a channel.
 */

type Ticket = { ref: string; status: string; priority: string; assignee: string | null; topic: string; source: string; createdAt: string; url: string };

const ticketEmbed = (t: Ticket) =>
  new EmbedBuilder()
    .setTitle(`Ticket ${t.ref}`)
    .setURL(t.url)
    .setColor(t.status === "SOLVED" ? 0x16a34a : 0x2563eb)
    .addFields(
      { name: "Status", value: t.status, inline: true },
      { name: "Priority", value: t.priority, inline: true },
      { name: "Assigned to", value: t.assignee ?? "nobody", inline: true },
      { name: "Topic", value: t.topic.slice(0, 100), inline: true },
      { name: "Opened", value: `<t:${Math.floor(new Date(t.createdAt).getTime() / 1000)}:R>`, inline: true },
    );

const refOption = (o: import("discord.js").SlashCommandStringOption) => o.setName("ref").setDescription("The 8-character ticket reference").setRequired(true).setMinLength(8).setMaxLength(8);

const ticket: Command = {
  json: new SlashCommandBuilder().setName("ticket").setDescription("Look up a support ticket").addStringOption(refOption).setDMPermission(false).toJSON(),
  access: "staff",
  async run(i) {
    await i.deferReply({ ephemeral: true });
    const r = await api<Ticket>(`support/ticket?ref=${encodeURIComponent(i.options.getString("ref", true))}`, i.user.id);
    if (r.status !== 200 || !r.data) { await i.editReply(failure(r)); return; }
    await i.editReply({ embeds: [ticketEmbed(r.data)] });
  },
};

const mytickets: Command = {
  json: new SlashCommandBuilder().setName("mytickets").setDescription("Your open support tickets").setDMPermission(false).toJSON(),
  access: "staff",
  async run(i) {
    await i.deferReply({ ephemeral: true });
    const r = await api<{ tickets: Ticket[] }>("support/mine", i.user.id);
    if (r.status !== 200 || !r.data) { await i.editReply(failure(r)); return; }
    const t = r.data.tickets;
    await i.editReply(t.length ? t.map((x) => `**${x.ref}** · ${x.priority} · ${x.topic.slice(0, 40)} · <${x.url}>`).join("\n") : "You have no open tickets.");
  },
};

const saved: Command = {
  json: new SlashCommandBuilder().setName("saved").setDescription("List the saved replies").setDMPermission(false).toJSON(),
  access: "staff",
  async run(i) {
    await i.deferReply({ ephemeral: true });
    const r = await api<{ replies: { id: string; title: string }[] }>("support/canned", i.user.id);
    if (r.status !== 200 || !r.data) { await i.editReply(failure(r)); return; }
    await i.editReply(r.data.replies.length ? `**Saved replies.** Use them with \`/reply\`.\n${r.data.replies.map((x) => `• ${x.title}`).join("\n").slice(0, 1800)}` : "There are no saved replies yet.");
  },
};

const reply: Command = {
  json: new SlashCommandBuilder()
    .setName("reply")
    .setDescription("Reply to a ticket by email")
    .addStringOption(refOption)
    .addStringOption((o) => o.setName("saved").setDescription("Start from a saved reply").setAutocomplete(true))
    .setDMPermission(false)
    .toJSON(),
  access: "staff",
  async run(i) {
    const ref = i.options.getString("ref", true).toUpperCase();
    const savedId = i.options.getString("saved");
    let prefill = "";
    if (savedId) {
      const r = await api<{ replies: { id: string; body: string }[] }>("support/canned", i.user.id);
      prefill = r.data?.replies.find((x) => x.id === savedId)?.body ?? "";
    }
    await i.showModal(buildModal(`reply:${ref}`, `Reply to ${ref}`, [{ id: "body", label: "Message to the customer", paragraph: true, max: 4000, value: prefill, placeholder: "This is emailed to the customer. Check it before sending." }]));
  },
};

const solve: Command = {
  json: new SlashCommandBuilder().setName("solve").setDescription("Mark a ticket solved").addStringOption(refOption).setDMPermission(false).toJSON(),
  access: "staff",
  async run(i) {
    await i.deferReply({ ephemeral: true });
    const ref = i.options.getString("ref", true);
    const r = await api<{ ref: string }>("support/solve", i.user.id, { method: "POST", body: { ref } });
    await i.editReply(r.status === 200 ? `Ticket ${r.data?.ref ?? ref.toUpperCase()} is marked solved.` : failure(r));
  },
};

/* ---- Moderation: forms, so no email appears in the channel ---- */

const form = (name: string, description: string, modal: () => ReturnType<typeof buildModal>, access: Command["access"]): Command => ({
  json: new SlashCommandBuilder().setName(name).setDescription(description).setDMPermission(false).toJSON(),
  access,
  async run(i) { await i.showModal(modal()); },
});

const email = { id: "email", label: "Account email", max: 200 };
const why = { id: "reason", label: "Reason (10+ characters)", paragraph: true, max: 500, placeholder: "The person is emailed this reason." };

const warn = form("warn", "Warn an account", () => buildModal("mod:warn", "Warn an account", [email, why]), "staff");
const ban = form("ban", "Ban an account", () => buildModal("mod:ban", "Ban an account", [email, why]), "manage");
const unban = form("unban", "Restore a banned account", () => buildModal("mod:unban", "Restore an account", [email, { ...why, placeholder: "Why it is being restored." }]), "manage");
const lookup = form("lookup", "See an account's moderation record", () => buildModal("mod:lookup", "Look up an account", [email]), "staff");
const suspend = form("suspend", "Suspend a workspace", () => buildModal("mod:suspend", "Suspend a workspace", [{ id: "slug", label: "Workspace address (slug)", max: 80 }, { ...why, placeholder: "The workspace owners are emailed this reason." }]), "manage");
const reinstate = form("reinstate", "Reinstate a suspended workspace", () => buildModal("mod:reinstate", "Reinstate a workspace", [{ id: "slug", label: "Workspace address (slug)", max: 80 }]), "manage");

const maintenance: Command = {
  json: new SlashCommandBuilder()
    .setName("maintenance")
    .setDescription("Turn website maintenance mode on or off")
    .addStringOption((o) => o.setName("mode").setDescription("on or off").setRequired(true).addChoices({ name: "on", value: "on" }, { name: "off", value: "off" }))
    .addStringOption((o) => o.setName("message").setDescription("What visitors see (optional)").setMaxLength(500))
    .setDMPermission(false)
    .toJSON(),
  access: "manage",
  async run(i) {
    const on = i.options.getString("mode", true) === "on";
    const ok = await confirm(i, on ? "Turn **maintenance mode ON**? Visitors will see the maintenance page until you turn it off." : "Turn maintenance mode **off** and open the site?");
    if (!ok) return;
    const r = await api<{ enabled: boolean }>("ops/maintenance", i.user.id, { method: "POST", body: { enabled: on, message: i.options.getString("message") ?? undefined } });
    await i.editReply({ content: r.status === 200 ? `Maintenance mode is ${on ? "ON" : "off"}.` : failure(r), components: [] });
  },
};

export const opsCommands: Command[] = [ticket, mytickets, saved, reply, solve, warn, ban, unban, lookup, suspend, reinstate, maintenance];
