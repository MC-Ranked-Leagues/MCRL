import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";

import {
  getActiveCompetition,
  getLatestEndedCompetition,
  unendCompetition,
} from "../db/competitions";
import {
  requireChannelLeague,
  requireCommandGuild,
} from "../lib/command-context";
import { replyWithCompetitionUpdate } from "../lib/competition-messages";
import type { BotCommand } from "./command";

export const unendCommand = {
  data: new SlashCommandBuilder()
    .setName("unend")
    .setDescription("Make the most recently ended competition active again.")
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const guild = await requireCommandGuild(interaction);
    if (!guild) return;
    const context = await requireChannelLeague(interaction, guild);
    if (!context) return;

    const activeCompetition = getActiveCompetition(
      interaction.guildId,
      context.leagueNumber
    );
    if (activeCompetition) {
      await interaction.editReply(
        `League ${activeCompetition.leagueNumber}, Week ${activeCompetition.weekNumber} is already active. Nothing was changed.`
      );
      return;
    }

    const competition = getLatestEndedCompetition(
      interaction.guildId,
      context.leagueNumber
    );
    if (!competition) {
      await interaction.editReply(
        `League ${context.leagueNumber} has no ended competition to make active.`
      );
      return;
    }

    const result = unendCompetition(interaction.guildId, competition.id);
    if (result.status !== "active") {
      const messages = {
        relegated:
          "This competition has used /relegate and cannot be reopened.",
        not_found: "That competition no longer exists.",
        already_active: "That competition is already active.",
        has_active: `League ${context.leagueNumber} already has an active competition. End or delete it before using /unend.`,
      };
      await interaction.editReply(messages[result.status]);
      return;
    }

    await replyWithCompetitionUpdate(
      interaction,
      competition.id,
      context.league.infoChannelId,
      `League ${competition.leagueNumber}, Week ${competition.weekNumber} is active again. Registration remains closed.`
    );
  },
} satisfies BotCommand;
