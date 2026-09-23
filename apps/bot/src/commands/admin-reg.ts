import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";
import { getActiveCompetition } from "../db/competitions";
import {
  requireChannelLeague,
  requireCommandGuild,
} from "../lib/command-context";
import { registerCompetitionPlayer } from "../lib/registration";
import type { BotCommand } from "./command";

export const adminRegCommand = {
  data: new SlashCommandBuilder()
    .setName("admin_reg")
    .setDescription("Register a player for this league's competition.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Player to register.")
        .setRequired(true)
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
      await interaction.editReply(
        `League ${context.leagueNumber} has no active competition.`
      );
      return;
    }
    const user = interaction.options.getUser("user", true);
    await registerCompetitionPlayer(
      interaction,
      context.league,
      context.leagueNumber,
      competition,
      user,
      { admin: true }
    );
  },
} satisfies BotCommand;
