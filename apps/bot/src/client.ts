import {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  type Interaction,
} from "discord.js";

import { commands } from "./commands";
import { sendCommandLog } from "./lib/command-logging";

async function handleInteraction(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  if (!interaction.inCachedGuild()) {
    await interaction.reply({
      content: "This command requires a server the bot is connected to.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Handlers edit this private reply instead of managing acknowledgement themselves.
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const command = commands.find(
      (candidate) => candidate.data.name === interaction.commandName
    );

    if (!command) {
      await interaction.editReply("This command is unavailable.");
      return;
    }

    await command.execute(interaction);
  } catch (error) {
    console.error(`Command /${interaction.commandName} failed.`, error);
    await interaction.editReply("The command could not be completed.");
  } finally {
    await sendCommandLog(interaction).catch((error: unknown) => {
      console.error(
        `Failed to log command /${interaction.commandName}.`,
        error
      );
    });
  }
}

export const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, (readyClient) => {
  console.info(`Discord bot connected as ${readyClient.user.tag}.`);
});

client.on(Events.InteractionCreate, (interaction) => {
  void handleInteraction(interaction).catch((error: unknown) => {
    console.error("Failed to handle a Discord interaction.", error);
  });
});

client.on(Events.Error, (error) => {
  console.error("Discord client error.", error);
});
