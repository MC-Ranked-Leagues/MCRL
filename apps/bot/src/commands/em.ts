import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";
import {
  endCompetition,
  getActiveCompetition,
  getLatestEndedCompetition,
} from "../db/competitions";
import {
  requireChannelLeague,
  requireCommandGuild,
} from "../lib/command-context";
import { updateLeaderboardMessages } from "../lib/leaderboard-messages";
import { updateRegistrationMessages } from "../lib/registration-messages";
import type { BotCommand } from "./command";

export const emCommand = {
  data: new SlashCommandBuilder()
    .setName("em")
    .setDescription("End the competition and post its final standings.")
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),
  async execute(interaction) {
    const guild = await requireCommandGuild(interaction);
    if (!guild) return;
    const context = await requireChannelLeague(interaction, guild);
    if (!context) return;
    const competition =
      getActiveCompetition(interaction.guildId, context.leagueNumber) ??
      getLatestEndedCompetition(interaction.guildId, context.leagueNumber);
    if (!competition) {
      await interaction.editReply(
        "There is no competition to end for this league."
      );
      return;
    }
    const result = endCompetition(interaction.guildId, competition.id);
    if (result.status === "not_found" || result.status === "no_matches") {
      await interaction.editReply(
        result.status === "no_matches"
          ? "Import at least one match before ending this competition."
          : "That competition no longer exists."
      );
      return;
    }
    const content = `League ${competition.leagueNumber}, Week ${competition.weekNumber} ${result.status === "already_ended" ? "is already ended" : "has ended"}.`;
    try {
      const channel = await interaction.guild.channels.fetch(
        context.league.infoChannelId
      );
      if (!channel?.isSendable())
        throw new Error("Information channel cannot receive messages.");
      // Attempt both updates even when one fails. Neither failure undoes finalization.
      const updates = await Promise.allSettled([
        updateLeaderboardMessages(channel, competition.id),
        updateRegistrationMessages(channel, competition.id),
      ]);
      for (const update of updates)
        if (update.status === "rejected") throw update.reason;
    } catch (error) {
      console.error(
        "Competition ended, but its Discord messages could not be refreshed.",
        error
      );
      await interaction.editReply(
        `${content}\nThe results are saved, but I could not refresh all messages in <#${context.league.infoChannelId}>. Run /em again before starting another competition to retry.`
      );
      return;
    }
    await interaction.editReply(
      `${content} Final standings are posted in <#${context.league.infoChannelId}>.`
    );
  },
} satisfies BotCommand;
