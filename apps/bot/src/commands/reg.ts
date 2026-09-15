import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";

import { guildConfiguration } from "../../config/guilds";
import { getActiveCompetition } from "../db/competitions";
import { registerCompetitionPlayer } from "../lib/registration";
import { requireChannelLeague } from "../lib/command-context";
import type { BotCommand } from "./command";

export const regCommand = {
  data: new SlashCommandBuilder()
    .setName("reg")
    .setDescription(
      "Register your linked Minecraft account for this league's competition."
    )
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const guild = guildConfiguration[interaction.guildId];
    if (!guild) {
      await interaction.editReply("This server is not configured.");
      return;
    }
    const context = await requireChannelLeague(interaction, guild);
    if (!context) return;
    const { league, leagueNumber } = context;
    const member = await interaction.guild.members.fetch({
      user: interaction.user.id,
      force: true,
    });
    // Hosts can register in any league, matching the old bot's administrator override.
    if (
      !member.roles.cache.has(league.leagueRoleId) &&
      !member.roles.cache.has(guild.commandRoleId)
    ) {
      await interaction.editReply(
        `You need the League ${leagueNumber} role to register here.`
      );
      return;
    }
    const competition = getActiveCompetition(interaction.guildId, leagueNumber);
    if (!competition) {
      await interaction.editReply(
        `League ${leagueNumber} has no active competition.`
      );
      return;
    }
    if (!competition.registrationOpen) {
      await interaction.editReply("Registration is currently closed.");
      return;
    }

    await registerCompetitionPlayer(
      interaction,
      league,
      leagueNumber,
      competition,
      interaction.user
    );
  },
} satisfies BotCommand;
