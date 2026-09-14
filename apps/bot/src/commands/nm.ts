import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";

import {
  requireCommandGuild,
  requireChannelLeague,
} from "../lib/command-context";
import { startCompetition } from "../db/competitions";
import { formatDuration } from "../lib/time";
import type { BotCommand } from "./command";

export const nmCommand = {
  data: new SlashCommandBuilder()
    .setName("nm")
    .setDescription("Start a new competition.")
    .addIntegerOption((option) =>
      option
        .setName("week")
        .setDescription("Week number.")
        .setRequired(true)
        .setMinValue(1)
    )
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const guild = await requireCommandGuild(interaction);
    if (!guild) return;
    const context = await requireChannelLeague(interaction, guild);
    if (!context) return;
    const { leagueNumber, league } = context;
    const weekNumber = interaction.options.getInteger("week", true);

    const channel = await interaction.guild.channels.fetch(
      league.infoChannelId
    );

    if (!channel?.isSendable()) {
      await interaction.editReply(
        `The configured channel for League ${leagueNumber} is unavailable or cannot receive messages.`
      );
      return;
    }

    const created = startCompetition({
      guildId: interaction.guildId,
      leagueNumber,
      weekNumber,
      maxTimeLimitMs: league.maxTimeLimitMs,
      startedAt: new Date(),
    });

    if (!created) {
      await interaction.editReply(
        `League ${leagueNumber} already has an active competition, or Week ${weekNumber} already exists.`
      );
      return;
    }

    try {
      await channel.send(
        [
          `Started the competition for **League ${leagueNumber}, Week ${weekNumber}**.`,
          "Registration is closed.",
          `Time limit: **${formatDuration(league.maxTimeLimitMs)}**.`,
        ].join("\n")
      );
    } catch (error) {
      // Creating the competition succeeds even if its announcement fails.
      console.error("Competition created, but its announcement failed.", error);
      await interaction.editReply(
        `League ${leagueNumber}, Week ${weekNumber} was created, but I could not announce it in <#${league.infoChannelId}>.`
      );
      return;
    }

    await interaction.editReply(
      `Started League ${leagueNumber}, Week ${weekNumber} in <#${league.infoChannelId}>.`
    );
  },
} satisfies BotCommand;
