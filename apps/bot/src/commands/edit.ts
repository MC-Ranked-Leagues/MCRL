import { api } from "@mcrl/backend/api";
import {
  ApplicationIntegrationType,
  escapeMarkdown,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";
import { getActiveCompetition } from "../db/competitions";
import { editMatchTime } from "../db/matches";
import { getMatchSnapshot } from "../db/publication-snapshots";
import {
  publishToWebsite,
  reportPublicationResults,
} from "../lib/backend-publisher";
import {
  requireChannelLeague,
  requireCommandGuild,
} from "../lib/command-context";
import { replyWithLeaderboardUpdate } from "../lib/leaderboard-messages";
import { formatDuration, parseDuration } from "../lib/time";
import type { BotCommand } from "./command";

export const editCommand = {
  data: new SlashCommandBuilder()
    .setName("edit")
    .setDescription("Set a player's final time in an imported match.")
    .addUserOption((option) =>
      option.setName("user").setDescription("Player to edit.").setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("match_number")
        .setDescription("Match to edit.")
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption((option) =>
      option
        .setName("time")
        .setDescription("Final time as m:ss or m:ss.mmm.")
        .setRequired(true)
    )
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),
  async execute(interaction) {
    const guild = await requireCommandGuild(interaction);
    if (!guild) return;
    const context = await requireChannelLeague(interaction, guild);
    if (!context) return;
    const timeMs = parseDuration(interaction.options.getString("time", true));
    if (timeMs === undefined) {
      await interaction.editReply(
        "Write the time as m:ss or m:ss.mmm, for example 12:34.567."
      );
      return;
    }
    const competition = getActiveCompetition(
      interaction.guildId,
      context.leagueNumber
    );
    if (!competition) {
      await interaction.editReply("No competition is active for this league.");
      return;
    }
    const matchNumber = interaction.options.getInteger("match_number", true);
    const result = editMatchTime(
      competition.id,
      matchNumber,
      interaction.options.getUser("user", true).id,
      timeMs
    );
    if (result.status !== "edited") {
      const messages = {
        inactive: "That competition is no longer active.",
        match_not_found: `Match ${matchNumber} has not been imported.`,
        over_limit: `That time is over the match's ${formatDuration(result.status === "over_limit" ? result.timeLimitMs : 0)} time limit.`,
        not_registered: "That player is not registered in this competition.",
      };
      await interaction.editReply(messages[result.status]);
      return;
    }
    const publicationResults = publishToWebsite(
      interaction.guildId,
      `Edit match ${matchNumber}: League ${competition.leagueNumber}, Week ${competition.weekNumber}`,
      (client, writerKey) =>
        client.mutation(api.writes.matches.importMatchData, {
          writerKey,
          ...getMatchSnapshot(competition, result.matchId),
        })
    );
    const previous =
      result.previous.status === "finished"
        ? formatDuration(result.previous.timeMs!, true)
        : result.previous.status.toUpperCase();
    await replyWithLeaderboardUpdate(
      interaction,
      competition.id,
      context.league.infoChannelId,
      `Set ${escapeMarkdown(result.ign)}'s Match ${matchNumber} time to ${formatDuration(timeMs, true)} (was ${previous}). They placed ${result.placement} for ${result.points} pts, and the match was rescored.`
    );
    await reportPublicationResults(interaction, publicationResults);
  },
} satisfies BotCommand;
