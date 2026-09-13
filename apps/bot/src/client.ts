import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  MessageFlags,
  type Interaction,
} from "discord.js";

import { commands } from "./commands";
import type { BotCommand } from "./commands/command";

async function handleInteraction(
  interaction: Interaction,
  registry: ReadonlyMap<string, BotCommand>
): Promise<void> {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const command = registry.get(interaction.commandName);

  if (!command) {
    await interaction.reply({
      content: "This command is unavailable.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Command /${interaction.commandName} failed.`, error);

    const response = {
      content: "The command could not be completed.",
      flags: MessageFlags.Ephemeral,
    } as const;

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(response);
    } else {
      await interaction.reply(response);
    }
  }
}

export function createBotClient(): Client {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });
  const registry = new Collection<string, BotCommand>();

  for (const command of commands) {
    if (registry.has(command.data.name)) {
      throw new Error(`Duplicate command: ${command.data.name}`);
    }

    registry.set(command.data.name, command);
  }

  client.once(Events.ClientReady, (readyClient) => {
    console.info(`Discord bot connected as ${readyClient.user.tag}.`);
  });

  client.on(Events.InteractionCreate, (interaction) => {
    void handleInteraction(interaction, registry).catch((error: unknown) => {
      console.error("Failed to handle a Discord interaction.", error);
    });
  });

  client.on(Events.Error, (error) => {
    console.error("Discord client error.", error);
  });

  return client;
}
