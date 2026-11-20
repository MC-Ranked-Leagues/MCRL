import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";

import type { BotCommand } from "./command";

const guideUrl = "https://rankedleagues.com/info/extra/league-bot/";

export const helpCommand = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Get a link to the bot guide.")
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    await interaction.editReply(
      `Commands and guides for the bot are here: <${guideUrl}>`
    );
  },
} satisfies BotCommand;
