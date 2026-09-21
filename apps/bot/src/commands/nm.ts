import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";

import {
  requireCommandGuild,
  requireChannelLeague,
} from "../lib/command-context";
import { getActiveCompetition, startCompetition } from "../db/competitions";
import { getCurrentWeek } from "../db/guilds";
import { updateRegistrationMessages } from "../lib/registration-messages";
import type { BotCommand } from "./command";

export const nmCommand = {
  data: new SlashCommandBuilder()
    .setName("nm")
    .setDescription("Start a new competition.")
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const guild = await requireCommandGuild(interaction);
    if (!guild) return;
    const context = await requireChannelLeague(interaction, guild);
    if (!context) return;
    const { leagueNumber, league } = context;
    const channel = await interaction.guild.channels.fetch(
      league.infoChannelId
    );

    if (!channel?.isSendable()) {
      await interaction.editReply(
        `The configured channel for League ${leagueNumber} is unavailable or cannot receive messages.`
      );
      return;
    }

    // Read after the Discord fetch so an overlapping /advance_week cannot leave this command on the old week.
    const weekNumber = getCurrentWeek(interaction.guildId);
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

    const competition = getActiveCompetition(
      interaction.guildId,
      leagueNumber
    )!;
    try {
      await updateRegistrationMessages(channel, competition.id);
    } catch (error) {
      // Keep the competition; a later registration update can retry the message.
      console.error(
        "Competition created, but its registration message failed.",
        error
      );
      await interaction.editReply(
        `League ${leagueNumber}, Week ${weekNumber} was created, but I could not post its registration message in <#${league.infoChannelId}>. /toggle_registration will retry the message when changing registration status.`
      );
      return;
    }

    await interaction.editReply(
      `Started League ${leagueNumber}, Week ${weekNumber} in <#${league.infoChannelId}>.`
    );
  },
} satisfies BotCommand;
