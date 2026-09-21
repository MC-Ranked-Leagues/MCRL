import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";

import { guildConfiguration } from "../../config/guilds";
import { getCurrentWeek, setCurrentWeek } from "../db/guilds";
import type { BotCommand } from "./command";

export const devChangeWeekCommand = {
  data: new SlashCommandBuilder()
    .setName("dev_change_week")
    .setDescription("Set this server's current week.")
    .addIntegerOption((option) =>
      option
        .setName("week")
        .setDescription("New current week.")
        .setRequired(true)
        .setMinValue(1)
    )
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const guild = guildConfiguration[interaction.guildId];
    if (!guild) {
      await interaction.editReply("This server is not configured.");
      return;
    }
    if (!guild.developerId || interaction.user.id !== guild.developerId) {
      await interaction.editReply("Only the configured developer can do this.");
      return;
    }

    const week = interaction.options.getInteger("week", true);
    const previousWeek = getCurrentWeek(interaction.guildId);
    setCurrentWeek(interaction.guildId, week);
    await interaction.editReply(
      `Changed the server's current week from ${previousWeek} to ${week}. Competitions were not changed.`
    );
  },
} satisfies BotCommand;
