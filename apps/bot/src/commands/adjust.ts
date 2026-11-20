import { api } from "@mcrl/backend/api";
import {
  ApplicationIntegrationType,
  escapeMarkdown,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";
import { getActiveCompetition } from "../db/competitions";
import { setPointsAdjustment } from "../db/matches";
import {
  publishToWebsite,
  reportPublicationResults,
} from "../lib/backend-publisher";
import {
  requireChannelLeague,
  requireCommandGuild,
} from "../lib/command-context";
import { replyWithLeaderboardUpdate } from "../lib/leaderboard-messages";
import type { BotCommand } from "./command";

export const adjustCommand = {
  data: new SlashCommandBuilder()
    .setName("adjust")
    .setDescription("Set a player's point adjustment in this competition.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Player to adjust.")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("points")
        .setDescription(
          "Points to add, or negative to remove. Replaces any earlier adjustment; 0 clears it."
        )
        .setRequired(true)
    )
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),
  async execute(interaction) {
    const guild = await requireCommandGuild(interaction);
    if (!guild) return;
    const context = await requireChannelLeague(interaction, guild);
    if (!context) return;
    const points = interaction.options.getInteger("points", true);
    const competition = getActiveCompetition(
      interaction.guildId,
      context.leagueNumber
    );
    if (!competition) {
      await interaction.editReply("No competition is active for this league.");
      return;
    }
    const result = setPointsAdjustment(
      competition.id,
      interaction.options.getUser("user", true).id,
      points
    );
    if (result.status !== "adjusted") {
      await interaction.editReply(
        result.status === "inactive"
          ? "That competition is no longer active."
          : "That player is not registered in this competition."
      );
      return;
    }
    const publicationResults = publishToWebsite(
      interaction.guildId,
      `Adjust points: League ${competition.leagueNumber}, Week ${competition.weekNumber}`,
      (client, writerKey) =>
        client.mutation(api.writes.matches.setPointAdjustment, {
          writerKey,
          leagueTier: competition.leagueNumber,
          weekNumber: competition.weekNumber,
          uuid: result.uuid,
          manualAdjustmentPoints: points,
        })
    );
    const signed = (value: number) => (value > 0 ? `+${value}` : `${value}`);
    const ign = escapeMarkdown(result.ign);
    await replyWithLeaderboardUpdate(
      interaction,
      competition.id,
      context.league.infoChannelId,
      points === 0
        ? `Removed ${ign}'s point adjustment (was ${signed(result.previous)} pts).`
        : `Set ${ign}'s point adjustment to ${signed(points)} pts (was ${signed(result.previous)} pts).`
    );
    await reportPublicationResults(interaction, publicationResults);
  },
} satisfies BotCommand;
