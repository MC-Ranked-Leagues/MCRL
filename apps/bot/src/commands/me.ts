import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
  escapeMarkdown,
} from "discord.js";
import { getPlayer } from "../db/players";
import type { BotCommand } from "./command";

export const meCommand = {
  data: new SlashCommandBuilder()
    .setName("me")
    .setDescription("Show your saved Ranked Leagues account info.")
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),
  async execute(interaction) {
    const player = getPlayer(interaction.guildId, interaction.user.id);
    if (!player) {
      await interaction.editReply(
        "You have no saved Ranked Leagues account in this server. Use /signup or register with your league role first."
      );
      return;
    }

    const placements = player.placements.length
      ? player.placements
          .map(
            ({ week, league, placement }) =>
              `Week ${week}, League ${league}: #${placement}`
          )
          .join("\n")
      : "None yet";
    await interaction.editReply({
      content: [
        "**Your Ranked Leagues account**",
        `Minecraft: **${escapeMarkdown(player.ign)}**`,
        `UUID: ${player.minecraftUuid}`,
        `League: ${player.leagueNumber ?? "Unassigned"}`,
        `Status: ${player.status}`,
        `placements: ${placements}`,
      ].join("\n"),
      allowedMentions: { parse: [] },
    });
  },
} satisfies BotCommand;
