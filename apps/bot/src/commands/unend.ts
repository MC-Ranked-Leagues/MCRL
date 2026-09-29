import { api } from "@mcrl/backend/api";
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
import {
  publishToWebsite,
  reportPublicationResults,
} from "../lib/backend-publisher";

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

    const publicationResults = publishToWebsite(
      interaction.guildId,
      `Reopen competition: League ${competition.leagueNumber}, Week ${competition.weekNumber}`,
      (client, writerKey) =>
        client.mutation(api.writes.competitions.reopenCompetition, {
          writerKey,
          leagueTier: competition.leagueNumber,
          weekNumber: competition.weekNumber,
        })
    );

    await replyWithCompetitionUpdate(
      interaction,
      competition.id,
      context.league.infoChannelId,
      `League ${competition.leagueNumber}, Week ${competition.weekNumber} is active again. Registration remains closed.`
    );
    await reportPublicationResults(interaction, publicationResults);
  },
} satisfies BotCommand;
