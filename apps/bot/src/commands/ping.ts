import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";

import type { BotCommand } from "./command";

export const pingCommand = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check whether the bot is online.")
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    await interaction.editReply("Pong!");
  },
} satisfies BotCommand;
