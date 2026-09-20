import {
  ApplicationIntegrationType,
  escapeMarkdown,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";

import { setPlayerTwitchUsername } from "../db/players";
import type { BotCommand } from "./command";

export const twitchCommand = {
  data: new SlashCommandBuilder()
    .setName("twitch")
    .setDescription("Save your Twitch username for registration exports.")
    .addStringOption((option) =>
      option
        .setName("username")
        .setDescription("Your Twitch username.")
        .setRequired(true)
    )
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const username = interaction.options.getString("username", true).trim();
    if (!username) {
      await interaction.editReply("Enter a Twitch username.");
      return;
    }
    const saved = setPlayerTwitchUsername(
      interaction.guildId,
      interaction.user.id,
      username
    );
    if (!saved) {
      await interaction.editReply(
        "You have no saved Ranked Leagues account in this server. Use /signup or /reg first."
      );
      return;
    }

    await interaction.editReply(
      `Saved Twitch username **${escapeMarkdown(username)}**.`
    );
  },
} satisfies BotCommand;
