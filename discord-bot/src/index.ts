import { Client, Events, GatewayIntentBits, REST, Routes } from "discord.js";
import { allowed, commands } from "./commands";
import { handleAppealButton, handleAutocomplete, handleBanRequestButton, handleModal, handleTicketButton } from "./interactions";
import { startScheduler } from "./scheduler";
import { handlePickRole } from "./setup";
import { logCommand, tooFast } from "./util";

// Local runs can use a .env file. On the host, set these in its environment settings instead.
try {
  (process as unknown as { loadEnvFile?: (p?: string) => void }).loadEnvFile?.(".env");
} catch {
  /* no .env file */
}

const TOKEN = process.env.DISCORD_TOKEN?.trim();
const CLIENT_ID = process.env.DISCORD_CLIENT_ID?.trim();
const GUILD_ID = process.env.DISCORD_GUILD_ID?.trim();
if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error("Set DISCORD_TOKEN, DISCORD_CLIENT_ID and DISCORD_GUILD_ID before starting the bot.");
  process.exit(1);
}

// Only the Guilds intent: the bot never reads messages and never sees the member list.
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (c) => {
  try {
    await new REST({ version: "10" }).setToken(TOKEN).put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [...commands.values()].map((x) => x.json) });
    console.log(`Ready as ${c.user.tag}. ${commands.size} commands registered.`);
    startScheduler(c, GUILD_ID);
  } catch (e) {
    console.error("Could not register commands:", e instanceof Error ? e.message : e);
  }
});

client.on(Events.InteractionCreate, async (i) => {
  try {
    if (i.isAutocomplete()) {
      if (i.guildId === GUILD_ID) await handleAutocomplete(i);
      return;
    }
    if (i.isModalSubmit()) {
      if (i.guildId === GUILD_ID) await handleModal(i);
      return;
    }
    if (i.isButton()) {
      if (i.guildId !== GUILD_ID) return;
      if (i.customId.startsWith("pickrole:")) await handlePickRole(i);
      else if (i.customId.startsWith("ticket:")) await handleTicketButton(i);
      else if (i.customId.startsWith("appeal:")) await handleAppealButton(i);
      else if (i.customId.startsWith("banreq:")) await handleBanRequestButton(i);
      return;
    }
    if (!i.isChatInputCommand()) return;
    if (i.guildId !== GUILD_ID || !i.guild) {
      await i.reply({ content: "This bot only works in the OnboardOps staff server.", ephemeral: true });
      return;
    }
    const cmd = commands.get(i.commandName);
    if (!cmd) return;
    if (tooFast(i.user.id)) {
      await i.reply({ content: "Slow down a little and try again.", ephemeral: true });
      return;
    }
    if (!allowed(i, cmd.access)) {
      await i.reply({ content: "You don't have permission to use that command.", ephemeral: true });
      await logCommand(i.guild, i, "denied");
      return;
    }
    await cmd.run(i);
    await logCommand(i.guild, i, "ok");
  } catch (e) {
    console.error(e);
    const text = "Something went wrong. Nothing more was changed.";
    if (i.isRepliable()) {
      if (i.replied || i.deferred) await i.followUp({ content: text, ephemeral: true }).catch(() => undefined);
      else await i.reply({ content: text, ephemeral: true }).catch(() => undefined);
    }
    if (i.isChatInputCommand() && i.guild) await logCommand(i.guild, i, "error", e instanceof Error ? e.message : String(e));
  }
});

process.on("unhandledRejection", (e) => console.error("Unhandled rejection:", e instanceof Error ? e.message : e));
client.login(TOKEN);
