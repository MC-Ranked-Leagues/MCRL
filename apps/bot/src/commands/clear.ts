import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";
import { getActiveCompetition } from "../db/competitions";
import { clearMatch } from "../db/matches";
import {
  requireChannelLeague,
  requireCommandGuild,
} from "../lib/command-context";
import { replyWithLeaderboardUpdate } from "../lib/leaderboard-messages";
import type { BotCommand } from "./command";

export const clearCommand = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Delete a match and all its results.")
    .addIntegerOption((option) =>
      option
        .setName("match_number")
        .setDescription("Match to delete. Defaults to the latest match.")
        .setMinValue(1)
    )
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),
  async execute(interaction) {
    const guild = await requireCommandGuild(interaction);
    if (!guild) return;
    const context = await requireChannelLeague(interaction, guild);
    if (!context) return;
    const competition = getActiveCompetition(
      interaction.guildId,
      context.leagueNumber
    );
    if (!competition) {
      await interaction.editReply("No competition is active for this league.");
      return;
    }
    const result = clearMatch(
      competition.id,
      interaction.options.getInteger("match_number") ?? undefined
    );
    if (result.status !== "cleared") {
      await interaction.editReply(
        result.status === "inactive"
          ? "That competition is no longer active."
          : "There is no matching match to delete."
      );
      return;
    }
    await replyWithLeaderboardUpdate(
      interaction,
      competition.id,
      context.league.infoChannelId,
      `Deleted Match ${result.number} and all its results from League ${competition.leagueNumber}, Week ${competition.weekNumber}.`
    );
  },
} satisfies BotCommand;
